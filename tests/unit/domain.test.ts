import { describe, expect, it } from "vitest";
import {
  exampleProject,
  newProject,
  parseProject,
  serializeProject,
  duplicateSection,
} from "../../src/domain/model";
import {
  diagnose,
  regionError,
  lineError,
  polygonError,
  parseCoordinates,
  parseNumber,
  elevation,
} from "../../src/domain/geometry";
import { history, commit, undo, redo } from "../../src/domain/history";

describe("Arquivos e identidade", () => {
  it("preserva um projeto completo em ida e volta", () => {
    const p = exampleProject();
    expect(parseProject(serializeProject(p))).toEqual(p);
  });
  it("não inventa parâmetros de solo em projeto novo", () => {
    const m = newProject("Novo").materials[0];
    expect([m.gamma, m.cohesion, m.friction]).toEqual([null, null, null]);
  });
  it.each(["bad", "{}", '{"format":"geostruct","version":2}'])(
    "rejeita estrutura incompatível %s",
    (text) => {
      expect(() => parseProject(text)).toThrow();
    },
  );
  it("rejeita material referenciado inexistente", () => {
    const p = exampleProject();
    p.sections[0].backgroundMaterialId = "missing";
    expect(() => parseProject(JSON.stringify(p))).toThrow(
      /Material inexistente/,
    );
  });
  it("rejeita identificadores repetidos", () => {
    const p = exampleProject();
    p.materials[1].id = p.materials[0].id;
    expect(() => parseProject(JSON.stringify(p))).toThrow(/duplicados/);
  });
  it.each([-1, 90, Infinity])("rejeita atrito inválido %s", (v) => {
    const p = exampleProject();
    p.materials[0].friction = v;
    expect(() => serializeProject(p)).toThrow();
  });
  it("duplica a seção sem compartilhar objetos ou IDs", () => {
    const s = exampleProject().sections[0],
      copy = duplicateSection(s);
    expect(copy.id).not.toBe(s.id);
    expect(copy.regions[0].id).not.toBe(s.regions[0].id);
    copy.terrain[0].x = 33;
    expect(s.terrain[0].x).toBe(0);
    expect(copy.backgroundMaterialId).toBe(s.backgroundMaterialId);
  });
});
describe("Geometria independente do desenho", () => {
  it("exemplo inicial não tem inconsistências", () => {
    expect(diagnose(exampleProject())).toEqual([]);
  });
  it("interpola por segmento sem extrapolar", () => {
    const t = [
      { x: 0, y: 10 },
      { x: 10, y: 20 },
      { x: 20, y: 10 },
    ];
    expect(elevation(t, 5)).toBe(15);
    expect(elevation(t, 10)).toBe(20);
    expect(elevation(t, -1)).toBeNull();
  });
  it("não aceita perfil invertido ou vertical", () => {
    expect(
      lineError([
        { x: 1, y: 0 },
        { x: 0, y: 2 },
      ]),
    ).toBeTruthy();
    expect(
      lineError([
        { x: 1, y: 0 },
        { x: 1, y: 2 },
      ]),
    ).toBeTruthy();
  });
  it("identifica auto-interseção", () => {
    expect(
      polygonError([
        { x: 0, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
        { x: 4, y: 0 },
      ]),
    ).toMatch(/cruza/);
  });
  it("permite regiões adjacentes, mas não sobreposição", () => {
    const s = newProject("P").sections[0];
    s.terrain = [
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ];
    s.base = 0;
    s.regions = [
      {
        id: "r",
        name: "esquerda",
        materialId: s.backgroundMaterialId,
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 10 },
          { x: 0, y: 10 },
        ],
      },
    ];
    expect(
      regionError(s, [
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 5, y: 10 },
      ]),
    ).toBeNull();
    expect(
      regionError(s, [
        { x: 4, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 4, y: 10 },
      ]),
    ).toMatch(/sobrepõe/);
  });
  it("rejeita região com aresta fora do terreno mesmo com vértices dentro", () => {
    const s = newProject("P").sections[0];
    s.base = 0;
    s.terrain = [
      { x: 0, y: 10 },
      { x: 5, y: 2 },
      { x: 10, y: 10 },
    ];
    expect(
      regionError(s, [
        { x: 1, y: 7 },
        { x: 9, y: 7 },
        { x: 5, y: 1 },
      ]),
    ).toMatch(/inteiramente/);
  });
  it("identifica vazio na cobertura da água e subida acima do terreno", () => {
    const p = exampleProject();
    p.sections[0].water = [
      { x: 5, y: 30 },
      { x: 40, y: 30 },
    ];
    const ds = diagnose(p);
    expect(ds.some((d) => d.message.includes("não cobre"))).toBe(true);
    expect(ds.some((d) => d.message.includes("acima do terreno"))).toBe(true);
  });
  it("identifica faixas inválidas sem mover silenciosamente seus limites", () => {
    const p = exampleProject();
    p.sections[0].loads[0].x2 = 100;
    expect(
      diagnose(p).some(
        (d) => d.level === "error" && d.target === p.sections[0].loads[0].id,
      ),
    ).toBe(true);
  });
  it("aceita decimal brasileiro e tabulação sem transformar vazio em zero", () => {
    expect(parseCoordinates("0,5\t10\n5 ; 8,2")).toEqual([
      { x: 0.5, y: 10 },
      { x: 5, y: 8.2 },
    ]);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("1.2.3")).toBeNull();
    expect(parseNumber("1e309")).toBeNull();
    expect(() => parseCoordinates("1 2 3")).toThrow(/Linha 1/);
  });
});
describe("Histórico transacional", () => {
  it("desfaz, refaz e invalida o futuro após nova edição", () => {
    let h = commit(history(1), 2);
    h = commit(h, 3);
    h = undo(h);
    expect(h.present).toBe(2);
    expect(redo(h).present).toBe(3);
    h = commit(h, 4);
    expect(h.future).toEqual([]);
    expect(undo(h).present).toBe(2);
  });
  it("não cria passos para alterações nulas e limita a memória", () => {
    let h = history(0);
    h = commit(h, 0);
    expect(h.past).toHaveLength(0);
    for (let n = 1; n < 80; n++) h = commit(h, n);
    expect(h.past).toHaveLength(50);
  });
});
