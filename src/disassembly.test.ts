import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { components } from "./data";
import { importedAssemblies, partProgress } from "./disassembly";

describe("desmontagem do modelo importado", () => {
  it("abre o exterior antes de liberar os componentes internos e volta a montar", () => {
    expect(partProgress(25, 0)).toBeGreaterThan(0.8);
    expect(partProgress(25, 0.42)).toBe(0);
    expect(partProgress(60, 0.22)).toBe(1);
    expect(partProgress(100, 0.6)).toBe(1);
    for (const component of components) {
      expect(partProgress(0, component.stage)).toBe(0);
      expect(partProgress(100, component.stage)).toBe(1);
    }
  });

  it("inclui todas as malhas e texturas, com IDs válidos e geometria reduzida", () => {
    const file = readFileSync(new URL("../public/models/smartphone-disassembly.glb", import.meta.url));
    expect(file.readUInt32LE(0)).toBe(0x46546c67);
    expect(file.readUInt32LE(8)).toBe(file.length);
    const document = JSON.parse(file.toString("utf8", 20, 20 + file.readUInt32LE(12)));
    const names = new Set(document.nodes.map((node: { name: string }) => node.name));
    expect(names.size).toBe(15);
    expect(importedAssemblies.every((assembly) => names.has(assembly.mesh))).toBe(true);
    expect(new Set(importedAssemblies.map((assembly) => assembly.mesh)).size).toBe(15);
    expect(importedAssemblies.every((assembly) => components.some((component) => component.id === assembly.component))).toBe(true);
    expect(document.images).toHaveLength(3);
    expect(document.images.every((image: { bufferView: number }) => document.bufferViews[image.bufferView].byteLength > 0)).toBe(true);
    const triangles = document.meshes.reduce((sum: number, mesh: { primitives: { indices: number }[] }) =>
      sum + document.accessors[mesh.primitives[0].indices].count / 3, 0);
    expect(triangles).toBeGreaterThan(100000);
    expect(triangles).toBeLessThan(200000);
  });
});
