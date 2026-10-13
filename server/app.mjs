import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { assertCollection, isQuote, isServiceOrder } from "./validation.mjs";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const contentTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };
const securityHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; font-src 'self' data:",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...securityHeaders, "cache-control": "no-store", "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

async function jsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Corpo da requisição excede 2 MB.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch {
    const error = new Error("JSON inválido.");
    error.statusCode = 400;
    throw error;
  }
}

export function createApp({ database, publicDir }) {
  return async function app(req, res) {
    try {
      const url = new URL(req.url, "http://localhost");
      const match = url.pathname.match(/^\/api\/(orders|quotes)(?:\/([^/]+))?$/);
      if (url.pathname === "/api/health" && req.method === "GET") {
        const data = await database.read();
        return send(res, 200, { status: "ok", revision: data.revision });
      }
      if (match) {
        const [, collection, encodedId] = match;
        const id = encodedId ? decodeURIComponent(encodedId) : null;
        const data = await database.read();
        if (req.method === "GET" && !id)
          return send(res, 200, data[collection], { etag: `"${data.revision}"` });
        if (req.method === "PUT" && !id) {
          const body = await jsonBody(req);
          assertCollection(collection, body);
          const next = await database.update((draft) => ({ ...draft, [collection]: body }));
          return send(res, 200, next[collection], { etag: `"${next.revision}"` });
        }
        if (req.method === "PUT" && id) {
          const body = await jsonBody(req);
          const valid = collection === "orders" ? isServiceOrder(body) : isQuote(body);
          if (!valid || body.id !== id)
            return send(res, 422, { error: "Registro inválido ou ID divergente." });
          const next = await database.update((draft) => {
            const index = draft[collection].findIndex((item) => item.id === id);
            if (index === -1) draft[collection].unshift(body);
            else if (collection !== "orders" || body.updatedAt >= draft[collection][index].updatedAt)
              draft[collection][index] = body;
            return draft;
          });
          return send(res, 200, next[collection].find((item) => item.id === id), { etag: `"${next.revision}"` });
        }
        return send(res, 405, { error: "Método não permitido." }, { allow: "GET, PUT" });
      }

      if (req.method !== "GET" && req.method !== "HEAD")
        return send(res, 405, { error: "Método não permitido." });
      if (!publicDir) return send(res, 404, { error: "Rota não encontrada." });

      const root = resolve(publicDir);
      const relative = decodeURIComponent(url.pathname).replace(/^[/\\]+/, "") || "index.html";
      let file = resolve(root, relative);
      if (file !== root && !file.startsWith(`${root}${sep}`))
        return send(res, 400, { error: "Caminho inválido." });
      try { if (!(await stat(file)).isFile()) throw new Error("not a file"); }
      catch { file = join(publicDir, "index.html"); }
      res.writeHead(200, {
        ...securityHeaders,
        "content-type": contentTypes[extname(file)] || "application/octet-stream",
        "cache-control": file.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
      });
      if (req.method === "HEAD") return res.end();
      createReadStream(file).pipe(res);
    } catch (error) {
      if (!error.statusCode) console.error(error);
      send(res, error.statusCode || 500, { error: error.statusCode ? error.message : "Erro interno do servidor." });
    }
  };
}
