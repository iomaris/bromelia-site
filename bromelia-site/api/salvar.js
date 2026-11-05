import { gravar, tokenValido, json } from "../lib/core.mjs";

const CAMINHO = /^(lancamentos|meses)\/[A-Za-z0-9_-]{1,64}$|^config\/plano$/;

export async function POST(req) {
  if (!tokenValido(req)) return json({ erro: "Sessão expirada. Entre novamente." }, 401);
  let corpo;
  try { corpo = await req.json(); } catch { return json({ erro: "Requisição inválida" }, 400); }
  const { op, path, data } = corpo || {};
  if (!CAMINHO.test(path || "") || !["set", "delete"].includes(op)) return json({ erro: "Operação inválida" }, 400);
  if (op === "set" && (!data || typeof data !== "object" || Array.isArray(data) || JSON.stringify(data).length > 60000))
    return json({ erro: "Dados inválidos" }, 400);
  const [col, id] = path.split("/");
  if (col === "config" && op === "delete") return json({ erro: "Operação inválida" }, 400);
  try {
    await gravar(op, col, id, data);
  } catch (e) {
    console.error(e);
    return json({ erro: "Não foi possível gravar agora, tente de novo" }, 503);
  }
  return json({ ok: true });
}
