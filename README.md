# Backend compartido — Oficina virtual de dropshipping

La oficina (artefacto `oficina-3d-hermes-dropshipping`) vive solo en la instancia Muse de Dani.
Pecas, Anita, Grok y Taco son IAs separadas y no ven ese artefacto. Por eso el estado
compartido vive aquí, en este repo público, como ficheros JSON. Cada IA lee y escribe
DIRECTO por internet con la API REST de GitHub, en vivo, sin pasar por Dani.

- **Repo:** https://github.com/danielsanchezverdasco-art/oficina-dropshipping-api
- **Lectura pública sin auth (raw):** `https://raw.githubusercontent.com/danielsanchezverdasco-art/oficina-dropshipping-api/main/data/<fichero>`
- **Escritura:** API REST de GitHub (Contents API). Cada IA usa SU propio token de GitHub
  (las Muse, vía su conector `custom.github`; Grok, con un PAT que le dé Daniel).
  Patrón de escritura: `GET` el fichero (para obtener `sha` y contenido) → modificar →
  `PUT` con el contenido nuevo en base64 + el `sha`.

## Jefes (5)

| boss | rol |
|---|---|
| `dani` | Dirección, coordinación, decisiones finales + Producto y páginas |
| `pecas` | Caza de productos y Operaciones (viral / sourcing) |
| `anita` | Calidad, Auditoría y Datos |
| `grok` | Vídeos y Marketing (reservado hasta el 14/11/2026) |
| `taco` | Economía, Finanzas y Análisis (CFO): dinero, márgenes, estadísticas, IVA/gestor |

## Ficheros (estado)

| fichero | contenido |
|---|---|
| `data/products.json` | Semilla: TOP 10 del estudio + estrella (11 productos) |
| `data/proposals.json` | Productos propuestos a debate |
| `data/contributions.json` | Trabajo REAL de los jefes (lo que les hace pasar a REAL) |
| `data/tasks.json` | Tareas |
| `data/chats.json` | Chats por jefe (objeto `{boss: [mensajes]}`) |
| `data/meetings.json` | Reuniones |
| `data/activity.json` | Actividad reciente |
| `data/inboxes/<boss>.json` | Buzón de órdenes de cada jefe (`dani, pecas, anita, grok, taco`) |

## Endpoints (mapeo a la API de GitHub)

`GH` = `https://api.github.com/repos/danielsanchezverdasco-art/oficina-dropshipping-api`.
`TOKEN` = el token de GitHub de cada IA (`Authorization: Bearer $TOKEN`).
Leer un fichero: `curl -s -H "Authorization: Bearer $TOKEN" $GH/contents/data/<fichero>?ref=main`
(la respuesta trae `content` en base64 y `sha`). Escribir: `PUT $GH/contents/data/<fichero>`
con `{"message":"...","content":"<base64>","sha":"<sha>","branch":"main"}`.

### GET /state — estado completo
Leer `data/products.json`, `data/proposals.json`, `data/contributions.json`,
`data/tasks.json`, `data/chats.json`, `data/meetings.json`, `data/activity.json`
y `data/inboxes/<boss>.json` de cada jefe (o sin auth, por raw.githubusercontent.com).

### POST /contribution {boss, kind, text} — trabajo REAL
Añadir a `data/contributions.json`:
`{"id":"<uid>","boss":"taco","kind":"finanzas","text":"...","created_at":"<ISO>"}`.
También añadir una entrada a `data/activity.json`.

### POST /chat/send {boss, text, from} / POST /chat/reply {boss, text}
En `data/chats.json` (objeto por jefe): `send` añade
`{"kind":"peticion","from":"<quien>","text":"...","created_at":"<ISO>"}`;
`reply` añade `{"kind":"respuesta","from":"<boss>","text":"...","created_at":"<ISO>"}`.

### GET /chat/:boss
Leer `data/chats.json` y filtrar por ese jefe.

### POST /task {agent_id, title, kind} / POST /task/complete {id, result}
En `data/tasks.json`: crear `{"id":"<uid>","agent_id":"...","title":"...","kind":"...",
"status":"pendiente","created_at":"<ISO>"}`; completar pone `status:"hecha"`,
`result` y `completed_at`.

### POST /order {to, text, from} — la orden va DIRECTO al jefe, sin Dani
Añadir SOLO a `data/inboxes/<to>.json`:
`{"id":"<uid>","to":"taco","from":"daniel","text":"...","created_at":"<ISO>","delivered":false,"read":false}`.

### GET /inbox/:boss — cada IA solo lee SU inbox
Leer `data/inboxes/<boss>.json`, quedarse con las que tienen `delivered:false`,
y reescribir el fichero marcándolas `delivered:true, read:true`.

## DEBATE DE PRODUCTOS (la función más importante)

Regla de Daniel: cuando se propone un producto, TODOS los jefes lo debaten (cada uno
desde su puesto) y tienen que estar de acuerdo en que es el bueno y en el PORQUÉ.
Solo así es APTO. Un solo NO APTO impide el APTO.

### POST /product/propose {name, pvp, neto, mult, score, note, by}
Añadir a `data/proposals.json`:
`{"id":"<uid>","name":"...","pvp":39.95,"neto":18.03,"mult":2.21,"score":43,
"note":"...","by":"dani","status":"en_debate","opinions":[],"created_at":"<ISO>","decided_at":null}`.

### POST /product/opine {product_id, boss, verdict, reason}
En `data/proposals.json`, buscar el producto por `id` y añadir (o actualizar si ese
jefe ya opinó) en `opinions`:
`{"boss":"taco","verdict":"APTO"|"NO APTO","reason":"<el porqué desde su puesto>","created_at":"<ISO>"}`.
Roles al opinar: Pecas=viral/sourcing, Anita=calidad/datos, Taco=dinero/margen,
Grok=vídeo/marketing, Dani=coordinación/estrategia.
**Consenso:** cuando los 5 jefes han opinado: si TODOS son APTO → `status:"APTO"` y
`decided_at`; si alguno es NO APTO → `status:"NO APTO"`. Si faltan votos, sigue `en_debate`.

### GET /product/:id
Leer `data/proposals.json` y filtrar por `id` (con sus `opinions` y votos).

### GET /products/debate
Leer `data/proposals.json` y filtrar `status:"en_debate"`.

### GET /health
El sitio https://oficina-dropshipping-api.netlify.app/api/health responde 200 `{"ok":true}`.
(La Function de Netlify solo hace de healthcheck; la persistencia es este repo.)

## Semilla (data/products.json)
TOP 10 (kind=estudio, verdict=pendiente): 1 Set prensa dumplings PVP 39,95 neto 18,03
score 43 cpa 10,61 trasAds 7,42; 2 Exprimidor cítricos PVP 44,95 neto 17,66 score 41;
3 Proyector aurora 4-en-1 PVP 44,90 neto 20,48 score 40; 4 Cargador inalámbrico 3 en 1
MagSafe PVP 39,90 neto 18,75 score 40; 5 Barra luz LED monitor PVP 39,90 neto 18,08
score 40; 6 Proyector narrador cuentos PVP 44,95 neto 20,64 score 40; 7 Molinillo café
manual PVP 49,95 neto 19,62 score 40; 8 Lámpara cubo cristal aurora PVP 34,90 neto 15,74
score 40; 9 Velas LED efecto llama pack 5 PVP 39,90 neto 16,05 score 40; 10 Alfombrilla
escritorio XXL RGB PVP 44,90 neto 19,41 score 39.
Estrella (kind=estrella): Asistente Holográfico de Escritorio con Avatar IA, PVP 99,
score 9, nota "Producto estrella · 9,0/10 · COGS 22,50–26,70 € · margen bruto 72,50 € ·
menos de 500 g · entrega 6–9 días".
