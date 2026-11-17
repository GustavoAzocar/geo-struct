import { describe, expect, it } from "vitest";
import { addAnalysisCase } from "../../src/domain/analysis";
import { prepareCoreInput } from "../../src/domain/core-input";
import {
  exampleProject,
  newProject,
  serializeProject,
  type Project,
} from "../../src/domain/model";
import {
  prepareFixedCircleGeometry,
  type GeometryProfile,
} from "../../src/core/fixed-circle";
import { segmentCircleIntersections } from "../../src/core/circle-geometry";

const profile: GeometryProfile = { toleranceM: 1e-8, maxArcDegrees: 3 };
function fixture() {
  const base = newProject("Segmento circular analítico");
  const s = base.sections[0];
  s.terrain = [
    { x: -10, y: 0 },
    { x: 10, y: 0 },
  ];
  s.base = -2;
  s.backgroundMaterialId = base.materials[0].id;
  s.waterMode = "dry";
  s.waterSource = "Geometria de teste";
  s.loadCondition = "none";
  const { project: p, analysisCase: c } = addAnalysisCase(base, s.id);
  Object.assign(c, {
    description: "Caso geométrico, sem FS",
    direction: "left-to-right",
    methods: ["fellenius"],
    surfaceMode: "fixed",
    fixedCircle: { x: 0, y: 4, radius: 5 },
    waterCondition: "section",
    loadCondition: "section",
  });
  return { p, c, s: p.sections[0] };
}
const run = (p: Project, settings = profile) =>
  prepareFixedCircleGeometry(
    prepareCoreInput(p, p.analysisCases[0].id),
    settings,
  );
function geometry(p: Project, settings = profile) {
  const result = run(p, settings);
  if (result.status !== "prepared")
    throw new Error(JSON.stringify(result.diagnostics));
  return result.geometry;
}
const code = (p: Project, expected: string, settings = profile) => {
  const result = run(p, settings);
  expect(result.status).toBe("blocked");
  expect(result.geometry).toBeNull();
  expect(result.diagnostics[0].code).toBe(expected);
};

describe("interseções e áreas independentes", () => {
  it("reproduz X = ±3 e área 25 acos(4/5) − 12 sem depender da integração por fatia", () => {
    const { p } = fixture();
    const before = serializeProject(p),
      result = run(p);
    expect(result.status).toBe("prepared");
    expect(result.intersections).toHaveLength(2);
    expect(result.intersections[0].point.x).toBeCloseTo(-3, 12);
    expect(result.intersections[1].point.x).toBeCloseTo(3, 12);
    expect(result.intersections.every((hit) => hit.kind === "transverse")).toBe(
      true,
    );
    const g = geometry(p);
    expect(g.areaM2).toBeCloseTo(25 * Math.acos(4 / 5) - 12, 11);
    expect(g.slices).toHaveLength(25);
    for (const slice of g.slices) {
      expect(slice.widthM).toBeGreaterThan(0);
      expect(slice.areaM2).toBeGreaterThan(0);
      expect(slice.centralAngleRadians).toBeLessThanOrEqual(
        (3 * Math.PI) / 180 + 1e-14,
      );
      expect(slice.chordLengthM).toBeCloseTo(
        2 * 5 * Math.sin(slice.centralAngleRadians / 2),
        12,
      );
      expect(slice.arcLengthM).toBeGreaterThan(slice.chordLengthM);
      expect(slice.widthM).toBeCloseTo(
        slice.chordLengthM * Math.cos(slice.chordAngleRadians),
        12,
      );
      expect(
        Math.hypot(slice.arcMidpoint.x, slice.arcMidpoint.z - 4),
      ).toBeCloseTo(5, 12);
    }
    expect(serializeProject(p)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(g.slices[0].left)).toBe(true);
    expect(result).not.toHaveProperty("factorOfSafety");
    expect(g.slices[0]).not.toHaveProperty("weight");
  });

  it("conserva área sob refinamento e mantém os cortes obrigatórios", () => {
    const { p, s } = fixture();
    s.terrain.splice(1, 0, { x: 0, y: 0 });
    const coarse = geometry(p),
      fine = geometry(p, { ...profile, maxArcDegrees: 0.3 });
    expect(fine.slices.length).toBeGreaterThan(coarse.slices.length);
    expect(fine.areaM2).toBeCloseTo(coarse.areaM2, 12);
    expect(fine.cuts.find((cut) => cut.x === 0)?.reasons).toContainEqual({
      kind: "terrain-vertex",
      index: 1,
    });
    expect(fine.cuts[0].x).toBe(coarse.cuts[0].x);
    expect(fine.cuts.at(-1)!.x).toBe(coarse.cuts.at(-1)!.x);
  });

  it("mantém o referencial ao inverter a direção e é invariante à translação", () => {
    const { p, c, s } = fixture();
    const original = run(p);
    c.direction = "right-to-left";
    expect(run(p).geometry).toEqual(original.geometry);
    expect(run(p).inputRevision).not.toBe(original.inputRevision);
    for (const point of s.terrain) {
      point.x += 100000;
      point.y += 100000;
    }
    s.base += 100000;
    c.fixedCircle.x! += 100000;
    c.fixedCircle.y! += 100000;
    const moved = geometry(p);
    expect(moved.areaM2).toBeCloseTo(original.geometry!.areaM2, 8);
    expect(moved.slices.length).toBe(original.geometry!.slices.length);
  });

  it.each([0.001, 1000])("preserva escala geométrica %s", (scale) => {
    const { p, s, c } = fixture();
    s.terrain.forEach((pt) => {
      pt.x *= scale;
      pt.y *= scale;
    });
    s.base *= scale;
    c.fixedCircle.y! *= scale;
    c.fixedCircle.radius! *= scale;
    const area = geometry(p, {
      ...profile,
      toleranceM: profile.toleranceM * scale,
    }).areaM2;
    expect(area / (scale * scale)).toBeCloseTo(25 * Math.acos(4 / 5) - 12, 11);
  });

  it("desduplica o vértice de terreno compartilhado com rastreabilidade dos segmentos", () => {
    const { p, s } = fixture();
    s.terrain.splice(1, 0, { x: -3, y: 0 });
    const result = run(p);
    expect(result.status).toBe("prepared");
    expect(result.intersections[0]).toEqual({
      point: { x: -3, z: 0 },
      segments: [0, 1],
      kind: "transverse",
    });
    expect(result.geometry!.cuts[0].reasons).toContainEqual({
      kind: "terrain-vertex",
      index: 1,
    });
  });

  it("confere terreno inclinado pela área de segmento definida pela distância à reta", () => {
    const { p, s } = fixture();
    s.terrain = [
      { x: -10, y: -2 },
      { x: 10, y: 2 },
    ];
    s.base = -3;
    const perpendicularDistance = 4 / Math.sqrt(1.04);
    const expected =
      25 * Math.acos(perpendicularDistance / 5) -
      perpendicularDistance * Math.sqrt(25 - perpendicularDistance ** 2);
    const g = geometry(p);
    expect(g.areaM2).toBeCloseTo(expected, 11);
    expect(g.cuts[0].x).toBeCloseTo((1.6 - Math.sqrt(40)) / 2.08, 12);
    expect(g.cuts.at(-1)!.x).toBeCloseTo((1.6 + Math.sqrt(40)) / 2.08, 12);
  });

  it("espelha uma seção assimétrica preservando área, larguras e invertendo a inclinação geométrica", () => {
    const { p, s } = fixture();
    s.terrain = [
      { x: -10, y: 0 },
      { x: -1, y: 0 },
      { x: -1, y: 0.5 },
      { x: 10, y: 0.5 },
    ];
    const original = geometry(p);
    s.terrain = s.terrain.map((pt) => ({ x: -pt.x, y: pt.y })).reverse();
    const reflected = geometry(p);
    expect(reflected.areaM2).toBeCloseTo(original.areaM2, 11);
    expect(reflected.slices.length).toBe(original.slices.length);
    for (let i = 0; i < original.slices.length; i++) {
      const left = original.slices[i],
        right = reflected.slices.at(-i - 1)!;
      expect(right.widthM).toBeCloseTo(left.widthM, 12);
      expect(right.areaM2).toBeCloseTo(left.areaM2, 12);
      expect(right.chordAngleRadians).toBeCloseTo(-left.chordAngleRadians, 12);
    }
  });

  it("usa apenas o ramo inferior em segmentos verticais e orientação reversa", () => {
    const c = { x: 0, z: 4, radius: 5 };
    const a = { x: 0, z: -3 },
      b = { x: 0, z: 10 };
    const roots = segmentCircleIntersections(c, a, b, profile.toleranceM);
    expect(roots).toEqual([{ x: 0, z: -1 }]);
    expect(segmentCircleIntersections(c, b, a, profile.toleranceM)).toEqual(
      roots,
    );
  });

  it("prepara o exemplo existente sem alterar parâmetros ou inventar resultados", () => {
    const base = exampleProject();
    const { project: p, analysisCase: c } = addAnalysisCase(
      base,
      base.sections[0].id,
    );
    Object.assign(c, {
      description: "Geometria ilustrativa",
      direction: "left-to-right",
      methods: ["bishop"],
      surfaceMode: "fixed",
      fixedCircle: { x: 25, y: 25, radius: 20 },
      waterCondition: "section",
      loadCondition: "section",
    });
    const g = geometry(p);
    expect(g.slices.length).toBeGreaterThan(25);
    expect(g.areaM2).toBeGreaterThan(0);
    expect(
      g.cuts.some((cut) =>
        cut.reasons.some((reason) => reason.kind === "material-interface"),
      ),
    ).toBe(true);
  });
});

describe("transições e condições efetivas", () => {
  it("mantém as cotas unilaterais de uma face vertical interna", () => {
    const { p, s } = fixture();
    s.terrain = [
      { x: -10, y: 0 },
      { x: -0.5, y: 0 },
      { x: -0.5, y: 0.5 },
      { x: 10, y: 0.5 },
    ];
    const g = geometry(p);
    const before = g.slices.find((slice) => slice.right.x === -0.5)!;
    const after = g.slices.find((slice) => slice.left.x === -0.5)!;
    expect(before.right.topZ).toBe(0);
    expect(after.left.topZ).toBe(0.5);
    expect(before.right.baseZ).toBe(after.left.baseZ);
    expect(g.cuts.find((cut) => cut.x === -0.5)?.reasons).toHaveLength(2);
    expect(g.areaM2).toBeCloseTo(
      geometry(p, { ...profile, maxArcDegrees: 0.5 }).areaM2,
      10,
    );
  });

  it("delimita geometricamente um cruzamento em face vertical sem atribuir forças", () => {
    const { p, s } = fixture();
    s.base = -3;
    s.terrain = [
      { x: -10, y: -1.5 },
      { x: -2, y: -1.5 },
      { x: -2, y: 0 },
      { x: 10, y: 0 },
    ];
    const result = run(p);
    expect(result.status).toBe("prepared");
    expect(result.intersections[0].point.x).toBe(-2);
    expect(result.geometry!.slices[0].left.topZ).toBe(0);
    expect(result.geometry!.slices[0].left.baseZ).toBeCloseTo(
      4 - Math.sqrt(21),
      12,
    );
  });

  it("combina motivos coincidentes e separa materiais na base, água e faixas selecionadas", () => {
    const { p, c, s } = fixture();
    p.materials.push({
      ...p.materials[0],
      id: "left-material",
      name: "Material à esquerda",
    });
    s.regions = [
      {
        id: "left-region",
        name: "Região esquerda",
        materialId: "left-material",
        points: [
          { x: -10, y: -2 },
          { x: 0, y: -2 },
          { x: 0, y: 0 },
          { x: -10, y: 0 },
        ],
      },
    ];
    s.water = [
      { x: -4, y: -0.5 },
      { x: 0, y: -0.5 },
      { x: 4, y: -0.5 },
    ];
    c.waterCondition = "piezometric";
    c.waterSource = "Linha do caso";
    s.loads = [
      {
        id: "selected-load",
        name: "Faixa",
        x1: 0,
        x2: 1,
        q: 0,
        source: "Teste",
        enabled: false,
      },
    ];
    c.loadCondition = "selected";
    c.loadIds = ["selected-load"];
    const g = geometry(p);
    const zero = g.cuts.find((cut) => cut.x === 0)!;
    expect(zero.reasons.map((r) => r.kind)).toEqual(
      expect.arrayContaining([
        "material-interface",
        "water-node",
        "load-boundary",
      ]),
    );
    expect(
      g.slices
        .filter((slice) => slice.right.x <= 0)
        .every((slice) => slice.baseMaterialId === "left-material"),
    ).toBe(true);
    expect(
      g.slices
        .filter((slice) => slice.left.x >= 0)
        .every((slice) => slice.baseMaterialId === p.materials[0].id),
    ).toBe(true);
    expect(
      g.cuts.filter((cut) =>
        cut.reasons.some((r) => r.kind === "water-intersection"),
      ),
    ).toHaveLength(2);
    expect(g.areaM2).toBeCloseTo(25 * Math.acos(4 / 5) - 12, 11);
    c.waterCondition = "dry";
    c.loadCondition = "none";
    const dry = geometry(p);
    expect(
      dry.cuts.some((cut) =>
        cut.reasons.some(
          (r) => r.kind.startsWith("water") || r.kind === "load-boundary",
        ),
      ),
    ).toBe(false);
  });

  it("não escolhe o primeiro material quando falta atribuição na base", () => {
    const { p, s } = fixture();
    s.backgroundMaterialId = null;
    code(p, "base-material-missing");
  });

  it("recusa base indistinguível de uma interface pela tolerância informada", () => {
    const { p, s } = fixture();
    s.regions = [
      {
        id: "near-base",
        name: "Interface próxima",
        materialId: p.materials[0].id,
        points: [
          { x: -10, y: -0.999 },
          { x: 10, y: -0.999 },
          { x: 10, y: -2 },
          { x: -10, y: -2 },
        ],
      },
    ];
    const result = run(p, { toleranceM: 0.01, maxArcDegrees: 3 });
    expect(result.status).toBe("blocked");
    expect(result.geometry).toBeNull();
    expect(result.diagnostics[0].code).toBe("base-on-interface");
  });
});

describe("diagnósticos sem geometrias parciais", () => {
  it("recusa ausência de interseções e tangência", () => {
    const { p, c } = fixture();
    c.fixedCircle.y = 10;
    code(p, "no-intersections");
    c.fixedCircle.y = 5;
    code(p, "terrain-contact");
    c.fixedCircle.y = -4;
    code(p, "no-intersections");
  });
  it("recusa domínio truncado e contato com a base", () => {
    const { p, s } = fixture();
    s.terrain[0].x = -3;
    code(p, "truncated-domain");
    s.terrain[0].x = -10;
    s.base = -1;
    code(p, "base-contact");
  });
  it("não escolhe um par dentre múltiplos cruzamentos", () => {
    const { p, s } = fixture();
    s.base = -3;
    s.terrain = [
      [-6, 0],
      [-3, 1],
      [-2, -2],
      [0, 0],
      [2, -2],
      [3, 1],
      [6, 0],
    ].map(([x, y]) => ({ x, y }));
    code(p, "intersection-count");
  });
  it("sinaliza linha sem cobertura ou condições não definidas", () => {
    const { p, c, s } = fixture();
    c.waterCondition = null;
    code(p, "conditions-pending");
    c.waterCondition = "piezometric";
    c.waterSource = "Teste";
    code(p, "water-line-missing");
    s.water = [
      { x: -2, y: -0.5 },
      { x: 2, y: -0.5 },
    ];
    code(p, "water-coverage");
  });
  it("não trata seleção vazia de cargas como ausência explícita", () => {
    const { p, c } = fixture();
    c.loadCondition = "selected";
    code(p, "conditions-pending");
  });
  it("não elimina uma faixa fina com cortes distintos próximos", () => {
    const { p, s } = fixture();
    s.loadCondition = "loads";
    s.loads = [
      {
        id: "thin-load",
        name: "Faixa fina",
        x1: 0,
        x2: 0.00005,
        q: null,
        source: "Teste",
        enabled: true,
      },
    ];
    code(p, "cuts-too-close", { ...profile, toleranceM: 0.0001 });
  });
  it("recusa busca e círculo incompleto sem usar o círculo de tentativa", () => {
    const { p, c, s } = fixture();
    s.circle = { x: 0, y: 4, radius: 5 };
    c.fixedCircle.radius = null;
    code(p, "circle-incomplete");
    c.surfaceMode = "search";
    code(p, "fixed-circle-required");
  });
  it.each([0, -1, NaN, Infinity])(
    "recusa tolerância inválida %s",
    (toleranceM) => {
      const { p } = fixture();
      code(p, "invalid-profile", { ...profile, toleranceM });
    },
  );
  it.each([0, 3.1, NaN])("recusa abertura inválida %s", (maxArcDegrees) => {
    const { p } = fixture();
    code(p, "invalid-profile", { ...profile, maxArcDegrees });
  });
  it("verifica capacidade antes de gerar bilhões de fatias", () => {
    const { p } = fixture();
    code(p, "capacity-exceeded", { ...profile, maxArcDegrees: 1e-8 });
  });
  it("propaga indisponibilidade e erro de modelagem", () => {
    const { p, c, s } = fixture();
    const invalid = prepareFixedCircleGeometry(
      prepareCoreInput(p, "missing"),
      profile,
    );
    expect(invalid.status).toBe("blocked");
    expect(invalid.inputRevision).toBeNull();
    s.base = 1;
    code(p, "model-error");
    expect(c.fixedCircle).toEqual({ x: 0, y: 4, radius: 5 });
  });
});
