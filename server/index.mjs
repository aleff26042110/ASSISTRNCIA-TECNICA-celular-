import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";
import { JsonDatabase } from "./storage.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const dataFile = resolve(process.env.DATA_FILE || resolve(root, "data", "cellvision.json"));
const database = new JsonDatabase(dataFile);
const server = createServer(createApp({ database, publicDir: resolve(root, "dist") }));

server.listen(port, host, () => {
  console.log(`CellVision disponível em http://${host}:${port}`);
  console.log(`Dados persistidos em ${dataFile}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
