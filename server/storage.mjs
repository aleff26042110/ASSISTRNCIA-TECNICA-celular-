import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const emptyDatabase = () => ({ version: 1, revision: 0, orders: [], quotes: [] });

export class JsonDatabase {
  #file;
  #queue = Promise.resolve();
  constructor(file) { this.#file = file; }

  async read() {
    try {
      const parsed = JSON.parse(await readFile(this.#file, "utf8"));
      if (parsed?.version !== 1 || !Array.isArray(parsed.orders) || !Array.isArray(parsed.quotes))
        throw new Error("Formato de banco incompatível.");
      return parsed;
    } catch (error) {
      if (error?.code === "ENOENT") return emptyDatabase();
      throw error;
    }
  }

  async update(mutator) {
    const operation = this.#queue.then(async () => {
      const current = await this.read();
      const next = mutator(structuredClone(current));
      next.revision = current.revision + 1;
      await mkdir(dirname(this.#file), { recursive: true });
      const temporary = `${this.#file}.${process.pid}.${crypto.randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(next, null, 2), "utf8");
      await rename(temporary, this.#file);
      return next;
    });
    this.#queue = operation.catch(() => undefined);
    return operation;
  }
}
