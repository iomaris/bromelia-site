# Financeiro Bromélia — site (Vercel)

Prestação de contas do Condomínio Bromélia (administração Tática Lean).

- **Moradores** abrem o site e escolhem "Morador": veem o resumo e o relatório e baixam planilha e PDF. Sem login.
- **Administração** entra com usuário e senha e é a única que lança, edita e apaga.

## Peças

| Parte | Arquivo |
|---|---|
| Página | `public/index.html` |
| Leitura (pública) | `api/dados.js` → `/api/dados` |
| Login | `api/login.js` → `/api/login` |
| Gravação (exige login) | `api/salvar.js` → `/api/salvar` |
| Banco de dados | Upstash Redis, conectado pela Vercel |
| Dados iniciais (jan–nov 2026) | `lib/seed.mjs`, copiados para o banco na primeira vez que o site abre |

## Colocar no ar (uma vez)

1. **Criar o projeto na Vercel**: em vercel.com → *Add New → Project*, importe o repositório do GitHub com esta pasta
   (ou, com Node.js instalado, rode `npx vercel` dentro da pasta). *Framework Preset*: **Other**. Não precisa de comando de build.
2. **Banco de dados**: no projeto, aba **Storage → Create Database → Upstash for Redis** (plano grátis) → conecte ao projeto.
   A Vercel cria sozinha as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
3. **Login do administrador**: *Settings → Environment Variables*, crie
   - `ADMIN_USUARIO` = `admin.bromelia`
   - `ADMIN_SENHA` = a senha (marque **Sensitive**)
4. **Publique de novo** (*Deployments → Redeploy*) para as variáveis valerem.

Para trocar a senha: mude `ADMIN_SENHA` e faça *Redeploy*. Isso encerra todas as sessões abertas.

## Testar no computador

```sh
npm install
npm test        # testes do servidor
npm run local   # abre o site em http://localhost:8899 com um banco de teste em memória (senha: senha-de-teste)
```
