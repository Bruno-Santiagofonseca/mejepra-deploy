# Centro360 Financeiro

Sistema de gestão financeira para centros espíritas. Controle de médiuns, mensalidades, faxina, despesas, trabalhos e relatórios.

---

## 🚀 Rodando Localmente

### Pré-requisitos
- Node.js 18+
- npm

### Instalação

```bash
# Clone o repositório
git clone https://github.com/SEU_USUARIO/centro360.git
cd centro360

# Instale as dependências
npm install

# Configure o ambiente
cp .env.example .env
# Edite o .env com seus valores

# Inicie o servidor
npm start
```

Acesse: **http://localhost:3000**

No primeiro acesso, crie uma conta na tela de login.

---

## ☁️ Deploy no Render (gratuito)

### Passo a Passo

**1. Suba o código para o GitHub**
```bash
git add .
git commit -m "deploy inicial"
git push origin main
```

**2. Crie a conta no Render**
Acesse [render.com](https://render.com) e conecte com sua conta GitHub.

**3. Crie o banco PostgreSQL**
- No painel do Render → **New** → **PostgreSQL**
- Nome: `centro360-db`
- Plano: **Free**
- Clique em **Create Database**
- Aguarde o banco ficar disponível e **copie o Internal Database URL**

**4. Crie o Web Service**
- No painel do Render → **New** → **Web Service**
- Conecte ao repositório GitHub
- Configure:
  - **Name:** `centro360-financeiro`
  - **Environment:** `Node`
  - **Build Command:** `npm install`
  - **Start Command:** `node server.js`
  - **Plan:** Free

**5. Configure as variáveis de ambiente**

No Web Service → aba **Environment** → adicione:

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | Cole a **Internal Database URL** do banco criado |
| `JWT_SECRET` | Clique em **Generate** (gera automaticamente) |
| `NODE_ENV` | `production` |

**6. Deploy**
- Clique em **Create Web Service**
- Aguarde o build completar (~3 min)
- Acesse a URL gerada (ex: `https://centro360-financeiro.onrender.com`)

> ⚠️ **Plano gratuito do Render:** o servidor hiberna após 15 min sem uso. Na primeira requisição após inatividade, pode demorar ~30 segundos para acordar.

---

## 🔧 Variáveis de Ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Em produção | URL do PostgreSQL. Sem isso usa SQLite local |
| `JWT_SECRET` | Sim | Chave secreta para tokens JWT (mín. 32 chars) |
| `NODE_ENV` | Sim | `development` ou `production` |
| `PORT` | Não | Porta do servidor (padrão: 3000) |
| `CORS_ORIGIN` | Não | Domínio permitido (padrão: qualquer) |

---

## 🏗️ Estrutura do Projeto

```
centro360/
├── server.js              # Servidor Express principal
├── render.yaml            # Configuração de deploy no Render
├── src/
│   ├── database.js        # SQLite (dev) / PostgreSQL (prod)
│   ├── middleware/
│   │   ├── auth.js        # JWT — geração e verificação
│   │   └── rbac.js        # Controle de papéis (admin/tesoureiro/consultor)
│   └── routes/
│       ├── auth.js        # POST /login, POST /register
│       ├── mediuns.js
│       ├── mensalidades.js
│       ├── faxina.js
│       ├── despesas.js
│       ├── trabalhos.js
│       ├── extras.js
│       └── dashboard.js
└── INTERFACE/
    ├── login.html
    ├── index.html         # Dashboard
    ├── mediuns.html
    ├── mensalidade.html
    ├── faxina.html
    ├── despesas.html
    ├── trabalhos.html
    ├── extras.html
    ├── relatorios.html
    └── adicionar.html
```

---

## 🔐 Segurança

- Autenticação via **JWT** (expira em 7 dias)
- **RBAC** — cada papel tem permissões específicas
- **Rate limiting** — 20 tentativas de login por 15 min
- **Helmet** — headers de segurança HTTP
- **Isolamento** — cada terreiro vê apenas seus dados
- **Auditoria** — todas as ações são registradas em `audit_log`

---

## 📊 API Endpoints

```
POST   /api/auth/register     Criar conta
POST   /api/auth/login        Fazer login
GET    /api/auth/me           Dados do usuário logado

GET    /api/mediuns           Listar médiuns
POST   /api/mediuns           Cadastrar médium

GET    /api/mensalidades      Listar mensalidades
POST   /api/mensalidades      Criar mensalidade

GET    /api/faxina            Escala de faxina
GET    /api/despesas          Despesas
GET    /api/trabalhos         Trabalhos espirituais
GET    /api/extras            Extras
GET    /api/dashboard         Resumo financeiro
GET    /api/health            Health check
GET    /api/backup            Exportar backup (admin/tesoureiro)
POST   /api/restore           Restaurar backup (admin)
```
