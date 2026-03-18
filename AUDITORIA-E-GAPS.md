# Auditoria e Gaps - ImobiFlow

## 1. AUDITORIA DO PROJETO ATUAL

### BACKEND (NestJS)
| Item | Status |
|------|--------|
| Módulos | Auth, Users, Properties, Developments, Blocks, Lots, Visits, Favorites, Leads, Payments, Installments, Dashboard, Clients, Cloudinary |
| Rotas | Todas as APIs documentadas e funcionais |
| JWT + Refresh Token | ✅ Implementado |
| Guards (JWT, Roles) | ✅ Global |
| Helmet | ✅ |
| CORS | ✅ Configurável |
| Rate limit | ✅ Throttler (login: 5/min) |
| class-validator | ✅ DTOs |
| bcrypt | ✅ Senhas |
| Sanitização XSS | ✅ Properties service |
| Cloudinary | ✅ Upload/delete imagens |

### FRONTEND (Next.js 14)
| Item | Status |
|------|--------|
| Páginas | 35+ páginas |
| Proteção de rotas | ✅ Layout (dashboard) por role |
| Auth context | ✅ Login, register, refresh, logout |
| Axios + interceptors | ✅ Refresh token automático |
| Toasts | ✅ Radix UI |
| React Query | ✅ Loading states |
| Formulários | ✅ React Hook Form + Zod |

### BANCO (Prisma)
| Tabela | Status |
|--------|--------|
| User, Property, PropertyImage | ✅ |
| Development, Block, Lot | ✅ |
| Visit, Client, Favorite, Lead | ✅ |
| Payment, Installment | ✅ |
| ActivityLog, RefreshToken, PasswordResetToken | ✅ |

---

## 2. GAPS CORRIGIDOS

### Implementações desta sessão

1. **Google Maps** - Mapa no detalhe do imóvel quando latitude/longitude existem
2. **Busca** - Botão "Buscar" para aplicar filtros (evita requests a cada tecla)
3. **Next.js images** - remotePatterns para Cloudinary
4. **Admin** - Links Editar em properties e developments
5. **Property detail** - Header com nav auth (Perfil, Sair, etc.)
6. **WhatsApp** - Botão só aparece quando corretor tem telefone válido
7. **Forgot password** - Integração Resend para envio real de email
8. **Coordenadas** - Campos lat/long no formulário de imóveis

---

## 3. O QUE JÁ ESTAVA PRONTO

- Login, cadastro, refresh token, forgot/reset password
- CRUD completo: imóveis, loteamentos, quadras, lotes, visitas, clientes, pagamentos
- Upload de imagens (Cloudinary)
- Favoritos, leads, compartilhamento
- Dashboard com stats reais
- Admin gestão de usuários
- Proteção de rotas por role

---

## 4. VARIÁVEIS DE AMBIENTE

### Backend
- `RESEND_API_KEY` - Para envio de email no forgot password
- `RESEND_FROM_EMAIL` - Remetente (default: onboarding@resend.dev)

### Frontend
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Para exibir mapa no imóvel
