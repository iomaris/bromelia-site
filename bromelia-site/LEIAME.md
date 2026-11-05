# Financeiro Bromélia — site

Site da prestação de contas do Condomínio Bromélia (administração Tática Lean).

- **Moradores** abrem o site e escolhem "Morador": veem o resumo e o relatório, e podem baixar a planilha e o PDF. Não precisam de login.
- **Administração** entra com usuário e senha e é a única que lança, edita e apaga.

## Como funciona

| Parte | Onde fica |
|---|---|
| Página | `public/index.html` |
| Leitura dos dados (pública) | `netlify/functions/dados.mjs` → `/api/dados` |
| Login do administrador | `netlify/functions/login.mjs` → `/api/login` |
| Gravação (exige login) | `netlify/functions/salvar.mjs` → `/api/salvar` |
| Banco de dados | Netlify Blobs, loja `financeiro`, registro `dados` |
| Dados iniciais (jan–out 2026) | `lib/seed.mjs`, usados até a primeira gravação |

A sessão do administrador dura 12 horas. Trocar a senha encerra todas as sessões abertas.

## Configuração (uma vez)

1. Em **app.netlify.com → projeto bromelia-financeiro → Project configuration → Environment variables**, crie:
   - `ADMIN_USUARIO`: o usuário do administrador (ex.: `admin`)
   - `ADMIN_SENHA`: a senha do administrador. Marque como **secreta** e deixe o escopo incluir **Functions**.
2. Em **Project configuration → Access & security → Visitor access**, desligue **Netlify team login (SSO)**. Sem isso, só membros da sua equipe Netlify conseguem abrir o site.

## Publicar

Na pasta do projeto, com Node.js instalado:

```sh
npm install
npx -y netlify-cli deploy --prod --site d1b9a514-ff3d-46c6-b292-e7fa1d8e84b7
```

Na primeira vez, o comando abre o navegador para você entrar na sua conta Netlify.

Para trocar a senha, altere `ADMIN_SENHA` no Netlify e publique de novo.
