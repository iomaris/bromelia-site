import { senhaConfere, criarToken, json } from "../lib/core.mjs";

export async function POST(req) {
  let corpo;
  try { corpo = await req.json(); } catch { return json({ erro: "Requisição inválida" }, 400); }
  const { usuario = "", senha = "" } = corpo || {};
  if (typeof usuario !== "string" || typeof senha !== "string" || usuario.length > 100 || senha.length > 200)
    return json({ erro: "Requisição inválida" }, 400);
  if (!senhaConfere(usuario, senha)) {
    await new Promise((r) => setTimeout(r, 1200)); // atrasa tentativas de adivinhar a senha
    return json({ erro: "Usuário ou senha incorretos" }, 401);
  }
  return json(criarToken());
}
