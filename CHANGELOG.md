# Mejepra Financeiro — Checklist de Atualizações

## Sessão Atual — Resumo Completo

### 1. Correção da aba Despesas — Cálculo de Totais
**Problema:** Cards do topo (Total/Pago/Pendente) não calculavam corretamente.
- `atualizarTotais()` somava "Cada um" (valor por pessoa) em vez do valor total
- Não rastreava pagamentos individuais por médium
- Campo `pagamentos` não existia no banco

**Correções:**
- Adicionado campo `pagamentos` (JSONB) à tabela `despesas` no banco
- `atualizarTotais()` agora: soma `valor` total de cada despesa, calcula `pago` = médiums pagos × valor por pessoa, `pendente = total - pago`
- `abrirSheet()` carrega pagamentos salvos do `dataset.pagamentos`
- `salvarEdicao()` envia `pagamentos` e `divisao_mediums` completos
- `addDespesa()` inicializa `pagamentos` com todos os médiums como `false`
- Backend: rotas POST/PUT de despesas agora aceitam campo `pagamentos`

### 2. Remoção completa da aba Extras
**Problema:** Extras ficou redundante com Despesas.

**Alterações:**
- `index.html`: removido card "Extras" do grid
- `server.js`: removida rota `/api/extras`, removido 'extras' de backup/restore
- `src/database.js`: removido 'extras' do array `TABLES`
- `src/routes/dashboard.js`: removidos cálculos de extras (geral e por médium)
- `scripts/backup.js` e `scripts/restore.js`: removido 'extras' das tabelas
- `INTERFACE/service-worker.js`: removido `extras.html` do cache
- `INTERFACE/mediuns.html`: removida seção Extras do relatório

### 3. Reorganização da Home
**Alterações:**
- Grid com 3 colunas, 5 cards (Médiuns, Mensalidade, Faxina, Despesas, Trabalhos)
- Último card centralizado na segunda linha
- Dois botões de backup substituídos por **um botão "Backup"**
- Ao clicar, abre action sheet com: **Exportar Backup** e **Restaurar Backup**

### 4. Redesign da aba Trabalhos — Accordion
**Problema:** Cada trabalho gerava lista completa de médiums → tela bagunçada.

**Solução:** Sistema de cards colapsáveis (accordion)
- Cada trabalho é um card com resumo: nome, Total/Pago/Pendente, ícone chevron
- Ao clicar: expande com animação mostrando lista de médiums
- Ao clicar num médium: abre o mesmo sheet de edição (lógica preservada)
- Nada alterado em: cálculos, API calls, persistência, lógica financeira

### 5. Relatório Financeiro movido para Home
**Problema:** Botão "Relatório Financeiro" ficava dentro do modal de edição do médium.

**Alterações:**
- Criado `relatorios.html` — lista médiuns com busca, ao clicar abre relatório
- Removido botão "Relatório Financeiro" do modal de médium
- Removidos CSS e funções de relatório de `mediuns.html`
- Novo card "Relatórios" na home (ao lado de Trabalhos)
- `service-worker.js` atualizado com `relatorios.html`

### 6. Correção completa da geração de relatórios
**Problemas:**
- Trabalhos só mostravam status "realizado"
- PDF capturava página inteira (busca, scroll, header)
- WhatsApp usava dados antigos/travados
- Múltiplas fontes de dados

**Solução — Fonte única de dados:**
- `gerarRelatorioData(id)` — função central que busca e normaliza TODOS os dados
- `abrirRelatorio()` — renderiza tela usando dados centralizados
- `gerarPDF()` — `window.print()` com `@media print` que esconde header/footer/nav
- `compartilharWhatsApp()` — gera texto EXATAMENTE dos mesmos dados centralizados
- Backend: `dashboard.js` agora retorna TODOS os trabalhos (filtro `divisao > 0`), não apenas pagos

### 7. Correção dos valores de Trabalhos no relatório
**Problema:** Relatório usava lógica antiga `porMed = t.valor / t.divisao`

**Correção:** `porMed = t.valor` — valor já é por médium, sem recalcular divisão

### 8. Sistema de parcelamento real para Despesas
**Problema:** Parcelamento era apenas informativo — só criava registro no mês atual.

**Solução:** Geração automática de registros futuros
- Novos campos no banco: `parcela_atual`, `total_parcelas`, `despesa_original_id`
- POST `/despesas`: se `total_parcelas > 1`, gera N registros (um por mês futuro)
- Cada parcela tem valor = valor_total / total_parcelas
- DELETE: exclui todas as parcelas relacionadas (cascade)
- PUT: recalcula todas as parcelas futuras ao editar
- Frontend: input numérico "Qtd parcelas" em vez de texto "1/3"
- Display: mostra "1/3", "2/3", "3/3" automaticamente

---

## Arquivos alterados nesta sessão

| Arquivo | Alteração |
|---------|-----------|
| `INTERFACE/despesas.html` | Cálculo de totais, campo pagamentos |
| `INTERFACE/index.html` | Grid 5 cards, botão backup unificado |
| `INTERFACE/trabalhos.html` | Accordion cards |
| `INTERFACE/relatorios.html` | Nova página (criada) |
| `INTERFACE/mediuns.html` | Removido botão relatório, CSS e funções |
| `INTERFACE/service-worker.js` | Cache atualizado |
| `server.js` | Removida rota extras, backup sem extras |
| `src/database.js` | Campo pagamentos em despesas, TABLES sem extras |
| `src/routes/despesas.js` | POST/PUT com pagamentos |
| `src/routes/dashboard.js` | Sem extras, trabalhos sem filtro de pago, valor direto |
| `scripts/backup.js` | Sem extras |
| `scripts/restore.js` | Sem extras |

---

## Próximos passos / Pendências

- [ ] Testar relatório com dados reais após deploy
- [ ] Verificar se PDF gera corretamente em mobile
- [ ] Validar compartilhamento WhatsApp com dados completos
- [ ] Monitorar performance com muitos trabalhos no accordion
