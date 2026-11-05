import { carregar, json } from "../../lib/core.mjs";

// Leitura pública: moradores veem o resumo e o relatório sem login.
export default async () => json(await carregar());

export const config = { path: "/api/dados", method: "GET" };
