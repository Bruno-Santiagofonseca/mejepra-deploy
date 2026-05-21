# Template de Projeto Node + Express + SQLite

Este template é um exemplo de projeto local, separado do banco de dados da cliente.
Use-o para demonstração e aprendizado sem misturar dados reais.

## Estrutura
- `src/server.js` → inicializa o servidor Express
- `src/config/index.js` → lê variáveis de ambiente
- `src/db/index.js` → conecta ao banco SQLite local
- `src/routes/mediuns.routes.js` → define rotas de exemplo
- `src/middleware/errorHandler.js` → tratamento de erro global
- `scripts/` → scripts auxiliares, se necessário

## Instalação

```bash
cd template
npm install
cp .env.example .env
```

## Executar localmente

```bash
npm start
```

Abra `http://localhost:3001/api/mediuns` para ver a lista.

## Testar endpoints

- `GET /api/mediuns`
- `POST /api/mediuns`
- `PUT /api/mediuns/:id`
- `DELETE /api/mediuns/:id`

## Observações
- O banco local é gerado em `data/template.db`
- Não há conexão remota por padrão
- Você pode mostrar o template para outras pessoas sem usar o banco da cliente
