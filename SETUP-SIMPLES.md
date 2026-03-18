# Setup Simples (sem Docker, só testar localmente)

## 1. Banco de dados Supabase (gratuito, 2 minutos)

1. Acesse **https://supabase.com** e crie uma conta (pode usar Google/GitHub)
2. Clique em **New Project**
3. Preencha nome, senha do banco e região (ex: South America)
4. Aguarde ~1 minuto até o projeto estar pronto
5. No menu lateral: **Project Settings** (ícone engrenagem) → **Database**
6. Em **Connection string**, selecione **URI**
7. Copie a URL (formato: `postgresql://postgres.[xxx]:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`)
8. **Importante:** Troque `[YOUR-PASSWORD]` pela senha que você definiu no passo 3

## 2. Configurar o backend

1. Abra `backend/.env`
2. Cole a URL copiada no `DATABASE_URL`:

```
DATABASE_URL="postgresql://postgres.xxxxx:SuaSenhaAqui@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
JWT_SECRET="qualquer-chave-secreta-longa-123"
REFRESH_SECRET="outra-chave-secreta-456"
FRONTEND_URL="http://localhost:3000"
PORT=3333
```

## 3. Rodar o backend

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

O backend ficará em **http://localhost:3333**

## 4. Rodar o frontend

Em outro terminal:

```bash
cd frontend
npm run dev
```

O frontend ficará em **http://localhost:3000**

## 5. Testar

Acesse **http://localhost:3000** e faça login:
- **Admin:** admin@imobflow.com / admin123
- **Corretor:** corretor@imobflow.com / corretor123
- **Cliente:** cliente@imobflow.com / cliente123

---

**Onde os dados ficam?** No Supabase (nuvem), mas você não faz deploy. Apenas o banco está na nuvem; frontend e backend rodam na sua máquina.
