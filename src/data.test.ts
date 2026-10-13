import { describe, expect, it } from "vitest";
import { components, phone, researchSources } from "./data";

describe("catálogo técnico do iPhone 15", () => {
  it("identifica o aparelho como estudo educacional não afiliado", () => {
    expect(phone.name).toBe("iPhone 15");
    expect(phone.demonstration).toBe(true);
    expect(phone.disclaimer).toMatch(/educacional/i);
    expect(phone.disclaimer).toMatch(/não.*Apple/i);
  });

  it("inclui os conjuntos essenciais para uma desmontagem útil", () => {
    const ids = new Set(components.map((component) => component.id));
    const required = [
      "screen",
      "frame",
      "back",
      "battery",
      "board",
      "main-camera",
      "ultra-camera",
      "front-camera",
      "taptic",
      "bottom-speaker",
      "wireless-coil",
      "usb",
    ];
    expect(required.every((id) => ids.has(id))).toBe(true);
    expect(ids.size).toBe(components.length);
  });

  it("distingue fatos documentados de aproximações visuais", () => {
    expect(components.every((component) => component.accuracy)).toBe(true);
    expect(
      components.some((component) => component.accuracy === "inferred"),
    ).toBe(true);
    expect(
      components.every((component) => component.sourceIds.length > 0),
    ).toBe(true);
  });

  it("mantém fontes públicas verificáveis e sem duplicação", () => {
    expect(researchSources.length).toBeGreaterThanOrEqual(3);
    expect(new Set(researchSources.map((source) => source.id)).size).toBe(
      researchSources.length,
    );
    expect(
      researchSources.every((source) => source.url.startsWith("https://")),
    ).toBe(true);
  });
});
