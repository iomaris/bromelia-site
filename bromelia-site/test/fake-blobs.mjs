// Para os testes: troca @netlify/blobs por um armazenamento em memória e define as variáveis de ambiente.
import { register } from "node:module";
globalThis.Netlify = { env: { get: (k) => ({ ADMIN_USUARIO: "admin", ADMIN_SENHA: "senha-de-teste" })[k] } };
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === "@netlify/blobs") return { url: ${JSON.stringify(new URL("./blobs-mem.mjs", import.meta.url).href)}, shortCircuit: true };
  return next(spec, ctx);
}`));
