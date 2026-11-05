import { test } from "node:test";
import assert from "node:assert/strict";
import dados from "../netlify/functions/dados.mjs";
import login from "../netlify/functions/login.mjs";
import salvar from "../netlify/functions/salvar.mjs";

const post = (body, token) => new Request("http://x/api", { method: "POST", headers: token ? { authorization: "Bearer " + token } : {}, body: JSON.stringify(body) });
const ler = async () => (await (await dados(new Request("http://x/api/dados"))).json());

test("login: senha errada recusa, certa devolve token", async () => {
  assert.equal((await login(post({ usuario: "admin", senha: "errada" }))).status, 401);
  const r = await login(post({ usuario: " ADMIN ", senha: "senha-de-teste" }));
  assert.equal(r.status, 200);
  assert.ok((await r.json()).token);
});

test("salvar: sem login ou com token falso é recusado", async () => {
  const doc = { op: "set", path: "lancamentos/t1", data: { valor: 1 } };
  assert.equal((await salvar(post(doc))).status, 401);
  assert.equal((await salvar(post(doc, "eyJ1IjoiYWRtaW4iLCJleHAiOjk5OTk5OTk5OTk5OTl9.falso"))).status, 401);
  assert.equal((await ler()).lancamentos.t1, undefined);
});

test("salvar: grava, valida caminho e mantém os dados importados", async () => {
  const { token } = await (await login(post({ usuario: "admin", senha: "senha-de-teste" }))).json();
  const antes = Object.keys((await ler()).lancamentos).length;
  assert.equal((await salvar(post({ op: "set", path: "lancamentos/t2", data: { mes: "2026-05", grupo: "RECEITAS", valor: 10 } }, token))).status, 200);
  assert.equal((await salvar(post({ op: "set", path: "../segredo", data: {} }, token))).status, 400);
  assert.equal((await salvar(post({ op: "delete", path: "config/plano" }, token))).status, 400);
  const d = await ler();
  assert.equal(d.lancamentos.t2.valor, 10);
  assert.equal(Object.keys(d.lancamentos).length, antes + 1);
});

test("salvar: gravações simultâneas não se perdem", async () => {
  const { token } = await (await login(post({ usuario: "admin", senha: "senha-de-teste" }))).json();
  await Promise.all([1, 2, 3, 4].map((i) => salvar(post({ op: "set", path: "lancamentos/par" + i, data: { valor: i } }, token))));
  const d = await ler();
  for (const i of [1, 2, 3, 4]) assert.equal(d.lancamentos["par" + i]?.valor, i);
});
