import type { Page } from "@playwright/test";
import { addAnalysisCase } from "../../src/domain/analysis";
import {
  newProject,
  serializeProject,
  type Project,
} from "../../src/domain/model";
export function fixture() {
  const base = newProject("Fellenius na interface");
  Object.assign(base.materials[0], {
    name: "Solo do talude",
    gamma: 18,
    cohesion: 5,
    friction: 30,
    mode: "effective",
    source: "Caso próprio de conferência",
  });
  Object.assign(base.sections[0], {
    terrain: [
      { x: -10, y: 5 },
      { x: 10, y: -5 },
    ],
    base: -10,
    backgroundMaterialId: base.materials[0].id,
    waterMode: "dry",
    loadCondition: "none",
  });
  const { project: p, analysisCase: c } = addAnalysisCase(
    base,
    base.sections[0].id,
  );
  Object.assign(c, {
    name: "Círculo de referência",
    direction: "left-to-right",
    methods: ["fellenius"],
    surfaceMode: "fixed",
    fixedCircle: { x: 0, y: 4, radius: 5 },
    waterCondition: "section",
    loadCondition: "section",
  });
  return p;
}
export async function select(page: Page, name = "Círculo de referência") {
  await page.getByRole("button", { name, exact: true }).click();
  const details = page.locator(".fixed-circle-preview");
  if ((await details.getAttribute("open")) === null)
    await details.locator(":scope > summary").click();
}
export async function open(page: Page, p: Project) {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "fellenius.geo.json",
    mimeType: "application/json",
    buffer: Buffer.from(serializeProject(p)),
  });
  await select(page);
}
export async function prepare(page: Page, angle = "3") {
  await page
    .getByLabel("Tolerância geométrica (m)", { exact: true })
    .fill("1e-8");
  await page
    .getByLabel("Abertura máxima por fatia (°)", { exact: true })
    .fill(angle);
  await page
    .getByRole("button", { name: "Preparar fatias", exact: true })
    .click();
}
export async function calculate(page: Page, driving = "0", tension = "0") {
  await page
    .getByLabel("Limiar motriz τD (kN/m)", { exact: true })
    .fill(driving);
  await page
    .getByLabel("Tolerância de tração τt (kPa)", { exact: true })
    .fill(tension);
  await page
    .getByRole("button", { name: "Calcular Fellenius", exact: true })
    .click();
}
export async function save(page: Page): Promise<Project> {
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Salvar projeto", exact: true })
    .click();
  const stream = (await (await event).createReadStream())!;
  let data = "";
  for await (const chunk of stream) data += chunk.toString();
  return JSON.parse(data);
}
