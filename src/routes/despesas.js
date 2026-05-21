const express = require('express');
const router = express.Router();
const db = require('../database');

function getMesAnoOffset(mesStr, anoStr, offset) {
  const meses = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  let mes = parseInt(mesStr) - 1 + offset;
  let ano = parseInt(anoStr);
  while (mes < 0) { mes += 12; ano--; }
  while (mes > 11) { mes -= 12; ano++; }
  return { mes: meses[mes], ano: String(ano) };
}

router.get('/', async (req, res) => {
  const { mes, ano } = req.query;
  let data = await db.getAll('despesas');
  if (mes && ano) data = data.filter(d => d.mes === mes && d.ano === ano);
  res.json(data.sort((a, b) => a.item.localeCompare(b.item)));
});

router.get('/:id', async (req, res) => {
  const desp = await db.getById('despesas', req.params.id);
  if (!desp) return res.status(404).json({ error: 'Despesa não encontrada' });
  res.json(desp);
});

router.post('/', async (req, res) => {
  const { item, valor, parcela, divisao, status, mes, ano, divisao_mediums, pagamentos, total_parcelas } = req.body;
  if (!item || valor === undefined) return res.status(400).json({ error: 'Item e valor são obrigatórios' });

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
      despesa_original_id: null
    });

    if (isOriginal) {
      await db.update('despesas', desp.id, { despesa_original_id: desp.id });
      desp.despesa_original_id = desp.id;
    } else {
      const firstDesp = created[0];
      await db.update('despesas', desp.id, { despesa_original_id: firstDesp.id });
      desp.despesa_original_id = firstDesp.id;
    }

    created.push(desp);
  }

  res.status(201).json(created);
});

router.put('/:id', async (req, res) => {
  const existing = await db.getById('despesas', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' });

  const { item, valor, parcela, divisao, status, mes, ano, divisao_mediums, pagamentos, total_parcelas } = req.body;

  const originalId = existing.despesa_original_id || existing.id;
  const allRelated = await db.query('despesas', d => d.despesa_original_id === originalId || d.id === originalId);

  const numParcelas = parseInt(total_parcelas) || existing.total_parcelas || 1;
  const newValor = valor !== undefined ? valor : existing.valor;
  const valorParcela = newValor / numParcelas;

  for (let i = 0; i < numParcelas; i++) {
    const mesAno = getMesAnoOffset(mes || existing.mes, ano || existing.ano, i);
    const parcelaStr = `${i + 1}/${numParcelas}`;

    if (i < allRelated.length) {
      const existingParcela = allRelated[i];
      await db.update('despesas', existingParcela.id, {
        item: item !== undefined ? item : existingParcela.item,
        valor: valorParcela,
        parcela: parcelaStr,
        divisao: divisao !== undefined ? divisao : existingParcela.divisao,
        status: status !== undefined ? status : existingParcela.status,
        mes: mesAno.mes,
        ano: mesAno.ano,
        divisao_mediums: divisao_mediums !== undefined ? divisao_mediums : existingParcela.divisao_mediums,
        pagamentos: pagamentos !== undefined ? pagamentos : existingParcela.pagamentos,
        parcela_atual: i + 1,
        total_parcelas: numParcelas
      });
    } else {
      await db.insert('despesas', {
        item: item !== undefined ? item : existing.item,
        valor: valorParcela,
        parcela: parcelaStr,
        divisao: divisao !== undefined ? divisao : existing.divisao,
        status: status !== undefined ? status : existing.status,
        mes: mesAno.mes,
        ano: mesAno.ano,
        divisao_mediums: divisao_mediums !== undefined ? divisao_mediums : existing.divisao_mediums,
        pagamentos: pagamentos !== undefined ? pagamentos : existing.pagamentos,
        parcela_atual: i + 1,
        total_parcelas: numParcelas,
        despesa_original_id: originalId
      });
    }
  }

  const updated = await db.getById('despesas', req.params.id);
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const existing = await db.getById('despesas', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' });

  const originalId = existing.despesa_original_id || existing.id;
  const allRelated = await db.query('despesas', d => d.despesa_original_id === originalId || d.id === originalId);

  for (const d of allRelated) {
    await db.delete('despesas', d.id);
  }

  res.json({ message: 'Despesa e parcelas excluídas com sucesso' });
});

module.exports = router;
