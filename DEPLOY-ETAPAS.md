# Deploy ImobiFlow no Render – Etapas separadas

Guia para criar **PostgreSQL**, **Web Service (backend)** e **Frontend** em etapas distintas no Render.

---

## Ordem recomendada

1. **PostgreSQL** – o backend precisa do banco
2. **Web Service (backend)** – API NestJS
3. **Static Site ou Web Service (frontend)** – Next.js

---

## Etapa 1: PostgreSQL

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique em **New** > **PostgreSQL**
3. Preencha:
   - **Name:** `imobflow-db`
   - **Database:** `imobflow`
   - **Region:** Oregon (ou mais próximo)
   - **Plan:** Free (90 dias)
4. Clique em **Create Database**
5. Aguarde o provisionamento (~1 min)
6. Em **Info** > **Internal Database URL**, copie a connection string (ou use **External** se preferir)
7. Anote essa URL – será usada como `DATABASE_URL` no backend

---

## Etapa 2: Web Service (Backend)

1. No Render, clique em **New** > **Web Service**
2. Conecte o repositório GitHub (se ainda não conectou)
3. Preencha:

| Campo | Valor |
|-------|-------|
| **Name** | `imobflow-api` |
| **Region** | Oregon |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install && npx prisma generate && npm run build` |
| **Start Command** | `npx prisma migrate deploy && npm run start:prod` |

4. Em **Environment** (Variáveis), adicione:

| Key | Value |
|-----|-------|
| `NODE_VERSION` | `20` |
| `DATABASE_URL` | Cole a connection string do PostgreSQL (Etapa 1) |
| `JWT_SECRET` | Gere uma string longa (ex: `openssl rand -base64 32`) |
| `REFRESH_SECRET` | Outra string longa |
| `FRONTEND_URL` | `https://imobflow-web.onrender.com` (ajuste após criar o frontend) |
| `CLOUDINARY_CLOUD_NAME` | Seu Cloud Name |
| `CLOUDINARY_API_KEY` | Sua API Key |
| `CLOUDINARY_API_SECRET` | Seu API Secret |
| `RESEND_FROM_EMAIL` | `ImobiFlow <onboarding@resend.dev>` |

5. Clique em **Create Web Service**
6. Aguarde o deploy (~3–5 min)
7. Anote a URL do backend (ex: `https://imobflow-api.onrender.com`)

---

## Etapa 3a: Static Site (Frontend)

Use este caminho se quiser o frontend como **Static Site** (site estático).

1. Clique em **New** > **Static Site**
2. Conecte o repositório
3. Preencha:

| Campo | Valor |
|-------|-------|
| **Name** | `imobflow-web` |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `out` |

**Importante:** para usar Static Site, o Next.js precisa de `output: 'export'`. Ver seção abaixo.

4. Em **Environment**, adicione:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://imobflow-api.onrender.com/api` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | (opcional) |

5. **Atualize** o backend: em `imobflow-api` > **Environment**, defina `FRONTEND_URL` = URL do static site (ex: `https://imobflow-web.onrender.com`)

---

## Etapa 3b: Web Service (Frontend) – recomendado

Para Next.js com todas as funções (SSR, rotas dinâmicas), use **Web Service** em vez de Static Site.

1. Clique em **New** > **Web Service**
2. Conecte o repositório
3. Preencha:

| Campo | Valor |
|-------|-------|
| **Name** | `imobflow-web` |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |

4. Em **Environment**:

| Key | Value |
|-----|-------|
| `NODE_VERSION` | `20` |
| `NEXT_PUBLIC_API_URL` | `https://imobflow-api.onrender.com/api` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | (opcional) |

5. Clique em **Create Web Service**

---

## Após o primeiro deploy

No backend (`imobflow-api`), abra **Shell** e rode:

```bash
npx prisma db seed
```

Na sua máquina, na pasta `backend`, você também pode usar: `npm run prisma:seed` (equivale ao comando acima).

**Atenção:** o nome correto é **`prisma`** (com **s**). Se digitar `primsa`, o npm tentará instalar um pacote inexistente e retornará erro 404.

Usuários: admin@imobflow.com / admin123 | corretor@imobflow.com / corretor123 | cliente@imobflow.com / cliente123

---

## Se usar Static Site (Etapa 3a)

É necessário adicionar `output: 'export'` no Next.js. No `frontend/next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // gera pasta out/ para Static Site
  reactStrictMode: true,
  images: {
    unoptimized: true,  // obrigatório com output: 'export'
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
    ],
  },
};
module.exports = nextConfig;
```

Remova `rewrites` (não funciona em export estático). Coloque `favicon.ico` em `frontend/public/` se quiser manter o ícone.

**Limitações:** rotas dinâmicas como `/property/[id]` podem ter comportamento diferente; recomenda-se usar **Web Service** (Etapa 3b) para o frontend.
