import { test, expect } from "@playwright/test";

// Software WebGL includes texture uploads and screenshot readback on the CPU.
test.setTimeout(60000);

test("modelo enviado carrega e as etapas abrem, separam e remontam o aparelho", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("Modelo detalhado carregado")).toBeVisible({ timeout: 20000 });
  const canvas = page.locator("canvas");
  await page.getByRole("button", { name: "Frente", exact: true }).click();
  await page.waitForTimeout(1200);
  const mounted = await canvas.screenshot();
  await page.getByRole("button", { name: /02\s*Abrir/ }).click();
  await expect(page.getByRole("slider", { name: "Desmontagem" })).toHaveValue("25");
  await page.waitForTimeout(1000);
  expect((await canvas.screenshot()).equals(mounted)).toBe(false);
  await page.getByRole("button", { name: /04\s*Separar/ }).click();
  await expect(page.getByRole("slider")).toHaveValue("100");
  await page.getByRole("button", { name: "Mostrar nomes", exact: true }).click();
  await expect(page.locator(".part-label").filter({ hasText: "Bateria de íons de lítio" })).toBeVisible();
  await page.screenshot({ path: "test-results/model-exploded.png", fullPage: true });
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await expect(page.getByRole("slider")).toHaveValue("0");
  await expect(page.locator(".part-label")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("isola o componente escolhido, permite inspeção e alterna para o esquema", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Modelo detalhado carregado")).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Bateria de íons de lítio", exact: true }).click();
  await page.getByRole("button", { name: "Isolar peça", exact: true }).click();
  await expect(page.getByRole("button", { name: "Isolar peça" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".part-label")).toHaveCount(1);
  await expect(page.locator(".part-label")).toHaveText("Bateria de íons de lítio");
  await page.waitForTimeout(1000);
  const bounds = (await page.locator("canvas").boundingBox())!;
  await page.locator("canvas").click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
  await expect(page.getByRole("heading", { name: "Bateria de íons de lítio", exact: true })).toBeVisible();
  await page.getByLabel("Diagnóstico técnico").fill("Bateria inspecionada no modelo detalhado.");
  await page.getByRole("button", { name: "Câmera principal 48 MP", exact: true }).click();
  await expect(page.locator(".part-label")).toHaveText("Câmera principal 48 MP");
  await page.getByRole("button", { name: "Esquema técnico", exact: true }).click();
  await expect(page.getByRole("button", { name: "Esquema técnico" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Modelo detalhado", exact: true }).click();
  await expect(page.getByText("Modelo detalhado carregado")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/model-isolated.png", fullPage: true });
});

test("falha no GLB mantém esquema, desmontagem e diagnóstico disponíveis", async ({ page }) => {
  await page.route("**/models/smartphone-disassembly.glb", (route) => route.fulfill({ status: 404, body: "Missing model" }));
  await page.goto("/");
  await expect(page.getByText("Modelo indisponível · esquema técnico ativo")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("slider").fill("60");
  await expect(page.getByText("60%", { exact: true })).toBeVisible();
  await page.getByLabel("Diagnóstico técnico").fill("Diagnóstico disponível sem o arquivo GLB.");
  await expect(page.getByLabel("Diagnóstico técnico")).toHaveValue("Diagnóstico disponível sem o arquivo GLB.");
});

test("controles cabem no celular e respeitam preferência por movimento reduzido", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByText("Modelo detalhado carregado")).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: /03\s*Internos/ }).click();
  await expect(page.getByRole("slider")).toHaveValue("60");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/model-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 812, height: 375 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
