import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.mjs";
import { JsonDatabase } from "./storage.mjs";

const servers = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done)))));

const quote = {
  id: "quote-1", customer: { name: "Ana", phone: "11999999999" }, device: "Teste",
  date: "2026-10-13", items: [{ id: "item-1", componentId: "screen", name: "Tela", problem: "Quebrada", partPrice: 100, laborPrice: 50 }],
  discount: 0, deadline: "2 dias", notes: "",
};
const order = {
  id: "order-1", number: "OS-0001", createdAt: "2026-10-13T12:00:00.000Z", updatedAt: "2026-10-13T12:01:00.000Z",
  status: "Recebido", technician: "Bia", dueDate: "", serialNumber: "", accessories: "", condition: "", internalNotes: "",
  quote, diagnoses: {}, before: [], after: [], approval: { state: "Pendente", recordedAt: null, note: "" }, history: [],
};

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "cellvision-"));
  const file = join(directory, "database.json");
  const server = createServer(createApp({ database: new JsonDatabase(file), publicDir: null }));
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  servers.push(server);
  const address = server.address();
  return { file, url: `http://127.0.0.1:${address.port}` };
}

describe("API do CellVision", () => {
  it("persiste orçamentos e expõe a saúde do serviço", async () => {
    const { file, url } = await fixture();
    const saved = await fetch(`${url}/api/quotes`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify([quote]) });
    expect(saved.status).toBe(200);
    expect(saved.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await fetch(`${url}/api/quotes`).then((r) => r.json())).toEqual([quote]);
    expect(await fetch(`${url}/api/health`).then((r) => r.json())).toEqual({ status: "ok", revision: 1 });
    expect(JSON.parse(await readFile(file, "utf8")).quotes).toEqual([quote]);
  });

  it("rejeita payload inválido sem destruir dados válidos", async () => {
    const { url } = await fixture();
    await fetch(`${url}/api/quotes`, { method: "PUT", body: JSON.stringify([quote]) });
    const invalid = await fetch(`${url}/api/quotes`, { method: "PUT", body: JSON.stringify([{ ...quote, discount: -1 }]) });
    expect(invalid.status).toBe(422);
    expect(await fetch(`${url}/api/quotes`).then((r) => r.json())).toEqual([quote]);
  });

  it("serializa gravações concorrentes sem corromper o arquivo", async () => {
    const { file, url } = await fixture();
    await Promise.all(Array.from({ length: 8 }, (_, index) => fetch(`${url}/api/quotes/${index}`, {
      method: "PUT", body: JSON.stringify({ ...quote, id: String(index) }),
    })));
    const stored = JSON.parse(await readFile(file, "utf8"));
    expect(stored.quotes).toHaveLength(8);
    expect(stored.revision).toBe(8);
  });

  it("não deixa uma atualização antiga sobrescrever uma OS mais nova", async () => {
    const { url } = await fixture();
    await fetch(`${url}/api/orders/${order.id}`, { method: "PUT", body: JSON.stringify(order) });
    const stale = { ...order, updatedAt: "2026-10-13T12:00:30.000Z", technician: "Valor antigo" };
    const response = await fetch(`${url}/api/orders/${order.id}`, { method: "PUT", body: JSON.stringify(stale) });
    expect((await response.json()).technician).toBe("Bia");
    expect((await fetch(`${url}/api/orders`).then((r) => r.json()))[0].technician).toBe("Bia");
  });
});
