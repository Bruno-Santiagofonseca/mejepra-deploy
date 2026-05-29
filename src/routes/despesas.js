const express = require('express');
const router = express.Router();
const db = require('../database');
const { authorize } = require('../middleware/rbac');

function getMesAnoOffset(mesStr, anoStr, offset) {
  const meses = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  let mes = parseInt(mesStr) - 1 + offset;
  let ano = parseInt(anoStr);
  while (mes < 0) { mes += 12; ano--; }
  while (mes > 11) { mes -= 12; ano++; }
  return { mes: meses[mes], ano: String(ano) };
}

function terreiro(req) { return req.user.terreiro_id; }

router.get('/', async (req, res) => {
  const tid = terreiro(req);
  const { mes, ano } = req.query;
  let data = await db.query('despesas', d => d.terreiro_id === tid);
  if (mes && ano) data = data.filter(d => d.mes === mes && d.ano === ano);
  res.json(data.sort((a, b) => a.item.localeCompare(b.item)));
});

router.get('/:id', async (req, res) => {
  const desp = await db.getById('despesas', req.params.id);
  if (!desp || desp.deleted_at || desp.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Despesa não encontrada' });
  res.json(desp);
});

router.post('/', async (req, res) => {
  const tid = terreiro(req);
  const { item, valor, parcela, divisao, status, mes, ano, divisao_mediums, pagamentos, total_parcelas } = req.body;
  if (!item || valor === undefined) return res.status(400).json({ error: 'Item e valor são obrigatórios' });

  if (mes && ano && db.isPeriodLocked(mes, ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível modificar meses anteriores.' });

  const numParcelas = parseInt(total_parcelas) || 1;
  const valorParcela = valor / numParcelas;
  const created = [];

  for (let i = 0; i < numParcelas; i++) {
    const mesAno = getMesAnoOffset(mes || '01', ano || String(new Date().getFullYear()), i);
    const parcelaStr = `${i + 1}/${numParcelas}`;
    const isOriginal = i === 0;

    const desp = await db.insert('despesas', {
      item,
      valor: valorParcela,
      parcela: parcelaStr,
      divisao: divisao || 1,
      status: status || 'aberta',
      mes: mesAno.mes,
      ano: mesAno.ano,
      divisao_mediums: divisao_mediums || [],
      pagamentos: pagamentos || {},
      parcela_atual: i + 1,
      total_parcelas: numParcelas,
      despesa_original_id: null,
      terreiro_id: tid
    }, req.user);

    if (isOriginal) {
      await db.update('despesas', desp.id, { despesa_original_id: desp.id }, req.user);
      desp.despesa_original_id = desp.id;
    } else {
      const firstDesp = created[0];
      await db.update('despesas', desp.id, { despesa_original_id: firstDesp.id }, req.user);
      desp.despesa_original_id = firstDesp.id;
    }

    created.push(desp);
  }

  res.status(201).json(created);
});

router.put('/:id', async (req, res) => {
  const existing = await db.getById('despesas', req.params.id);
  if (!existing || existing.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Despesa não encontrada' });

  const { item, valor, divisao, status, mes, ano, divisao_mediums, pagamentos, total_parcelas } = req.body;

  const originalId = existing.despesa_original_id || existing.id;
  const allRelated = await db.query('despesas', d => d.despesa_original_id === originalId || d.id === originalId);

  for (var rel of allRelated) {
    if (db.isPeriodLocked(rel.mes, rel.ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível modificar parcelas de meses anteriores.' });
  }

  // Bug 4: garantir ordenação correta por parcela_atual antes de iterar
  allRelated.sort((a, b) => (a.parcela_atual || 1) - (b.parcela_atual || 1));

  const numParcelas = parseInt(total_parcelas) || existing.total_parcelas || 1;
  // Bug 1: valor recebido do frontend é sempre o valor TOTAL da despesa
  // Se não enviado, reconstrói o total a partir do valor da parcela armazenado
  const valorTotal = valor !== undefined ? valor : existing.valor * (existing.total_parcelas || 1);
  const valorParcela = valorTotal / numParcelas;

  const targetId = parseInt(req.params.id);

  // Evitar que as parcelas sejam movidas ao editar a partir de um mês específico.
  // A data de início real da primeira parcela (ou o primeiro registro do grupo) deve ser a âncora.
  const isFirstParcel = existing.parcela_atual === 1;
  const firstParcel = allRelated.find(d => d.parcela_atual === 1) || allRelated[0] || existing;
  const mesInicio = isFirstParcel && mes ? mes : firstParcel.mes;
  const anoInicio = isFirstParcel && ano ? ano : firstParcel.ano;

  for (let i = 0; i < numParcelas; i++) {
    const mesAno = getMesAnoOffset(mesInicio, anoInicio, i);
    const parcelaStr = `${i + 1}/${numParcelas}`;

    if (i < allRelated.length) {
      const existingParcela = allRelated[i];
      // Bug 2: pagamentos e status só são atualizados na parcela alvo (mês que está sendo editado)
      const isTargetParcel = existingParcela.id === targetId;
      await db.update('despesas', existingParcela.id, {
        item: item !== undefined ? item : existingParcela.item,
        valor: valorParcela,
        parcela: parcelaStr,
        divisao: divisao !== undefined ? divisao : existingParcela.divisao,
        status: isTargetParcel && status !== undefined ? status : existingParcela.status,
        mes: mesAno.mes,
        ano: mesAno.ano,
        divisao_mediums: divisao_mediums !== undefined ? divisao_mediums : existingParcela.divisao_mediums,
        pagamentos: isTargetParcel && pagamentos !== undefined ? pagamentos : existingParcela.pagamentos,
        parcela_atual: i + 1,
        total_parcelas: numParcelas
      }, req.user);
    } else {
      await db.insert('despesas', {
        item: item !== undefined ? item : existing.item,
        valor: valorParcela,
        parcela: parcelaStr,
        divisao: divisao !== undefined ? divisao : existing.divisao,
        status: existing.status,
        mes: mesAno.mes,
        ano: mesAno.ano,
        divisao_mediums: divisao_mediums !== undefined ? divisao_mediums : existing.divisao_mediums,
        pagamentos: {},
        parcela_atual: i + 1,
        total_parcelas: numParcelas,
        despesa_original_id: originalId
      }, req.user);
    }
  }

  const updated = await db.getById('despesas', req.params.id);
  res.json(updated);
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  const existing = await db.getById('despesas', req.params.id);
  if (!existing || existing.terreiro_id !== terreiro(req)) return res.status(404).json({ error: 'Despesa não encontrada' });

  const originalId = existing.despesa_original_id || existing.id;
  const allRelated = await db.query('despesas', d => d.despesa_original_id === originalId || d.id === originalId);

  for (var d of allRelated) {
    if (db.isPeriodLocked(d.mes, d.ano)) return res.status(403).json({ error: 'Período bloqueado. Não é possível excluir parcelas de meses anteriores.' });
  }

  for (var d of allRelated) {
    await db.delete('despesas', d.id, req.user);
  }

  res.json({ message: 'Despesa e parcelas excluídas com sucesso' });
});

module.exports = router;
