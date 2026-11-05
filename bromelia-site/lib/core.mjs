import { Redis } from "@upstash/redis";
import { createHash, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import seed from "./seed.mjs";

// Banco: Upstash Redis (conectado pelo painel da Vercel). Cada lançamento e cada mês é um campo de um hash,
// então toda gravação é um comando único e atômico: duas gravações ao mesmo tempo não se apagam.
const redis = Redis.fromEnv();
const SEMENTE = "semente:v1";

// Na primeira vez, copia os dados iniciais (jan–nov 2026). hsetnx/nx nunca sobrescrevem algo já gravado.
async function semear() {
  if (await redis.exists(SEMENTE)) return;
  const p = redis.pipeline();
  for (const [id, d] of Object.entries(seed.lancamentos)) p.hsetnx("lancamentos", id, d);
  for (const [id, d] of Object.entries(seed.meses)) p.hsetnx("meses", id, d);
  p.set("plano", seed.plano, { nx: true });
  p.set(SEMENTE, 1);
  await p.exec();
}

export async function carregar() {
  await semear();
  const [lancamentos, meses, plano] = await Promise.all([redis.hgetall("lancamentos"), redis.hgetall("meses"), redis.get("plano")]);
  return { lancamentos: lancamentos || {}, meses: meses || {}, plano };
}

export async function gravar(op, col, id, data) {
  await semear();
  if (col === "config") return redis.set("plano", data);
  if (op === "delete") return redis.hdel(col, id);
  return redis.hset(col, { [id]: data });
}

const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Variável de ambiente ${k} não configurada`);
  return v;
};
const b64u = (b) => Buffer.from(b).toString("base64url");
const igual = (a, b) => a.length === b.length && timingSafeEqual(a, b);

// Usuário e senha ficam nas variáveis de ambiente ADMIN_USUARIO e ADMIN_SENHA da Vercel.
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
