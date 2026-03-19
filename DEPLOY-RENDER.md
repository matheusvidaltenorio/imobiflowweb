# Deploy ImobiFlow no Render

Guia para subir o projeto completo (backend + frontend) no Render.

## Pré-requisitos

1. Conta no [Render](https://render.com)
2. Repositório Git (GitHub, GitLab ou Bitbucket) com o código
3. Cloudinary configurado (imagens)

O banco PostgreSQL é criado automaticamente pelo Blueprint no Render.

## Passo 1: Conectar repositório

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique em **New** > **Blueprint**
3. Conecte seu repositório (GitHub/GitLab/Bitbucket)
4. Render detecta o `render.yaml` na raiz

## Checklist de variáveis obrigatórias

Antes do primeiro deploy, confira se todas as variáveis abaixo estão preenchidas no Dashboard:

| Serviço  | Variável                  | Obrigatória |
|----------|---------------------------|-------------|
| Backend  | DATABASE_URL              | Automático (Render Postgres) |
| Backend  | JWT_SECRET                 | Sim         |
| Backend  | REFRESH_SECRET             | Sim         |
| Backend  | FRONTEND_URL               | Sim         |
| Backend  | CLOUDINARY_CLOUD_NAME      | Sim (upload)|
| Backend  | CLOUDINARY_API_KEY         | Sim (upload)|
| Backend  | CLOUDINARY_API_SECRET      | Sim (upload)|
| Frontend | NEXT_PUBLIC_API_URL        | Já tem default |

Se alguma variável obrigatória estiver vazia, o deploy pode falhar ou o app ficar quebrado.

## Passo 2: Configurar variáveis de ambiente

Após o Blueprint criar os serviços, configure no Dashboard:

### Backend (imobflow-api)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | Preenchido automaticamente pelo PostgreSQL do Render | - |
| `JWT_SECRET` | Chave secreta JWT | String longa e aleatória |
| `REFRESH_SECRET` | Chave para refresh token | String longa e aleatória |
| `FRONTEND_URL` | URL do frontend (CORS) | `https://imobflow-web.onrender.com` |
| `CLOUDINARY_CLOUD_NAME` | Cloud Name do Cloudinary | |
| `CLOUDINARY_API_KEY` | API Key do Cloudinary | |
| `CLOUDINARY_API_SECRET` | API Secret do Cloudinary | |
| `GOOGLE_MAPS_API_KEY` | (Opcional) API Key Google Maps | |
| `RESEND_API_KEY` | (Opcional) Para forgot password | |

### Frontend (imobflow-web)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NEXT_PUBLIC_API_URL` | URL da API | `https://imobflow-api.onrender.com/api` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | (Opcional) Para mapa no imóvel | |

**Importante:** Defina as URLs antes do primeiro deploy:
- Backend `FRONTEND_URL` = `https://imobflow-web.onrender.com` (ou sua URL do frontend)
- Frontend `NEXT_PUBLIC_API_URL` = `https://imobflow-api.onrender.com/api` (URL padrão do Render)

## Passo 3: Deploy

1. O Blueprint cria automaticamente: banco PostgreSQL (imobflow-db) + backend (imobflow-api) + frontend (imobflow-web)
2. Ordem: banco é provisionado primeiro, depois backend, depois frontend
3. Tempo: ~5–8 min no total
4. Acesse a URL do frontend (ex: `https://imobflow-web.onrender.com`)

## Ordem de deploy

O frontend depende da URL do backend. Se o backend ainda não estiver no ar:

1. Aguarde o backend subir
2. Atualize `NEXT_PUBLIC_API_URL` no frontend com a URL real
3. Faça um **Manual Deploy** no frontend para aplicar a variável

## Banco de dados e seed

O projeto usa **PostgreSQL do Render** (imobflow-db). Migrations são executadas no start do backend (`prisma migrate deploy`).

**Primeiro deploy:** após as migrations, rode o seed para criar os usuários iniciais (admin, corretor, cliente):
- No Render Dashboard > imobflow-api > Shell, execute: `npx prisma db seed`
- Ou adicione temporariamente ao startCommand: `npx prisma migrate deploy && npx prisma db seed && npm run start:prod` (depois remova o seed)

Usuários seed: admin@imobflow.com / admin123 | corretor@imobflow.com / corretor123 | cliente@imobflow.com / cliente123

Para migrar de um banco local/Docker/Supabase:
1. As migrations rodam automaticamente no primeiro deploy
2. Se precisar importar dados, use `pg_dump`/`pg_restore` ou ferramentas de migração

## Custos

- **Free tier:** Backend e frontend entram em sleep após inatividade (primeira requisição pode demorar ~30s)
- **Starter:** Serviços permanecem ligados
- **PostgreSQL:** plano free disponível (90 dias no Render; depois migre para pago ou exporte para Supabase)

## Troubleshooting

| Problema | Solução |
|----------|---------|
| CORS error | Verifique se `FRONTEND_URL` no backend tem a URL correta do frontend |
| 401 no login | Confirme `JWT_SECRET` e `REFRESH_SECRET` no backend |
| Imagens não carregam | Configure Cloudinary no backend |
| Build falha no frontend | Garanta que `NEXT_PUBLIC_API_URL` está definida (pode ser placeholder no build) |
