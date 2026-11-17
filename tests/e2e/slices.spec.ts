import { test, expect, type Page } from "@playwright/test";
import { newProject, type Project } from "../../src/domain/model";
import { addAnalysisCase } from "../../src/domain/analysis";

function fixture() {
  const base = newProject("Geometria analítica");
  const s = base.sections[0];
  s.terrain = [
    { x: -10, y: 0 },
    { x: 10, y: 0 },
  ];
  s.base = -2;
  s.backgroundMaterialId = base.materials[0].id;
  s.waterMode = "dry";
  s.waterSource = "Caso geométrico próprio";
  s.loadCondition = "none";
  const { project: p, analysisCase: c } = addAnalysisCase(base, s.id);
  Object.assign(c, {
    name: "Círculo analítico",
    description: "Geometria, sem FS",
    direction: "left-to-right",
    methods: ["fellenius"],
    surfaceMode: "fixed",
    fixedCircle: { x: 0, y: 4, radius: 5 },
    waterCondition: "section",
    loadCondition: "section",
  });
  return { p, c };
}
async function selectCase(page: Page) {
  await page
    .getByRole("button", { name: "Círculo analítico", exact: true })
    .click();
  await page.locator(".fixed-circle-preview > summary").click();
  return page.getByRole("region", {
    name: "Geometria do círculo fixo",
    exact: true,
  });
}
async function open(page: Page, p: Project) {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "geometria.geo.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(p)),
  });
  return selectCase(page);
}
async function save(page: Page): Promise<Project> {
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Salvar projeto", exact: true })
    .click();
  const stream = (await (await download).createReadStream())!;
  let text = "";
  for await (const chunk of stream) text += chunk.toString();
  return JSON.parse(text);
}
async function prepare(page: Page) {
  await page
    .getByLabel("Tolerância geométrica (m)", { exact: true })
    .fill("0,00000001");
  await page
    .getByRole("button", { name: "Preparar fatias", exact: true })
    .click();
}

test("prepara, desenha e inspeciona o segmento circular sem alterar o arquivo", async ({
  page,
}) => {
  const { p } = fixture();
  await page.setViewportSize({ width: 960, height: 640 });
  const panel = await open(page, p);
  await expect(
    page.getByRole("button", { name: "Preparar fatias", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Abertura máxima por fatia (°)", { exact: true }),
  ).toHaveValue("3");
  await prepare(page);
  await expect(panel).toContainText("25 fatias preparadas");
  await expect(page.locator("[data-slice]")).toHaveCount(25);
  await page
    .getByRole("button", { name: "Inspecionar fatias", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Inspeção das fatias",
    exact: true,
  });
  await expect(dialog).toContainText("4,0875277 m²");
  await expect(
    dialog
      .getByRole("table", { name: "Fatias geométricas", exact: true })
      .getByRole("row"),
  ).toHaveCount(26);
  await dialog.locator("summary").click();
  await expect(
    dialog.getByRole("table", { name: "Origem dos cortes", exact: true }),
  ).toContainText("Encontro com terreno");
  await dialog
    .getByRole("button", { name: "Fechar janela", exact: true })
    .click();
  expect(await save(page)).toEqual(p);
  await page
    .getByLabel("Abertura máxima por fatia (°)", { exact: true })
    .fill("1,5");
  await expect(page.locator("[data-slice-preview]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Preparar fatias", exact: true })
    .click();
  await expect(panel).toContainText("50 fatias preparadas");
  await expect(page.locator("[data-slice]")).toHaveCount(50);
  expect(await save(page)).toEqual(p);
});

test("rascunho não prepara fatias e uma alteração aplicada oculta a geometria antiga", async ({
  page,
}) => {
  const { p } = fixture();
  const panel = await open(page, p);
  await prepare(page);
  await page.getByLabel("Centro Z do caso (m)", { exact: true }).fill("5");
  await expect(
    page.getByRole("button", { name: "Preparar fatias", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("[data-slice-preview]")).toHaveCount(0);
  await expect(panel).toContainText("Aplique ou descarte o rascunho");
  await page.getByRole("button", { name: "Aplicar caso", exact: true }).click();
  await page.locator(".fixed-circle-preview > summary").click();
  await expect(panel).not.toContainText("25 fatias preparadas");
  await page
    .getByRole("button", { name: "Preparar fatias", exact: true })
    .click();
  await expect(panel.getByLabel("Diagnósticos da geometria")).toContainText(
    "tangência",
  );
  await expect(page.locator("[data-slice-preview]")).toHaveCount(0);
  await page.getByRole("tab", { name: "Geometria", exact: true }).click();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await selectCase(page);
  await page
    .getByRole("button", { name: "Preparar fatias", exact: true })
    .click();
  await expect(page.locator("[data-slice]")).toHaveCount(25);
  expect(await save(page)).toEqual(p);
});

test("alteração compartilhada invalida a prévia e o círculo antigo não passa para outro caso", async ({
  page,
}) => {
  const { p, c } = fixture();
  const duplicate = addAnalysisCase(p, p.sections[0].id, c.id);
  duplicate.analysisCase.name = "Outro círculo";
  const panel = await open(page, duplicate.project);
  await prepare(page);
  await expect(page.locator("[data-slice]")).toHaveCount(25);
  await page
    .getByRole("button", { name: "Outro círculo", exact: true })
    .click();
  await expect(page.locator("[data-slice-preview]")).toHaveCount(0);
  await selectCase(page);
  await expect(page.locator("[data-slice]")).toHaveCount(25);
  await page.getByRole("button", { name: "Solo 1", exact: true }).click();
  await page
    .getByLabel("Peso específico total γ (kN/m³)", { exact: true })
    .fill("19");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await selectCase(page);
  await expect(panel).not.toContainText("25 fatias preparadas");
  await expect(page.locator("[data-slice-preview]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Preparar fatias", exact: true })
    .click();
  await expect(page.locator("[data-slice]")).toHaveCount(25);
});

test("perfil inválido e limite operacional produzem diagnóstico sem truncar fatias", async ({
  page,
}) => {
  const { p } = fixture();
  const panel = await open(page, p);
  await page
    .getByLabel("Tolerância geométrica (m)", { exact: true })
    .fill("-1");
  await page
    .getByRole("button", { name: "Preparar fatias", exact: true })
    .click();
  await expect(panel.getByLabel("Diagnósticos da geometria")).toContainText(
    "tolerância geométrica positiva",
  );
  await page
    .getByLabel("Tolerância geométrica (m)", { exact: true })
    .fill("1e-8");
  await page
    .getByLabel("Abertura máxima por fatia (°)", { exact: true })
    .fill("0,00000001");
  await page
    .getByRole("button", { name: "Preparar fatias", exact: true })
    .click();
  await expect(panel.getByLabel("Diagnósticos da geometria")).toContainText(
    "limite operacional de 2000",
  );
  await expect(page.locator("[data-slice-preview]")).toHaveCount(0);
  expect(await save(page)).toEqual(p);
});
