import { Redis } from "@upstash/redis";
import { createHash, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import seed from "./seed.mjs";
import balanceteOutubro from "./balancete-2026-10.mjs";

// Banco: Upstash Redis (conectado pelo painel da Vercel). Cada lançamento e cada mês é um campo de um hash,
// então toda gravação é um comando único e atômico: duas gravações ao mesmo tempo não se apagam.
// Criado só quando usado: assim o login funciona mesmo se o banco ainda não estiver conectado.
let cliente;
const redis = new Proxy({}, { get: (_, k) => {
  if (!cliente) {
    // A Vercel pode criar as variáveis com prefixo (ex.: STORAGE_KV_REST_API_URL); aceita qualquer um.
    const achar = (...fins) => Object.keys(process.env).find((k) => fins.some((f) => k.endsWith(f)) && process.env[k]);
    const url = achar("KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"), token = achar("KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN");
    if (!url || !token)
      throw new Error("Banco de dados não conectado. Na Vercel: Storage → Upstash for Redis → conectar ao projeto, depois Redeploy.");
    cliente = new Redis({ url: process.env[url], token: process.env[token] });
  }
  const v = cliente[k];
  return typeof v === "function" ? v.bind(cliente) : v;
} });
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

// Correções de dados aplicadas uma única vez. Cada uma só lança a receita se o mês ainda não tiver receita,
// para nunca duplicar nem sobrescrever o que já foi lançado pelo site.
const REC_ITEM = "PAGAMENTOS DOS MORADORES E INQUILINOS";
const MIGRACOES = {
  "2026-11-11-receitas-planilha": { "2026-05": 72425.85, "2026-10": 76704.67 },
};
async function migrar() {
  for (const [nome, receitas] of Object.entries(MIGRACOES)) {
    const flag = "migracao:" + nome;
    if (await redis.exists(flag)) continue;
    const todos = Object.values((await redis.hgetall("lancamentos")) || {});
    for (const [mes, valor] of Object.entries(receitas)) {
      if (todos.some((l) => l.mes === mes && l.grupo === "RECEITAS")) continue;
      await redis.hsetnx("lancamentos", "rec-" + mes, { mes, grupo: "RECEITAS", item: REC_ITEM, fornecedor: "", valor, origem: "planilha", criadoEm: mes + "-01T00:00:00Z" });
    }
    await redis.set(flag, 1);
  }
  // Outubro/2026: troca as despesas vindas da planilha pelas do balancete oficial. Lançamentos feitos pelo site ficam.
  const flagOut = "migracao:2026-11-11-outubro-balancete";
  if (!(await redis.exists(flagOut))) {
    const todos = (await redis.hgetall("lancamentos")) || {};
    const velhos = Object.entries(todos).filter(([, l]) => l.mes === "2026-10" && l.grupo !== "RECEITAS" && l.origem === "planilha").map(([id]) => id);
    const p = redis.pipeline();
    for (const [id, d] of Object.entries(balanceteOutubro)) p.hsetnx("lancamentos", id, d);
    for (const id of velhos) p.hdel("lancamentos", id);
    p.set(flagOut, 1);
    await p.exec();
  }
  // Novembro/2026: lançamentos da planilha atualizada que ainda faltavam no site. Pula item que já tiver lançamento no mês.
  const flagNov = "migracao:2026-11-11-novembro-planilha";
  if (!(await redis.exists(flagNov))) {
    const nov = Object.values((await redis.hgetall("lancamentos")) || {}).filter((l) => l.mes === "2026-11");
    const p = redis.pipeline();
    NOVEMBRO.forEach(([grupo, item, fornecedor, valor], i) => {
      if (nov.some((l) => l.grupo === grupo && l.item === item)) return;
      p.hsetnx("lancamentos", "p11b-" + i, { mes: "2026-11", grupo, item, fornecedor, valor, origem: "planilha", criadoEm: "2026-11-01T00:00:00Z" });
    });
    p.set(flagNov, 1);
    await p.exec();
  }
}
const NOVEMBRO = [
  ["TARIFAS PUBLICAS", "TELEFONE", "CLARO", 59.9],
  ["TARIFAS PUBLICAS", "INTERNET CHURRASQUEIRA", "CLARO", 79.9],
  ["MATERIAIS PARA MANUTENÇAO", "DIESEL GERADOR", "", 188.73],
  ["PRESTADORES DE SERVIÇOS", "FRETE DE ENTULHO", "", 130],
  ["PRESTADORES DE SERVIÇOS", "CONSERVAÇÃO E MANUTENÇÃO", "", 1113],
  ["FUNDO DE RESERVA", "BANCO DO BRASIL FUNDO DE RESRVA", "", 3576.95],
];

export async function carregar() {
  await semear();
  await migrar();
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
  if (!v) throw new Error(`Falta a variável ${k}. Na Vercel: Settings → Environment Variables, depois Redeploy.`);
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

// Erros de configuração voltam com a mensagem para a tela (não contêm segredos).
export const protegido = (fn) => async (req) => {
  try { return await fn(req); } catch (e) { console.error(e); return json({ erro: e.message }, 500); }
};
