import { carregar, json } from "../lib/core.mjs";

// Leitura pública: moradores veem o resumo e o relatório sem login.
export async function GET() {
  return json(await carregar());
}
