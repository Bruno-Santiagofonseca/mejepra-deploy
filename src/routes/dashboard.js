const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
  const mediunsAtivos = (await db.query('mediuns', m => m.status === 'Ativo')).length;
  const mediunsInativos = (await db.query('mediuns', m => m.status === 'Inativo')).length;

  const mensalidades = await db.getAll('mensalidades');
  const mensPrevisto = mensalidades.reduce((s, m) => s + m.valor, 0);
  const mensRecebido = mensalidades.reduce((s, m) => s + m.pago, 0);

  const faxinas = await db.getAll('faxina');
  const faxinaFaltas = faxinas.filter(f => f.presenca === 'falta').reduce((s, f) => s + f.valor, 0);
  const faxinaFeitas = faxinas.filter(f => f.presenca === 'feito').length;

  const despesas = await db.getAll('despesas');
  const despesasTotal = despesas.reduce((s, d) => s + d.valor, 0);
  const despesasPagas = despesas.filter(d => d.status === 'paga').reduce((s, d) => s + d.valor, 0);

  const trabalhos = await db.getAll('trabalhos');
  const trabalhosTotal = trabalhos.reduce((s, t) => s + t.valor, 0);
  const trabalhosRealizados = trabalhosTotal;

  res.json({
    mediuns: { ativos: mediunsAtivos, inativos: mediunsInativos },
    mensalidades: { previsto: mensPrevisto, recebido: mensRecebido, pendente: mensPrevisto - mensRecebido },
    faxina: { total_faltas_valor: faxinaFaltas, feitas: faxinaFeitas },
    despesas: { total: despesasTotal, pagas: despesasPagas, pendentes: despesasTotal - despesasPagas },
    trabalhos: { total: trabalhosTotal, realizados: trabalhosRealizados },
    resumo_geral: {
      total_receitas: mensRecebido,
      total_despesas: despesasTotal + faxinaFaltas,
      saldo: mensRecebido - (despesasTotal + faxinaFaltas)
    }
  });
});

function getNomeMes(m) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  if (!m || !m.mes) return '';
  const idx = parseInt(m.mes) - 1;
  return (idx >= 0 && idx < 12 ? meses[idx] : m.mes) + '/' + (m.ano || '');
}

router.get('/medium/:id', async (req, res) => {
  const medium = await db.getById('mediuns', req.params.id);
  if (!medium) return res.status(404).json({ error: 'Médium não encontrado' });

  const { mes, ano } = req.query;

  const mensalidades = (await db.query('mensalidades', m => m.medium_id === parseInt(req.params.id, 10))).sort((a, b) => {
    if ((a.ano || '') !== (b.ano || '')) return (a.ano || '').localeCompare(b.ano || '');
    return a.mes.localeCompare(b.mes);
  });

  const faxinas = (await db.query('faxina', f => f.medium_id === parseInt(req.params.id, 10))).sort((a, b) => {
    if ((a.ano || '') !== (b.ano || '')) return (a.ano || '').localeCompare(b.ano || '');
    return a.mes.localeCompare(b.mes);
  });

  let totalMens = 0, pagoMens = 0;
  mensalidades.forEach(m => { totalMens += m.valor; pagoMens += m.pago; });

  let totalFaxFalta = 0;
  faxinas.forEach(f => { if (f.presenca === 'falta') totalFaxFalta += f.valor; });

  const mediumId = parseInt(req.params.id, 10);

  const despesas = await db.getAll('despesas');
  const despesasFiltradas = (mes && ano ? despesas.filter(d => d.mes === mes && d.ano === ano) : despesas)
    .filter(d => {
      try {
        const dm = typeof d.divisao_mediums === 'string' ? JSON.parse(d.divisao_mediums) : (d.divisao_mediums || []);
        return dm.includes(mediumId);
      } catch { return d.divisao > 0; }
    });
  const despesasDetalhadas = despesasFiltradas.map(d => {
    const valParcela = d.parcela && d.parcela.includes('/') ? d.valor / (parseInt(d.parcela.split('/')[1], 10) || 1) : d.valor;
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

  const trabalhos = await db.getAll('trabalhos');
  const trabalhosFiltrados = (mes && ano ? trabalhos.filter(t => t.mes === mes && t.ano === ano) : trabalhos)
    .filter(t => t.divisao > 0);
  const trabalhosDetalhados = trabalhosFiltrados.map(t => {
    const porMed = t.valor;
    const pagamentos = typeof t.pagamentos === 'string' ? JSON.parse(t.pagamentos) : (t.pagamentos || {});
    const pago = pagamentos[String(mediumId)] === true;
    return {
      id: t.id,
      entidade: t.entidade,
      valor_total: t.valor * t.divisao,
      divisao: t.divisao,
      por_medium: porMed,
      status: pago ? 'pago' : (t.status || 'pendente'),
      mes: t.mes,
      ano: t.ano
    };
  });
  const totalTrabalhosMedium = trabalhosDetalhados.reduce((s, t) => s + t.por_medium, 0);

  const totalCreditos = pagoMens;
  const totalDebitos = totalDespesasMedium + totalTrabalhosMedium + totalFaxFalta;
  const saldo = totalCreditos - totalDebitos;

  res.json({
    medium,
    mensalidades,
    faxinas,
    despesas: despesasDetalhadas,
    trabalhos: trabalhosDetalhados,
    resumo: {
      mensalidade_total: totalMens,
      mensalidade_pago: pagoMens,
      mensalidade_pendente: totalMens - pagoMens,
      faxina_faltas: totalFaxFalta,
      despesas_total: totalDespesasMedium,
      trabalhos_total: totalTrabalhosMedium,
      total_creditos: totalCreditos,
      total_debitos: totalDebitos,
      saldo: saldo
    }
  });
});

module.exports = router;
