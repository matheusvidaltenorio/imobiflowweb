# ImobiFlow

Sistema completo de marketplace imobiliário com gestão para corretores e painel administrativo.

## Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, TanStack Query, Axios, React Hook Form, Zod
- **Backend**: NestJS, Prisma, PostgreSQL (Supabase)
- **Outros**: Cloudinary (imagens), JWT (auth)

## Estrutura

```
/
├── backend/     # API NestJS
├── frontend/    # App Next.js
└── .env.example
```

## Como rodar localmente

### 1. Banco de dados (Supabase)

1. Crie uma conta em [Supabase](https://supabase.com)
2. Crie um novo projeto
3. Em **Settings > Database**, copie a **Connection string** (URI)

### 2. Backend

```bash
cd backend
npm install
cp ../.env.example .env
# Edite .env com suas variáveis (DATABASE_URL, JWT_SECRET, etc.)
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

O backend estará em `http://localhost:3333`.

### 3. Frontend

```bash
cd frontend
npm install
cp ../.env.example .env.local
# Edite .env.local: NEXT_PUBLIC_API_URL=http://localhost:3333/api
npm run dev
```

O frontend estará em `http://localhost:3000`.

### Frontend: páginas “só HTML” / sem Tailwind

- **Não use** `output: 'export'` no [`frontend/next.config.js`](frontend/next.config.js) salvo deploy explícito como **Static Site** (site estático); no fluxo normal (Web Service / Vercel) isso quebra o pipeline esperado do Next.
- Se o visual sumir: apague a pasta `frontend/.next`, rode `npm install` e `npm run build` (ou `npm run dev`). No navegador (DevTools → Network → CSS), confira se `/_next/static/css/...` retorna **200** e o arquivo contém classes compiladas (ex.: `.flex{`), não linhas cruas `@tailwind`.

### Usuários seed

- **Admin**: admin@imobflow.com / admin123
- **Corretor**: corretor@imobflow.com / corretor123
- **Cliente**: cliente@imobflow.com / cliente123

## Deploy em produção

### 1. Banco Supabase

1. Crie o projeto no Supabase (produção)
2. Copie a connection string
3. Em **Database > Migrations**, as migrations serão executadas no primeiro deploy

### 2. Backend (Render)

1. Crie uma conta em [Render](https://render.com)
2. New > Web Service
3. Conecte o repositório
4. Configure:
   - **Build Command**: `cd backend && npm install && npx prisma generate`
   - **Start Command**: `cd backend && npx prisma migrate deploy && npm run start:prod`
   - **Root Directory**: (deixe vazio ou use monorepo)
5. Variáveis de ambiente: adicione todas do `.env.example`
6. Após o deploy, anote a URL da API (ex: `https://imobflow-api.onrender.com`)

### 3. Frontend (Vercel)

1. Crie uma conta em [Vercel](https://vercel.com)
2. Import o projeto
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
4. Variável de ambiente: `NEXT_PUBLIC_API_URL` = URL da API (ex: `https://imobflow-api.onrender.com/api`)
5. Deploy

### 4. CORS e URLs

No backend (Render), configure:

- `FRONTEND_URL`: URL do frontend na Vercel (ex: `https://imobflow.vercel.app`)

### 5. Cloudinary

1. Crie conta em [Cloudinary](https://cloudinary.com)
2. Copie Cloud Name, API Key e API Secret
3. Adicione no .env do backend

## Rotas principais

### Públicas
- `/` - Home
- `/search` - Busca de imóveis
- `/property/[id]` - Detalhe do imóvel
- `/login`, `/register`, `/forgot-password` - Auth

### Cliente (logado)
- `/dashboard` - Área do cliente
- `/favorites` - Favoritos
- `/interests` - Histórico de interesses
- `/profile` - Perfil

### Corretor
- `/dashboard` - Dashboard
- `/properties` - CRUD imóveis
- `/developments` - Loteamentos
- `/lots` - Lotes
- `/visits` - Visitas
- `/leads` - Leads
- `/clients` - Clientes
- `/payments` - Pagamentos

### Admin
- `/admin` - Dashboard admin
- `/admin/users` - Usuários
- `/admin/properties` - Imóveis
- `/admin/developments` - Loteamentos

## API

Base URL: `http://localhost:3333/api`

### Autenticação
- `POST /auth/login` - Login
- `POST /auth/register` - Cadastro
- `POST /auth/refresh` - Refresh token
- `POST /auth/forgot-password` - Recuperar senha
- `GET /auth/me` - Usuário atual (Bearer)

### Imóveis
- `GET /properties/public` - Listagem pública (com filtros)
- `GET /properties/:id` - Detalhe (público)
- `GET /properties` - Meus imóveis (auth)
- `POST /properties` - Criar (corretor/admin)
- `PATCH /properties/:id` - Atualizar (corretor/admin)
- `DELETE /properties/:id` - Excluir (corretor/admin)

### Outros
- `GET /favorites` - Favoritos do usuário
- `POST /favorites/:propertyId` - Adicionar favorito
- `DELETE /favorites/:propertyId` - Remover favorito
- `POST /leads` - Enviar lead (público)
- `GET /leads` - Listar leads (corretor/admin)
- `GET /dashboard` - Estatísticas
