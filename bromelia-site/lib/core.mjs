import { getStore } from "@netlify/blobs";
import { createHash, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import seed from "./seed.mjs";

// Todos os dados ficam em um único registro JSON: há um só administrador gravando.
const store = () => getStore({ name: "financeiro", consistency: "strong" });
const KEY = "dados";

export async function carregar() {
  const d = await store().get(KEY, { type: "json" });
  return d ?? structuredClone(seed);
}
// Grava só se ninguém gravou no meio (etag); senão relê e aplica de novo. Evita perder um lançamento
// quando duas gravações chegam juntas (ex.: dois aparelhos, ou receita + exclusões em sequência).
export async function atualizar(mudar) {
  for (let i = 0; i < 5; i++) {
    const atual = await store().getWithMetadata(KEY, { type: "json" });
    const d = atual?.data ?? structuredClone(seed);
    mudar(d);
    const r = await store().setJSON(KEY, d, atual ? { onlyIfMatch: atual.etag } : { onlyIfNew: true });
    if (r.modified) return;
  }
  throw new Error("Muitas gravações ao mesmo tempo");
}

const env = (k) => {
  const v = Netlify.env.get(k);
  if (!v) throw new Error(`Variável de ambiente ${k} não configurada`);
  return v;
};
const b64u = (b) => Buffer.from(b).toString("base64url");
const igual = (a, b) => a.length === b.length && timingSafeEqual(a, b);

// Usuário e senha ficam nas variáveis de ambiente ADMIN_USUARIO e ADMIN_SENHA do Netlify.
const resumo = (v) => createHash("sha256").update(String(v)).digest();
export function senhaConfere(usuario, senha) {
  const okSenha = igual(resumo(senha), resumo(env("ADMIN_SENHA")));
  const okUser = igual(resumo(String(usuario).trim().toLowerCase()), resumo(env("ADMIN_USUARIO").trim().toLowerCase()));
  return okSenha && okUser;
}
// Chave das sessões derivada da senha: trocar a senha desconecta todas as sessões abertas.
const chave = () => createHmac("sha256", "bromelia-sessao").update(env("ADMIN_USUARIO") + "\u0000" + env("ADMIN_SENHA")).digest();

const HORAS = 12;
export function criarToken() {
  const exp = Date.now() + HORAS * 3600e3;
  const corpo = b64u(JSON.stringify({ u: "admin", exp, n: randomBytes(8).toString("hex") }));
  const sig = createHmac("sha256", chave()).update(corpo).digest("base64url");
  return { token: `${corpo}.${sig}`, exp };
}
export function tokenValido(req) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [corpo, sig] = t.split(".");
  if (!corpo || !sig) return false;
  const esperado = createHmac("sha256", chave()).update(corpo).digest("base64url");
  if (!igual(Buffer.from(sig), Buffer.from(esperado))) return false;
  try { return JSON.parse(Buffer.from(corpo, "base64url").toString()).exp > Date.now(); } catch { return false; }
}

export const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
