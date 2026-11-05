// Imitação mínima do Netlify Blobs com etag, suficiente para os testes.
const mem = new Map();
let n = 0;
export const getStore = () => ({
  async get(k) { return mem.has(k) ? JSON.parse(mem.get(k).v) : null; },
  async getWithMetadata(k) { const e = mem.get(k); return e ? { data: JSON.parse(e.v), etag: e.etag, metadata: {} } : null; },
  async setJSON(k, v, o = {}) {
    const e = mem.get(k);
    if (o.onlyIfNew && e) return { modified: false };
    if (o.onlyIfMatch && (!e || e.etag !== o.onlyIfMatch)) return { modified: false };
    const etag = `"${++n}"`; mem.set(k, { v: JSON.stringify(v), etag }); return { modified: true, etag };
  },
});
