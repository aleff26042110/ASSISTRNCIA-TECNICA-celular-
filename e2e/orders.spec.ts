import { test, expect } from "@playwright/test";
async function prepareQuote(
  page: import("@playwright/test").Page,
  name = "Ana Souza",
) {
  await page.goto("/");
  await page
    .getByLabel("Diagnóstico técnico")
    .fill("Câmera sem imagem após teste técnico.");
  await page.getByLabel("Peça (R$)", { exact: true }).fill("150");
  await page.getByLabel("Mão de obra (R$)", { exact: true }).fill("50");
  await page.getByRole("button", { name: "Adicionar ao orçamento" }).click();
  await page.getByRole("button", { name: /^Orçamento/ }).click();
  await page.getByLabel("Nome do cliente").fill(name);
  await page.getByLabel("Telefone com DDD").fill("11999991234");
}
async function createOrder(page: import("@playwright/test").Page) {
  await prepareQuote(page);
  await page
    .getByRole("button", { name: "Criar ordem de serviço", exact: true })
    .click();
  await expect(page).toHaveURL(/\/ordens\?os=/);
}
test("OS persiste, controla aprovação e checklist e protege notas internas no modo cliente", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await createOrder(page);
  await page.getByLabel("Técnico responsável").fill("Bruno");
  await page.getByLabel("Data prevista de entrega").fill("2000-01-01");
  await page.getByLabel("Condição de entrada").fill("Vidro com riscos");
  await page
    .getByLabel("Notas internas da assistência")
    .fill("NOTA INTERNA CONFIDENCIAL");
  await page.getByRole("button", { name: "Salvar dados de entrada" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Dados de atendimento salvos." }),
  ).toBeVisible();
  await page.getByLabel("Etapa do atendimento").selectOption("Em reparo");
  await expect(page.getByRole("alert")).toContainText("aprovação");
  await expect(page.getByLabel("Etapa do atendimento")).toHaveValue("Recebido");
  await page.getByLabel("Resposta do cliente").selectOption("Aprovado");
  await page
    .getByLabel("Como a resposta foi recebida")
    .fill("Cliente confirmou por telefone");
  await page
    .getByRole("button", { name: "Registrar resposta do cliente" })
    .click();
  await page.getByLabel("Etapa do atendimento").selectOption("Em reparo");
  await expect(page.getByLabel("Etapa do atendimento")).toHaveValue(
    "Em reparo",
  );
  await page
    .getByLabel("Etapa do atendimento")
    .selectOption("Pronto para retirada");
  await expect(page.getByRole("alert")).toContainText("checklist");
  for (const label of [
    "Tela e toque",
    "Câmera principal",
    "Câmera frontal",
    "Carregamento",
    "Áudio e microfone",
    "Botões e conectividade",
  ])
    await page
      .getByRole("combobox", { name: `Após o reparo: ${label}`, exact: true })
      .selectOption("Funcionando");
  await page
    .getByLabel("Etapa do atendimento")
    .selectOption("Pronto para retirada");
  await expect(page.getByLabel("Etapa do atendimento")).toHaveValue(
    "Pronto para retirada",
  );
  await page.reload();
  await expect(page.getByLabel("Técnico responsável")).toHaveValue("Bruno");
  await expect(page.getByLabel("Notas internas da assistência")).toHaveValue(
    "NOTA INTERNA CONFIDENCIAL",
  );
  await expect(
    page.getByRole("combobox", {
      name: "Após o reparo: Tela e toque",
      exact: true,
    }),
  ).toHaveValue("Funcionando");
  await expect(page.locator(".order-history")).toContainText(
    "Status alterado: Em reparo → Pronto para retirada.",
  );
  await page.getByRole("button", { name: "Apresentar ao cliente" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu aparelho, explicado." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "NOTA INTERNA CONFIDENCIAL",
  );
  await expect(page.getByTestId("total")).toHaveText(/200,00/);
  expect(errors).toEqual([]);
});
test("editar orçamento invalida autorização, sem duplicar a OS; novo atendimento limpa diagnóstico", async ({
  page,
}) => {
  await createOrder(page);
  await page.getByLabel("Resposta do cliente").selectOption("Aprovado");
  await page.getByLabel("Como a resposta foi recebida").fill("Na loja");
  await page
    .getByRole("button", { name: "Registrar resposta do cliente" })
    .click();
  await page.getByRole("button", { name: "Abrir na bancada 3D" }).click();
  await expect(page.getByLabel("Diagnóstico técnico")).toHaveValue(
    "Câmera sem imagem após teste técnico.",
  );
  await page.getByRole("button", { name: /^Orçamento/ }).click();
  await page.getByLabel("Peça (R$)", { exact: true }).fill("180");
  await page.getByRole("button", { name: "Atualizar e abrir OS" }).click();
  await expect(page.getByLabel("Etapa do atendimento")).toHaveValue(
    "Aguardando aprovação",
  );
  await expect(page.locator(".approval-summary")).toContainText("Pendente");
  await expect(page.locator(".order-history")).toContainText(
    "aprovação anterior invalidada",
  );
  await expect(
    page.getByRole("button", { name: /Abrir OS-0001 de/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Novo atendimento" }).click();
  await expect(page.getByLabel("Diagnóstico técnico")).toHaveValue("");
  await page.getByRole("button", { name: /^Orçamento/ }).click();
  await expect(page.getByLabel("Nome do cliente")).toHaveValue("");
  await expect(page.getByText("Câmera principal", { exact: true })).toHaveCount(
    0,
  );
});
test("busca, filtro, Kanban e CSV funcionam", async ({ page }) => {
  await createOrder(page);
  await page.getByRole("button", { name: "Novo atendimento" }).click();
  await prepareQuote(page, "Beatriz Lima");
  await page
    .getByRole("button", { name: "Criar ordem de serviço", exact: true })
    .click();
  await page.getByLabel("Etapa do atendimento").selectOption("Em diagnóstico");
  await page.getByLabel("Buscar ordens de serviço").fill("Ana");
  await expect(
    page.getByRole("button", {
      name: "Abrir OS-0001 de Ana Souza",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Abrir OS-0002 de Beatriz Lima",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByLabel("Buscar ordens de serviço").fill("");
  await page.getByLabel("Filtrar por status").selectOption("Em diagnóstico");
  await expect(
    page.getByRole("button", {
      name: "Abrir OS-0002 de Beatriz Lima",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Abrir OS-0001 de Ana Souza",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Kanban", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Kanban", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".kanban")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("cellvision-ordens.csv");
  await file.saveAs("/tmp/cellvision-ordens.csv");
});
for (const width of [360, 390, 768, 1440])
  test(`ordens e detalhes sem overflow em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await createOrder(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Kanban", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: `/tmp/cellvision-orders-${width}.png`,
        fullPage: true,
      });
  });

test('falha de armazenamento não cria uma OS falsamente salva',async({page})=>{
 await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='cellvision-service-orders')throw new DOMException('Quota excedida','QuotaExceededError');return original.call(this,key,value)}});
 await prepareQuote(page);await page.getByRole('button',{name:'Criar ordem de serviço',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Não foi possível salvar a OS');await expect(page).not.toHaveURL(/\/ordens/);expect(await page.evaluate(()=>localStorage.getItem('cellvision-service-orders'))).toBeNull();
});
test('dados de OS inválidos são preservados e a criação é bloqueada',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('cellvision-service-orders','{"registro":"inválido"}'));
 await page.goto('/ordens');await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');expect(await page.evaluate(()=>localStorage.getItem('cellvision-service-orders'))).toBe('{"registro":"inválido"}');
});
