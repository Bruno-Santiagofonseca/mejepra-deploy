const express = require('express');
const router = express.Router();
const db = require('../database');

function terreiro(req) { return req.user.terreiro_id; }

router.get('/', async (req, res) => {
  const tid = terreiro(req);
  const hoje = new Date();
  const mes = req.query.mes || String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = req.query.ano || String(hoje.getFullYear());

  const mediunsAtivos = (await db.query('mediuns', m => m.status === 'Ativo' && m.terreiro_id === tid)).length;
  const mediunsInativos = (await db.query('mediuns', m => m.status === 'Inativo' && m.terreiro_id === tid)).length;

  let mensalidades = await db.query('mensalidades', m => m.terreiro_id === tid);
  mensalidades = mensalidades.filter(m => m.mes === mes && m.ano === ano);
  const mensPrevisto = mensalidades.reduce((s, m) => s + m.valor, 0);
  const mensRecebido = mensalidades.reduce((s, m) => s + m.pago, 0);

  let faxinas = await db.query('faxina', f => f.terreiro_id === tid);
  faxinas = faxinas.filter(f => f.mes === mes && f.ano === ano);
  const faxinaFaltas = faxinas.filter(f => f.presenca === 'falta').reduce((s, f) => s + f.valor, 0);
  const faxinaFeitas = faxinas.filter(f => f.presenca === 'feito').length;

  let despesas = await db.query('despesas', d => d.terreiro_id === tid);
  despesas = despesas.filter(d => d.mes === mes && d.ano === ano);
  const despesasTotal = despesas.reduce((s, d) => s + d.valor, 0);
  const despesasPagas = despesas.filter(d => d.status === 'paga').reduce((s, d) => s + d.valor, 0);

  let trabalhos = await db.query('trabalhos', t => t.terreiro_id === tid);
  trabalhos = trabalhos.filter(t => t.mes === mes && t.ano === ano);
  const trabalhosTotal = trabalhos.reduce((s, t) => s + (t.valor * t.divisao), 0);

  res.json({
    mes,
    ano,
    mediuns: { ativos: mediunsAtivos, inativos: mediunsInativos },
    mensalidades: { previsto: mensPrevisto, recebido: mensRecebido, pendente: mensPrevisto - mensRecebido },
    faxina: { total_faltas_valor: faxinaFaltas, feitas: faxinaFeitas },
    despesas: { total: despesasTotal, pagas: despesasPagas, pendentes: despesasTotal - despesasPagas },
    trabalhos: { total: trabalhosTotal },
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
  if (!medium || medium.deleted_at || medium.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Médium não encontrado' });

  const { mes, ano } = req.query;

  const rawMensalidades = await db.query('mensalidades', m => m.medium_id === parseInt(req.params.id, 10) && m.terreiro_id === terreiro(req));

  // Agrupar e deduplicar mensalidades por mes/ano
  const uniqueMensalidadesMap = {};
  rawMensalidades.forEach(m => {
    const key = `${m.ano || ''}-${m.mes || ''}`;
    if (!uniqueMensalidadesMap[key] || m.pago > uniqueMensalidadesMap[key].pago || (m.pago === uniqueMensalidadesMap[key].pago && m.id > uniqueMensalidadesMap[key].id)) {
      uniqueMensalidadesMap[key] = m;
    }
  });

  const mensalidades = Object.values(uniqueMensalidadesMap);
  let mensalidadesFiltradas = (mes && ano ? mensalidades.filter(m => m.mes === mes && m.ano === ano) : mensalidades);

  const mediumId = parseInt(req.params.id, 10);
  if (mensalidadesFiltradas.length === 0 && medium && mes && ano) {
    let defaultValor = 0;
    if (mensalidades.length > 0) {
      const mensalidadesOrdenadas = [...mensalidades].sort((a, b) => {
        if ((b.ano || '') !== (a.ano || '')) return (b.ano || '').localeCompare(a.ano || '');
        return (b.mes || '').localeCompare(a.mes || '');
      });
      defaultValor = mensalidadesOrdenadas[0].valor || 0;
    }
    mensalidadesFiltradas.push({
      id: null,
      medium_id: mediumId,
      nome: medium.nome,
      valor: defaultValor,
      pago: 0,
      status: 'pendente',
      mes: mes,
      ano: ano
    });
  }

  mensalidadesFiltradas.sort((a, b) => {
    if ((a.ano || '') !== (b.ano || '')) return (a.ano || '').localeCompare(b.ano || '');
    return a.mes.localeCompare(b.mes);
  });

  const faxinas = await db.query('faxina', f => f.medium_id === mediumId && f.terreiro_id === terreiro(req));
  const faxinasFiltradas = (mes && ano ? faxinas.filter(f => f.mes === mes && f.ano === ano) : faxinas)
    .sort((a, b) => {
      if ((a.ano || '') !== (b.ano || '')) return (a.ano || '').localeCompare(b.ano || '');
      return a.mes.localeCompare(b.mes);
    });

  let totalMens = 0, pagoMens = 0;
  mensalidadesFiltradas.forEach(m => { totalMens += m.valor; pagoMens += m.pago; });

  let totalFaxFalta = 0;
  faxinasFiltradas.forEach(f => { if (f.presenca === 'falta') totalFaxFalta += f.valor; });

  const despesas = await db.query('despesas', d => d.terreiro_id === terreiro(req));
  const despesasFiltradas = (mes && ano ? despesas.filter(d => d.mes === mes && d.ano === ano) : despesas)
    .filter(d => {
      try {
        const dm = typeof d.divisao_mediums === 'string' ? JSON.parse(d.divisao_mediums) : (d.divisao_mediums || []);
        return dm.includes(mediumId);
      } catch { return d.divisao > 0; }
    });

  let pagoDespesas = 0;
  const despesasDetalhadas = despesasFiltradas.map(d => {
    const valParcela = d.valor;
    const porMed = d.divisao > 0 ? valParcela / d.divisao : valParcela;
    const pagamentos = typeof d.pagamentos === 'string' ? JSON.parse(d.pagamentos) : (d.pagamentos || {});
    const pago = pagamentos[String(mediumId)] === true;
    if (pago) {
      pagoDespesas += porMed;
    }
    return {
      id: d.id,
      item: d.item,
      valor_total: d.valor * (d.total_parcelas || 1),
      parcela: d.parcela,
      valor_parcela: valParcela,
      divisao: d.divisao,
      por_medium: porMed,
      status: pago ? 'pago' : 'aberta',
      mes: d.mes,
      ano: d.ano
    };
  });
  const totalDespesasMedium = despesasDetalhadas.reduce((s, d) => s + d.por_medium, 0);

  const trabalhos = await db.query('trabalhos', t => t.terreiro_id === terreiro(req));
  const trabalhosFiltrados = (mes && ano ? trabalhos.filter(t => t.mes === mes && t.ano === ano) : trabalhos)
    .filter(t => t.divisao > 0);

  let pagoTrabalhos = 0;
  const trabalhosDetalhados = trabalhosFiltrados.map(t => {
    const porMed = t.valor;
    const pagamentos = typeof t.pagamentos === 'string' ? JSON.parse(t.pagamentos) : (t.pagamentos || {});
    const pago = pagamentos[String(mediumId)] === true;
    if (pago) {
      pagoTrabalhos += porMed;
    }
    return {
      id: t.id,
      entidade: t.entidade,
      valor_total: t.valor * t.divisao,
      valor_por_medium: t.valor,
      divisao: t.divisao,
      por_medium: porMed,
      status: pago ? 'pago' : (t.status || 'pendente'),
      mes: t.mes,
      ano: t.ano
    };
  });
  const totalTrabalhosMedium = trabalhosDetalhados.reduce((s, t) => s + t.por_medium, 0);

  const totalCreditos = pagoMens + pagoDespesas + pagoTrabalhos;
  const totalDebitos = totalDespesasMedium + totalTrabalhosMedium + totalFaxFalta + totalMens;
  const saldo = totalCreditos - totalDebitos;

  res.json({
    medium,
    mensalidades: mensalidadesFiltradas,
    faxinas: faxinasFiltradas,
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
