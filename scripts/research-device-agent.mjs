#!/usr/bin/env node
/**
 * Coletor local de evidências públicas para aparelhos do catálogo CellVision.
 * Não usa login, não contorna bloqueios e nunca publica dados automaticamente.
 *
 * Uso:
 *   node scripts/research-device-agent.mjs validate research/iphone-15
 *   node scripts/research-device-agent.mjs collect research/iphone-15
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const command = process.argv[2] ?? "validate";
const workspace = resolve(process.argv[3] ?? "research/iphone-15");
const allowedHosts = new Set(["support.apple.com", "www.ifixit.com"]);

const readJson = async (name) =>
  JSON.parse(await readFile(join(workspace, name), "utf8"));

function validateSource(source) {
  const url = new URL(source.url);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new Error(`Fonte fora do escopo permitido: ${source.url}`);
  }
  if (!source.id || !source.publisher || !source.title) {
    throw new Error("Toda fonte precisa de id, publisher e title.");
  }
}

async function validate() {
  const sources = await readJson("sources.json");
  const manifest = await readJson("component-manifest.json");
  if (!Array.isArray(sources) || sources.length < 3) {
    throw new Error("O catálogo exige pelo menos três fontes públicas.");
  }
  sources.forEach(validateSource);
  const sourceIds = new Set(sources.map((source) => source.id));
  if (sourceIds.size !== sources.length)
    throw new Error("IDs de fonte duplicados.");
  if (
    manifest.device !== "iPhone 15" ||
    manifest.representation !== "educational"
  ) {
    throw new Error(
      "Manifesto precisa declarar o aparelho e o caráter educacional.",
    );
  }
  for (const component of manifest.components) {
    if (!component.id || !component.name || !component.accuracy) {
      throw new Error("Componente sem id, nome ou precisão declarada.");
    }
    if (!component.sourceIds?.length) {
      throw new Error(`${component.id}: componente sem fonte.`);
    }
    for (const id of component.sourceIds) {
      if (!sourceIds.has(id))
        throw new Error(`${component.id}: fonte desconhecida ${id}.`);
    }
  }
  console.log(
    `Manifesto válido: ${manifest.components.length} componentes, ${sources.length} fontes.`,
  );
}

function publicText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function collect() {
  await validate();
  const sources = await readJson("sources.json");
  const snapshots = join(workspace, "snapshots");
  await mkdir(snapshots, { recursive: true });
  const records = [];
  for (const source of sources) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(source.url, {
        headers: { "user-agent": "CellVision-Public-Research/1.0" },
        signal: controller.signal,
      });
      validateSource({ ...source, url: response.url });
      if (!response.ok)
        throw new Error(`${source.id}: HTTP ${response.status}`);
      const html = await response.text();
      if (Buffer.byteLength(html) > 4 * 1024 * 1024) {
        throw new Error(`${source.id}: resposta acima do limite de 4 MB.`);
      }
      const text = publicText(html);
      const hash = createHash("sha256").update(html).digest("hex");
      await writeFile(join(snapshots, `${source.id}.txt`), text, "utf8");
      records.push({
        id: source.id,
        url: source.url,
        finalUrl: response.url,
        capturedAt: new Date().toISOString(),
        sha256: hash,
        textFile: `snapshots/${source.id}.txt`,
      });
      console.log(
        `${source.id}: ${text.length} caracteres públicos coletados.`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  await writeFile(
    join(workspace, "capture-manifest.json"),
    `${JSON.stringify(records, null, 2)}\n`,
    "utf8",
  );
  console.log(`Coleta concluída em ${basename(workspace)}.`);
}

try {
  if (command === "validate") await validate();
  else if (command === "collect") await collect();
  else throw new Error(`Comando desconhecido: ${command}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
