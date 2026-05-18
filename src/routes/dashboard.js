const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const mediunsAtivos = db.query('mediuns', m => m.status === 'Ativo').length;
  const mediunsInativos = db.query('mediuns', m => m.status === 'Inativo').length;

  const mensalidades = db.getAll('mensalidades');
  const mensPrevisto = mensalidades.reduce((s, m) => s + m.valor, 0);
  const mensRecebido = mensalidades.reduce((s, m) => s + m.pago, 0);

  const faxinas = db.getAll('faxina');
  const faxinaFaltas = faxinas.filter(f => f.presenca === 'falta').reduce((s, f) => s + f.valor, 0);
  const faxinaFeitas = faxinas.filter(f => f.presenca === 'feito').length;

  const despesas = db.getAll('despesas');
  const despesasTotal = despesas.reduce((s, d) => s + d.valor, 0);
  const despesasPagas = despesas.filter(d => d.status === 'paga').reduce((s, d) => s + d.valor, 0);

  const trabalhos = db.getAll('trabalhos');
  const trabalhosTotal = trabalhos.reduce((s, t) => s + t.valor, 0);
  const trabalhosRealizados = trabalhos.filter(t => t.status === 'realizado').reduce((s, t) => s + t.valor, 0);

  const extras = db.getAll('extras');
  const extrasReceitas = extras.filter(e => e.tipo === 'receita').reduce((s, e) => s + e.valor, 0);
  const extrasGastos = extras.filter(e => e.tipo === 'gasto').reduce((s, e) => s + e.valor, 0);

  res.json({
    mediuns: { ativos: mediunsAtivos, inativos: mediunsInativos },
    mensalidades: { previsto: mensPrevisto, recebido: mensRecebido, pendente: mensPrevisto - mensRecebido },
    faxina: { total_faltas_valor: faxinaFaltas, feitas: faxinaFeitas },
    despesas: { total: despesasTotal, pagas: despesasPagas, pendentes: despesasTotal - despesasPagas },
    trabalhos: { total: trabalhosTotal, realizados: trabalhosRealizados },
    extras: { receitas: extrasReceitas, gastos: extrasGastos },
    resumo_geral: {
      total_receitas: mensRecebido + extrasReceitas,
      total_despesas: despesasTotal + extrasGastos + faxinaFaltas,
      saldo: (mensRecebido + extrasReceitas) - (despesasTotal + extrasGastos + faxinaFaltas)
    }
  });
});

function getNomeMes(m) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  if (!m || !m.mes) return '';
  const idx = parseInt(m.mes) - 1;
  return (idx >= 0 && idx < 12 ? meses[idx] : m.mes) + '/' + (m.ano || '');
}

router.get('/medium/:id', (req, res) => {
  const medium = db.getById('mediuns', req.params.id);
  if (!medium) return res.status(404).json({ error: 'Médium não encontrado' });

  const nomeLower = medium.nome.toLowerCase();
  const { mes, ano } = req.query;

  const mensalidades = db.query('mensalidades', m =>
    m.medium_id === parseInt(req.params.id) || m.nome.toLowerCase().includes(nomeLower)
  ).sort((a, b) => {
    if (a.ano !== b.ano) return a.ano.localeCompare(b.ano);
    return a.mes.localeCompare(b.mes);
  });

  const faxinas = db.query('faxina', f =>
    f.medium_id === parseInt(req.params.id) || f.nome.toLowerCase().includes(nomeLower)
  ).sort((a, b) => {
    if (a.ano !== b.ano) return a.ano.localeCompare(b.ano);
    return a.mes.localeCompare(b.mes);
  });

  let totalMens = 0, pagoMens = 0;
  mensalidades.forEach(m => { totalMens += m.valor; pagoMens += m.pago; });

  let totalFaxFalta = 0;
  faxinas.forEach(f => { if (f.presenca === 'falta') totalFaxFalta += f.valor; });

  const despesas = db.getAll('despesas');
  const despesasFiltradas = mes && ano ? despesas.filter(d => d.mes === mes && d.ano === ano) : despesas;
  const despesasDetalhadas = despesasFiltradas.map(d => {
    const valParcela = d.parcela && d.parcela.includes('/') ? d.valor / (parseInt(d.parcela.split('/')[1]) || 1) : d.valor;
    const porMed = d.divisao > 0 ? valParcela / d.divisao : valParcela;
    return {
      id: d.id,
      item: d.item,
      valor_total: d.valor,
      parcela: d.parcela,
      valor_parcela: valParcela,
      divisao: d.divisao,
      por_medium: porMed,
      status: d.status,
      mes: d.mes,
      ano: d.ano
    };
  });
  const totalDespesasMedium = despesasDetalhadas.reduce((s, d) => s + d.por_medium, 0);

  const trabalhos = db.getAll('trabalhos');
  const trabalhosFiltrados = mes && ano ? trabalhos.filter(t => t.mes === mes && t.ano === ano) : trabalhos;
  const trabalhosDetalhados = trabalhosFiltrados.map(t => {
    const porMed = t.divisao > 0 ? t.valor / t.divisao : t.valor;
    return {
      id: t.id,
      entidade: t.entidade,
      valor_total: t.valor,
      divisao: t.divisao,
      por_medium: porMed,
      status: t.status,
      mes: t.mes,
      ano: t.ano
    };
  });
  const totalTrabalhosMedium = trabalhosDetalhados.reduce((s, t) => s + t.por_medium, 0);

  const extras = db.getAll('extras');
  const extrasFiltrados = mes && ano ? extras.filter(e => e.mes === mes && e.ano === ano) : extras;
  const extrasDetalhados = extrasFiltrados.map(e => {
    const valParcela = e.parcela && e.parcela.includes('/') ? e.valor / (parseInt(e.parcela.split('/')[1]) || 1) : e.valor;
    const totalItem = valParcela * (e.qtd || 1);
    const porMed = e.divisao > 0 ? totalItem / e.divisao : totalItem;
    return {
      id: e.id,
      tipo: e.tipo,
      item: e.item,
      valor_unitario: e.valor,
      parcela: e.parcela,
      qtd: e.qtd || 1,
      valor_total_item: totalItem,
      divisao: e.divisao,
      por_medium: porMed,
      mes: e.mes,
      ano: e.ano
    };
  });
  const extrasGastosMedium = extrasDetalhados.filter(e => e.tipo === 'gasto').reduce((s, e) => s + e.por_medium, 0);
  const extrasReceitasMedium = extrasDetalhados.filter(e => e.tipo === 'receita').reduce((s, e) => s + e.por_medium, 0);

  const totalCreditos = pagoMens + extrasReceitasMedium;
  const totalDebitos = totalDespesasMedium + totalTrabalhosMedium + extrasGastosMedium + totalFaxFalta;
  const saldo = totalCreditos - totalDebitos;

  res.json({
    medium,
    mensalidades,
    faxinas,
    despesas: despesasDetalhadas,
    trabalhos: trabalhosDetalhados,
    extras: extrasDetalhados,
    resumo: {
      mensalidade_total: totalMens,
      mensalidade_pago: pagoMens,
      mensalidade_pendente: totalMens - pagoMens,
      faxina_faltas: totalFaxFalta,
      despesas_total: totalDespesasMedium,
      trabalhos_total: totalTrabalhosMedium,
      extras_gastos: extrasGastosMedium,
      extras_receitas: extrasReceitasMedium,
      total_creditos: totalCreditos,
      total_debitos: totalDebitos,
      saldo: saldo
    }
  });
});

module.exports = router;
