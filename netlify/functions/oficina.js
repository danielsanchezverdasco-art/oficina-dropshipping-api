// Oficina Dropshipping — backend compartido (Netlify Function + Blobs)
// Las 4 IAs (Dani, Pecas, Anita, Grok) leen y escriben aquí DIRECTO por HTTP.
// Auth: Authorization: Bearer <API_KEY> o header x-api-key. /health es público.
// La API key NO está en el código: solo su hash SHA-256 (no reversible).
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

const AUTH_HASH = "425249a8a64d095838bd39646bd8ba06e63cfff5e03e07a1d7ad8fd445b54458";

const BOSSES = ["dani", "pecas", "anita", "grok", "taco"];

const SEED_PRODUCTS = [
  { id: "p1", kind: "estudio", rank: 1, name: "Set prensa dumplings", pvp: 39.95, neto: 18.03, score: 43, cpa: 10.61, trasAds: 7.42, note: null, verdict: "pendiente", created_at: "2026-11-10T19:36:48.417Z" },
  { id: "p2", kind: "estudio", rank: 2, name: "Exprimidor cítricos", pvp: 44.95, neto: 17.66, score: 41, cpa: null, trasAds: null, note: null, verdict: "pendiente", created_at: "2026-11-10T19:36:48.417Z" },
  { id: "p3", kind: "estudio", rank: 3, name: "Proyector aurora 4-en-1", pvp: 44.9, neto: 20.48, score: 40, cpa: null, trasAds: null, note: null, verdict: "pendiente", created_at: "2026-11-10T19:36:48.417Z" },
  { id: "p4", kind: "estudio", rank: 4, name: "Cargador inalámbrico 3 en 1 MagSafe", pvp: 39.9, neto: 18.75, score: 40, cpa: null, trasAds: null, note: null, verdict: "pendiente", created_at: "2026-11-10T19:36:48.417Z" },
  { id: "p5", kind: "estudio", rank: 5, name: "Barra luz LED monitor", pvp: 39.9, neto: 18.08, score: 40, cpa: null, trasAds: null, note: null, verdict: "pendiente", created_at: "2026-11-10T19:36:48.417Z" },
  { id: "p6", kind: "estudio", rank: 6, name: "Proyector narrador cuentos", pvp: 44.95, neto: 20.64, score: 40, cpa: null, trasAds: null, note: null, verdict: "pendiente", created_at: "2026-11-10T19:36:48.417Z" },
  { id: "p7", kind: "estudio", rank: 7, name: "Molinillo café manual", pvp: 49.95, neto: 19.62, score: 40, cpa: null, trasAds: null, note: null, verdict: "pendiente", created_at: "2026-11-10T19:36:48.417Z" },
  { id: "p8", kind: "estudio", rank: 8, name: "Lámpara cubo cristal aurora", pvp: 34.9, neto: 15.74, score: 40, cpa: null, trasAds: null, note: null, verdict: "pendiente", created_at: "2026-11-10T19:36:48.417Z" },
  { id: "p9", kind: "estudio", rank: 9, name: "Velas LED efecto llama pack 5", pvp: 39.9, neto: 16.05, score: 40, cpa: null, trasAds: null, note: null, verdict: "pendiente", created_at: "2026-11-10T19:36:48.417Z" },
  { id: "p10", kind: "estudio", rank: 10, name: "Alfombrilla escritorio XXL RGB", pvp: 44.9, neto: 19.41, score: 39, cpa: null, trasAds: null, note: null, verdict: "pendiente", created_at: "2026-11-10T19:36:48.417Z" },
  { id: "p11", kind: "estrella", rank: null, name: "Asistente Holográfico de Escritorio con Avatar IA", pvp: 99, neto: null, score: 9, cpa: null, trasAds: null, note: "Producto estrella · 9,0/10 · COGS 22,50–26,70 € · margen bruto 72,50 € · menos de 500 g · entrega 6–9 días", verdict: "pendiente", created_at: "2026-11-10T19:36:48.417Z" },
];

const store = () => getStore("oficina");

async function getJSON(key, fallback) {
  const v = await store().get(key, { type: "json" });
  return v === null || v === undefined ? fallback : v;
}
async function setJSON(key, value) {
  await store().setJSON(key, value);
}

async function ensureSeed() {
  const products = await getJSON("products", null);
  if (!products) {
    await setJSON("products", SEED_PRODUCTS);
    for (const k of ["tasks", "contributions", "meetings", "activity"]) {
      const cur = await getJSON(k, null);
      if (!cur) await setJSON(k, []);
    }
    const chats = await getJSON("chats", null);
    if (!chats) await setJSON("chats", {});
    for (const b of BOSSES) {
      const ib = await getJSON(`inbox:${b}`, null);
      if (!ib) await setJSON(`inbox:${b}`, []);
    }
    const proposals = await getJSON("proposals", null);
    if (!proposals) await setJSON("proposals", []);
  }
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const now = () => new Date().toISOString();

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, X-Api-Key, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function route(event) {
  let p = event.path || "/";
  const prefix = "/.netlify/functions/oficina";
  if (p.startsWith(prefix)) p = p.slice(prefix.length) || "/";
  if (p.startsWith("/api")) p = p.slice(4) || "/";
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return {};
  }
}

function authOk(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || "";
  const xkey = h["x-api-key"] || h["X-Api-Key"] || "";
  let provided = "";
  if (auth.startsWith("Bearer ")) provided = auth.slice(7);
  else if (xkey) provided = xkey;
  if (!provided) return false;
  const digest = createHash("sha256").update(provided).digest();
  const expected = Buffer.from(AUTH_HASH, "hex");
  if (digest.length !== expected.length) return false;
  try {
    return timingSafeEqual(digest, expected);
  } catch {
    return false;
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  const path = route(event);
  const method = event.httpMethod;

  if (path === "/health" && method === "GET") {
    return json(200, { ok: true, service: "oficina-dropshipping", time: now() });
  }

  if (!authOk(event)) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  try {
    await ensureSeed();

    // ---- GET /state ----
    if (path === "/state" && method === "GET") {
      const [products, tasks, contributions, chats, meetings, activity, proposals] = await Promise.all([
        getJSON("products", []),
        getJSON("tasks", []),
        getJSON("contributions", []),
        getJSON("chats", {}),
        getJSON("meetings", []),
        getJSON("activity", []),
        getJSON("proposals", []),
      ]);
      const inboxes = {};
      for (const b of BOSSES) inboxes[b] = await getJSON(`inbox:${b}`, []);
      return json(200, { ok: true, products, tasks, contributions, chats, meetings, activity, proposals, inboxes });
    }

    // ---- POST /contribution ----
    if (path === "/contribution" && method === "POST") {
      const b = parseBody(event);
      const boss = String(b.boss || "").toLowerCase();
      if (!BOSSES.includes(boss)) return json(400, { ok: false, error: "boss inválido (dani|pecas|anita|grok|taco)" });
      if (!b.text) return json(400, { ok: false, error: "falta text" });
      const rec = { id: uid(), boss, kind: b.kind || "trabajo", text: b.text, created_at: now() };
      const contributions = await getJSON("contributions", []);
      contributions.push(rec);
      await setJSON("contributions", contributions);
      const activity = await getJSON("activity", []);
      activity.push({ id: uid(), agent_id: boss, kind: rec.kind, text: rec.text, created_at: rec.created_at });
      await setJSON("activity", activity);
      return json(200, { ok: true, contribution: rec });
    }

    // ---- POST /chat/send ----
    if (path === "/chat/send" && method === "POST") {
      const b = parseBody(event);
      const boss = String(b.boss || "").toLowerCase();
      if (!BOSSES.includes(boss)) return json(400, { ok: false, error: "boss inválido" });
      if (!b.text) return json(400, { ok: false, error: "falta text" });
      const msg = { id: uid(), from: b.from || "daniel", text: b.text, kind: "peticion", created_at: now() };
      const chats = await getJSON("chats", {});
      (chats[boss] = chats[boss] || []).push(msg);
      await setJSON("chats", chats);
      return json(200, { ok: true, message: msg });
    }

    // ---- POST /chat/reply ----
    if (path === "/chat/reply" && method === "POST") {
      const b = parseBody(event);
      const boss = String(b.boss || "").toLowerCase();
      if (!BOSSES.includes(boss)) return json(400, { ok: false, error: "boss inválido" });
      if (!b.text) return json(400, { ok: false, error: "falta text" });
      const msg = { id: uid(), from: boss, text: b.text, kind: "respuesta", created_at: now() };
      const chats = await getJSON("chats", {});
      (chats[boss] = chats[boss] || []).push(msg);
      await setJSON("chats", chats);
      return json(200, { ok: true, message: msg });
    }

    // ---- GET /chat/:boss ----
    if (path.startsWith("/chat/") && method === "GET") {
      const boss = decodeURIComponent(path.slice(6).split("/")[0]).toLowerCase();
      if (!BOSSES.includes(boss)) return json(400, { ok: false, error: "boss inválido" });
      const chats = await getJSON("chats", {});
      return json(200, { ok: true, boss, messages: chats[boss] || [] });
    }

    // ---- POST /task ----
    if (path === "/task" && method === "POST") {
      const b = parseBody(event);
      if (!b.title) return json(400, { ok: false, error: "falta title" });
      const task = {
        id: uid(),
        agent_id: b.agent_id || "dani",
        agent_name: b.agent_name || b.agent_id || "dani",
        title: b.title,
        kind: b.kind || "tarea",
        status: "pendiente",
        result: null,
        created_at: now(),
        completed_at: null,
      };
      const tasks = await getJSON("tasks", []);
      tasks.push(task);
      await setJSON("tasks", tasks);
      return json(200, { ok: true, task });
    }

    // ---- POST /task/complete ----
    if (path === "/task/complete" && method === "POST") {
      const b = parseBody(event);
      const tasks = await getJSON("tasks", []);
      const t = tasks.find((x) => x.id === b.id);
      if (!t) return json(404, { ok: false, error: "tarea no encontrada" });
      t.status = "hecha";
      t.result = b.result || null;
      t.completed_at = now();
      await setJSON("tasks", tasks);
      const activity = await getJSON("activity", []);
      activity.push({ id: uid(), agent_id: t.agent_id, kind: t.kind, text: `${t.agent_id} completó «${t.title}»: ${t.result || ""}`.trim(), created_at: t.completed_at });
      await setJSON("activity", activity);
      return json(200, { ok: true, task: t });
    }

    // ---- POST /order (órdenes de Daniel directas al inbox de un jefe) ----
    if (path === "/order" && method === "POST") {
      const b = parseBody(event);
      const to = String(b.to || "").toLowerCase();
      if (!BOSSES.includes(to)) return json(400, { ok: false, error: "to inválido (pecas|anita|dani|grok|taco)" });
      if (!b.text) return json(400, { ok: false, error: "falta text" });
      const order = { id: uid(), to, text: b.text, from: b.from || "daniel", created_at: now(), delivered: false, read: false };
      const inbox = await getJSON(`inbox:${to}`, []);
      inbox.push(order);
      await setJSON(`inbox:${to}`, inbox);
      return json(200, { ok: true, order });
    }

    // ---- GET /inbox/:boss (recoge sus órdenes pendientes y las marca entregadas/leídas) ----
    if (path.startsWith("/inbox/") && method === "GET") {
      const boss = decodeURIComponent(path.slice(7).split("/")[0]).toLowerCase();
      if (!BOSSES.includes(boss)) return json(400, { ok: false, error: "boss inválido" });
      const inbox = await getJSON(`inbox:${boss}`, []);
      const pending = inbox.filter((o) => !o.delivered);
      if (pending.length) {
        for (const o of pending) { o.delivered = true; o.read = true; }
        await setJSON(`inbox:${boss}`, inbox);
      }
      return json(200, { ok: true, boss, orders: pending });
    }

    // ---- DEBATE DE PRODUCTO (decisión por consenso de TODOS los jefes) ----
    // Roles al opinar: Pecas=viral/sourcing, Anita=calidad/datos, Taco=dinero/margen,
    // Grok=vídeo/marketing, Dani=coordinación/estrategia.
    // Un producto solo es APTO cuando LOS 5 jefes votan APTO con su porqué.

    // ---- POST /product/propose ----
    if (path === "/product/propose" && method === "POST") {
      const b = parseBody(event);
      if (!b.name) return json(400, { ok: false, error: "falta name" });
      const proposal = {
        id: uid(),
        name: b.name,
        pvp: b.pvp ?? null,
        neto: b.neto ?? null,
        mult: b.mult ?? null,
        score: b.score ?? null,
        note: b.note || null,
        by: b.by || "daniel",
        status: "en_debate",
        opinions: [],
        created_at: now(),
        decided_at: null,
      };
      const proposals = await getJSON("proposals", []);
      proposals.push(proposal);
      await setJSON("proposals", proposals);
      return json(200, { ok: true, product: proposal });
    }

    // ---- POST /product/opine ----
    if (path === "/product/opine" && method === "POST") {
      const b = parseBody(event);
      const boss = String(b.boss || "").toLowerCase();
      if (!BOSSES.includes(boss)) return json(400, { ok: false, error: "boss inválido (dani|pecas|anita|grok|taco)" });
      const verdict = String(b.verdict || "").toUpperCase();
      if (verdict !== "APTO" && verdict !== "NO APTO") return json(400, { ok: false, error: "verdict debe ser APTO o NO APTO" });
      if (!b.reason) return json(400, { ok: false, error: "falta reason (el porqué)" });
      const proposals = await getJSON("proposals", []);
      const p = proposals.find((x) => x.id === b.product_id);
      if (!p) return json(404, { ok: false, error: "producto no encontrado" });
      if (p.status !== "en_debate") return json(400, { ok: false, error: `el producto ya está decidido (${p.status})` });
      const opinion = { boss, verdict, reason: b.reason, created_at: now() };
      const existing = p.opinions.findIndex((o) => o.boss === boss);
      if (existing >= 0) p.opinions[existing] = opinion;
      else p.opinions.push(opinion);
      // Consenso: solo APTO si LOS 5 jefes han opinado y TODOS dicen APTO con su porqué.
      const voted = new Set(p.opinions.map((o) => o.boss));
      const allVoted = BOSSES.every((x) => voted.has(x));
      const allApto = p.opinions.length > 0 && p.opinions.every((o) => o.verdict === "APTO");
      if (allVoted) {
        p.status = allApto ? "APTO" : "NO APTO";
        p.decided_at = now();
      }
      await setJSON("proposals", proposals);
      const activity = await getJSON("activity", []);
      activity.push({ id: uid(), agent_id: boss, kind: "debate", text: `${boss} opina ${verdict} sobre «${p.name}»: ${b.reason}`, created_at: opinion.created_at });
      await setJSON("activity", activity);
      return json(200, {
        ok: true,
        product: p,
        consensus: { allVoted, allApto, status: p.status, voted: p.opinions.length, total: BOSSES.length },
      });
    }

    // ---- GET /products/debate ----
    if (path === "/products/debate" && method === "GET") {
      const proposals = await getJSON("proposals", []);
      return json(200, { ok: true, products: proposals.filter((p) => p.status === "en_debate") });
    }

    // ---- GET /product/:id ----
    if (path.startsWith("/product/") && method === "GET") {
      const id = decodeURIComponent(path.slice(9).split("/")[0]);
      const proposals = await getJSON("proposals", []);
      const p = proposals.find((x) => x.id === id);
      if (!p) return json(404, { ok: false, error: "producto no encontrado" });
      return json(200, { ok: true, product: p });
    }

    return json(404, { ok: false, error: "ruta no encontrada" });
  } catch (e) {
    return json(500, { ok: false, error: String((e && e.message) || e) });
  }
}
