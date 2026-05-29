# Mejepra Financeiro

Sistema de gestão financeira para centro espírita.

## Funcionalidades

- **Médiuns** — Cadastro e gestão de médiuns
- **Mensalidade** — Controle de mensalidades por médium
- **Faxina** — Registro de presenças e faltas na faxina
- **Despesas** — Despesas divididas entre médiuns com controle de pagamento individual
- **Trabalhos** — Trabalhos espirituais com rateio e acompanhamento de pagamentos (cards expansíveis)
- **Relatórios** — Relatório financeiro completo por médium (tela, PDF, WhatsApp)
- **Backup** — Exportar e restaurar dados em JSON

## Últimas atualizações

- Correção do cálculo de totais na aba Despesas (valor total, pago, pendente)
- Remoção da aba Extras (redundante com Despesas)
- Redesign da aba Trabalhos com cards accordion expansíveis
- Relatório Financeiro movido para card na Home
- Geração de relatórios com fonte única de dados (tela, PDF, WhatsApp sincronizados)
- Correção dos valores de Trabalhos no relatório (sem recalcular divisão)

## Como usar

### 1. Definir o banco no Render
No painel do serviço, configure a variável de ambiente:

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
```

### 2. Fazer backup antes da mudança
Use o endpoint do app em produção:

```bash
curl -L https://<seu-domínio>/api/backup -o backup-mejepra.json
```

Ou localmente:

```bash
npm run backup
```

### 3. Restaurar dados
Use o endpoint de restore no novo banco:

```bash
curl -X POST https://<seu-domínio>/api/restore \
  -H "Content-Type: application/json" \
  --data-binary @backup-mejepra.json
```

### 4. Scripts locais
- `npm run backup` → cria `data/backup-mejepra-YYYY-MM-DD.json`
- `npm run restore <arquivo>` → restaura o backup local

### 5. Executar o servidor

```bash
npm install
npm start
```
