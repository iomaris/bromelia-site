// Servidor local para testar o site no navegador sem a Vercel: npm run local (usa o Redis em memória dos testes).
import http from "node:http"; import fs from "node:fs";
const rotas = { "/api/dados": await import("../api/dados.js"), "/api/login": await import("../api/login.js"), "/api/salvar": await import("../api/salvar.js") };
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"), mod = rotas[u.pathname];
  if (mod) {
    const fn = mod[req.method]; if (!fn) { res.writeHead(405); return res.end(); }
    const body = await new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
    const r = await fn(new Request("http://x" + req.url, { method: req.method, headers: req.headers, body: req.method === "GET" ? undefined : body }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(await r.text());
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(fs.readFileSync(new URL("../public/index.html", import.meta.url)));
}).listen(process.env.PORT || 8899, () => console.log("http://localhost:" + (process.env.PORT || 8899)));
