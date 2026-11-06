// Para os testes: troca @upstash/redis por um Redis em memória e define as variáveis de ambiente.
import { register } from "node:module";
process.env.ADMIN_USUARIO = "admin";
process.env.ADMIN_SENHA = "senha-de-teste";
process.env.STORAGE_KV_REST_API_URL = "http://redis-de-teste";
process.env.STORAGE_KV_REST_API_TOKEN = "teste";
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === "@upstash/redis") return { url: ${JSON.stringify(new URL("./redis-mem.mjs", import.meta.url).href)}, shortCircuit: true };
  return next(spec, ctx);
}`));
