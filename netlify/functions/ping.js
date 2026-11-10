// Función mínima de diagnóstico (sin dependencias)
export async function handler(event) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ ok: true, fn: "ping", time: new Date().toISOString() }),
  };
}
