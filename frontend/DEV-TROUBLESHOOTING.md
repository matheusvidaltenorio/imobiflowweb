# Frontend — erros comuns em desenvolvimento (porta 3002)

## 404 em `/_next/static/chunks/...` ou `/_next/static/media/...`

Indica que o navegador está pedindo arquivos de um build antigo (cache) enquanto o servidor gerou outro.

**Passos:**

1. Pare o `npm run dev`.
2. Apague a pasta `.next` neste diretório (`frontend`).
3. Execute de novo `npm run dev`.
4. No navegador: recarregamento forçado (Ctrl+Shift+R) ou abra em aba anônima.

## `ERR_BLOCKED_BY_CLIENT` em `pagead2.googlesyndication.com` (adsbygoogle.js)

Não vem do código do ImobiFlow. É bloqueio de **extensão** (AdBlock, uBlock, etc.), modo privacidade do navegador ou DNS. Pode ignorar no desenvolvimento.

## Senha ou email na URL do login (`/login?email=...&password=...`)

- Não salve links assim; credenciais na query string vão para histórico e logs.
- Os formulários de autenticação usam **`method="post"`** para que, se o JavaScript falhar, o envio padrão do HTML não use GET com dados na URL.
