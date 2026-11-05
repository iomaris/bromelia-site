import { protegido, carregar, json } from "../lib/core.mjs";

// Leitura pública: moradores veem o resumo e o relatório sem login.
export const GET = protegido(async function () {
  return json(await carregar());
});
