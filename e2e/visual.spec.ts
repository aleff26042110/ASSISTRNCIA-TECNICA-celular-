import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1700 });
  await page.goto("/");
  await expect(page.getByText("Modelo detalhado carregado")).toBeVisible({ timeout: 20000 });
});

test("renderização muda com rotação, zoom e desmontagem e clique seleciona peça", async ({ page }) => {
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const initial = await canvas.screenshot();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 120, bounds.y + bounds.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("heading", { name: "Câmera principal 48 MP", exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  const rotated = await canvas.screenshot();
  expect(rotated.equals(initial)).toBe(false);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(500);
  const zoomed = await canvas.screenshot();
  expect(zoomed.equals(rotated)).toBe(false);
  await page.getByRole("slider").fill("100");
  await page.waitForTimeout(1000);
  expect((await canvas.screenshot()).equals(zoomed)).toBe(false);
  await page.getByRole("slider").fill("0");
  await page.getByRole("button", { name: "Restaurar câmera" }).click();
  await page.getByRole("button", { name: "Frente", exact: true }).click();
  await page.getByRole("button", { name: "Câmera principal 48 MP", exact: true }).click();
  await page.waitForTimeout(1200);
  await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
  await expect(page.getByRole("heading", { name: "Tela Super Retina XDR", exact: true })).toBeVisible();
});

test("pausa, inverte e restaura a desmontagem; fallback preserva formulário", async ({ page }) => {
  const slider = page.getByRole("slider");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  const paused = Number(await slider.inputValue());
  expect(paused).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  expect(Number(await slider.inputValue())).toBe(paused);
  // Start away from the endpoints to avoid racing a completed animation.
  await slider.fill("60");
  await page.getByRole("button", { name: "Inverter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inverter" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect.poll(async () => Number(await slider.inputValue())).toBeLessThan(60);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await expect(slider).toHaveValue("0");
  await expect(page.getByRole("button", { name: "Inverter" })).toHaveAttribute("aria-pressed", "false");
  await page.locator("canvas").evaluate((element) => element.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
  await expect(page.getByText(/O contexto gráfico foi interrompido/)).toBeVisible();
  await page.getByLabel("Diagnóstico técnico").fill("Formulário disponível sem 3D");
  await expect(page.getByLabel("Diagnóstico técnico")).toHaveValue("Formulário disponível sem 3D");
});
