import { test } from "node:test";
import assert from "node:assert/strict";
import { GET as dados } from "../api/dados.js";
import { POST as login } from "../api/login.js";
import { POST as salvar } from "../api/salvar.js";

const post = (body, token) => new Request("http://x/api", { method: "POST", headers: token ? { authorization: "Bearer " + token } : {}, body: JSON.stringify(body) });
const ler = async () => (await (await dados(new Request("http://x/api/dados"))).json());
const entrar = async () => (await (await login(post({ usuario: "admin", senha: "senha-de-teste" }))).json()).token;

test("primeira leitura traz os dados iniciais", async () => {
  const d = await ler();
  assert.equal(Object.keys(d.lancamentos).length, 411);
  assert.equal(d.meses["2026-10"].saldoInicial, -4590.14);
  assert.equal(d.lancamentos["rec-2026-05"].valor, 72425.85, "receita de maio da planilha");
  assert.equal(d.lancamentos["rec-2026-10"].valor, 76704.67, "receita de outubro da planilha");
  assert.ok(!d.lancamentos["rec-2026-09"], "setembro já tinha receita: não ganha outra");
  assert.ok(d.plano.grupos.length > 5);
});

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

test("salvar: grava, exclui, valida caminho e não refaz a semente", async () => {
  const token = await entrar();
  assert.equal((await salvar(post({ op: "set", path: "lancamentos/t2", data: { mes: "2026-05", grupo: "RECEITAS", valor: 10 } }, token))).status, 200);
  assert.equal((await salvar(post({ op: "delete", path: "lancamentos/imp000" }, token))).status, 200);
  assert.equal((await salvar(post({ op: "set", path: "../segredo", data: {} }, token))).status, 400);
  assert.equal((await salvar(post({ op: "delete", path: "config/plano" }, token))).status, 400);
  const d = await ler();
  assert.equal(d.lancamentos.t2.valor, 10);
  assert.equal(d.lancamentos.imp000, undefined, "a exclusão não pode voltar com a semente");
  assert.equal(Object.keys(d.lancamentos).length, 411);
});

test("salvar: gravações simultâneas não se perdem", async () => {
  const token = await entrar();
  await Promise.all([1, 2, 3, 4].map((i) => salvar(post({ op: "set", path: "lancamentos/par" + i, data: { valor: i } }, token))));
  const d = await ler();
  for (const i of [1, 2, 3, 4]) assert.equal(d.lancamentos["par" + i]?.valor, i);
});
