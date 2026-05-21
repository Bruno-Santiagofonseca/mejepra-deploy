# Padrão de Projeto - Mejepra

Este documento serve como base para criar novos projetos no mesmo estilo, evitando erros comuns observados no projeto atual.

## 1. Análise do projeto atual

### 1.1 O que estava errado
- O backend usava um banco de dados local (`sql.js` + `data/mejepra.db`) no ambiente de produção. Em hosts como Render, o disco é efêmero, então os dados não persistem entre deploys.
- O projeto misturava lógica de dados diretamente nas rotas, sem camada de serviço ou repositório clara.
- Não havia validação de entrada consistente em rotas; era possível receber dados inválidos e persistir erros.
- O `server.js` chamava `db.migrateFromJSON()` sem aguardar o término antes de iniciar outras operações.
- O projeto não tinha tratamento de erro centralizado no Express.
- A configuração do ambiente estava embutida no código, sem um módulo de configuração central e sem `.env.example` original claro.
- O layout das rotas era redundante: cada arquivo de rota repete a mesma estrutura sem abstração.
- O front-end da PWA usava um `service-worker` muito básico, sem estratégia de sincronização offline.
- Não existia documentação técnica de padrões, estrutura e uso de variáveis de ambiente.

### 1.2 O que foi corrigido
- Adicionado suporte a `DATABASE_URL` e `pg` para Postgres quando disponível.
- Mantido fallback local para SQLite somente em desenvolvimento.
- Criados scripts de backup e restore.
- Atualizados endpoints para async/await.

## 2. Estrutura recomendada

Sugestão de estrutura de diretórios para novos projetos:

```
/ (root)
  package.json
  render.yaml
  README.md
  .env.example
  .gitignore
  /src
    /config
      index.js
    /db
      index.js
      postgres.js
      sqlite.js
    /controllers
      mediuns.controller.js
      despesas.controller.js
      ...
    /routes
      mediuns.routes.js
      despesas.routes.js
      ...
    /services
      mediuns.service.js
      despesas.service.js
      ...
    /middleware
      errorHandler.js
      validateRequest.js
    /utils
      logger.js
      validationSchemas.js
    server.js
  /public  (ou /INTERFACE)
    index.html
    ...
  /scripts
    backup.js
    restore.js
  /tests
    unit/
    integration/
```

## 3. Configuração e ambiente

### 3.1 Variáveis de ambiente
- Nunca use caminho de arquivo local como chave de variável.
- Use apenas nomes válidos: letras, números, `_`, `-`, `.`.
- Exemplo:
  - `DATABASE_URL`
  - `NODE_ENV`
  - `PORT`
  - `SUPABASE_SERVICE_ROLE_KEY` (se necessário)

### 3.2 `.env.example`
Inclua sempre um arquivo `.env.example` com as variáveis obrigatórias, sem valores reais.

### 3.3 Dados sensíveis
- Não commit secrets no código.
- No Render, coloque `DATABASE_URL` em `Environment Variables`.
- No Supabase, use a connection string do banco Postgres.

## 4. Banco de dados

### 4.1 Escolha do banco
- Em produção, use um banco gerenciado (Postgres, Supabase, Render Postgres, etc.).
- Em desenvolvimento local, use SQLite ou outra solução leve.
- Não use arquivo local como fonte exclusiva em produção.

### 4.2 Camada de acesso a dados
- Crie um adaptador de banco de dados em `src/db/`.
- Separe `postgres.js` e `sqlite.js`.
- Exporte uma interface comum: `getAll`, `getById`, `insert`, `update`, `delete`, `query`.
- Não deixe SQL cru espalhado pelas rotas.

### 4.3 Migração e seed
- Use migrações ou um script de inicialização controlado.
- Em vez de `migrateFromJSON()` automático na inicialização, prefira rodar migração separada ou scripts de bootstrap.

## 5. API e rotas

### 5.1 Roteamento
- Use `src/routes/*.js` apenas para definir rotas.
- A lógica de negócio deve ser chamada a partir de `src/controllers` ou `src/services`.

### 5.2 Validação de dados
- Use bibliotecas como `joi`, `zod` ou `yup`.
- Valide `req.body`, `req.params` e `req.query` antes de processar.
- Retorne erros `400` claros para dados inválidos.

### 5.3 Tratamento de erros
- Adicione middleware de erro centralizado em `src/middleware/errorHandler.js`.
- Não repita try/catch em todas as rotas sem padronização.
- Use `next(err)` para passar o erro ao middleware.

### 5.4 Versionamento de API
- Use prefixo de versão: `/api/v1/mediuns`.
- Facilita futuras mudanças sem quebrar clientes antigos.

## 6. Boas práticas de código

### 6.1 Consistência
- Use um estilo consistente de indentação e nomenclatura.
- Prefira `camelCase` para variáveis e funções.
- Use nomes de arquivos claros e alinhados ao conteúdo.

### 6.2 Modulação
- Evite arquivos muito grandes.
- Separe responsabilidade: rota, controle, serviço, repositório.

### 6.3 Documentação
- Mantenha `README.md` atualizado com:
  - instalação
  - execução local
  - deploy
  - variáveis de ambiente
  - endpoints principais

## 7. Implantação

### 7.1 Render / cloud
- `render.yaml` deve conter `buildCommand` e `startCommand`.
- Use variáveis de ambiente para credenciais.
- Não conte com sistema de arquivos local para persistência de dados.

### 7.2 Backup e restore
- Tenha endpoints de backup/restore apenas para manutenção.
- Antes de migrar, sempre gere backup.
- Exemplo:
  - `GET /api/backup`
  - `POST /api/restore`

## 8. Cliente e PWA

### 8.1 Static files
- Armazene HTML/JS/CSS em pasta dedicada (`public` ou `INTERFACE`).
- Configure cache-control para recursos estáticos.

### 8.2 Service Worker
- Use service worker apenas para cache de recursos estáticos ou para offline com estratégia clara.
- Se precisar offline de verdade, implemente sincronização de dados e retry de requisições.

## 9. Checklist para novo projeto

- [ ] Estrutura de pastas definida
- [ ] `README.md` e `.env.example` criados
- [ ] Módulo de configuração central (`src/config/index.js`)
- [ ] Banco de dados em `src/db/` separado por adapter
- [ ] Rotas em `src/routes/`, lógica em `src/controllers/` e `src/services/`
- [ ] Validação de request implementada
- [ ] Middleware de erro global presente
- [ ] Deploy configurado com `DATABASE_URL`
- [ ] Documentação de endpoint e backup
- [ ] Dependências mínimas e relevantes

## 10. Conclusão

Ao seguir este padrão, você reduz os riscos de:
- dados perdidos em produção
- configuração errada de variáveis de ambiente
- duplicação de lógica
- rotas frágeis e vulneráveis
- dificuldade de manutenção

Use este documento como base e adapte-o ao estilo do seu time. Se quiser, posso também transformar isso em um template de projeto real com arquivos e pastas já criados.   