// Imitação mínima do cliente @upstash/redis, suficiente para os testes.
const kv = new Map(), hs = new Map();
const h = (k) => (hs.has(k) || hs.set(k, new Map()), hs.get(k));
const clone = (v) => structuredClone(v);
const cmds = {
  async exists(k) { return kv.has(k) || hs.has(k) ? 1 : 0; },
  async get(k) { return kv.has(k) ? clone(kv.get(k)) : null; },
  async set(k, v, o = {}) { if (o.nx && kv.has(k)) return null; kv.set(k, clone(v)); return "OK"; },
  async hsetnx(k, f, v) { const m = h(k); if (m.has(f)) return 0; m.set(f, clone(v)); return 1; },
  async hset(k, o) { const m = h(k); for (const [f, v] of Object.entries(o)) m.set(f, clone(v)); return 1; },
  async hdel(k, f) { return h(k).delete(f) ? 1 : 0; },
  async hgetall(k) { const m = hs.get(k); return m && m.size ? Object.fromEntries([...m].map(([f, v]) => [f, clone(v)])) : null; },
};
export class Redis {
  constructor() { Object.assign(this, cmds); }
  pipeline() {
    const fila = [];
    const p = new Proxy({}, { get: (_, nome) => nome === "exec" ? async () => { const r = []; for (const [c, a] of fila) r.push(await cmds[c](...a)); return r; } : (...a) => (fila.push([nome, a]), p) });
    return p;
  }
}
