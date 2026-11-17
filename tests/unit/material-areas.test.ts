import { describe, expect, it } from "vitest";
import { addAnalysisCase } from "../../src/domain/analysis";
import { prepareCoreInput } from "../../src/domain/core-input";
import {
  newProject,
  exampleProject,
  serializeProject,
  type Project,
} from "../../src/domain/model";
import {
  prepareFixedCircleGeometry,
  type FixedCircleGeometry,
} from "../../src/core/fixed-circle";
import { partitionMaterialAreas } from "../../src/core/material-areas";

const profile = { toleranceM: 1e-8, maxArcDegrees: 3 };
const segment = (distance: number) =>
  25 * Math.acos(distance / 5) - distance * Math.sqrt(25 - distance * distance);
const totalArea = segment(4);
function fixture() {
  const base = newProject("Áreas analíticas");
  const section = base.sections[0];
  section.terrain = [
    { x: -10, y: 0 },
    { x: 10, y: 0 },
  ];
  section.base = -2;
  section.backgroundMaterialId = base.materials[0].id;
  section.waterMode = "dry";
  section.waterSource = "Caso próprio de geometria";
  section.loadCondition = "none";
  base.materials.push({
    ...base.materials[0],
    id: "inclusion",
    name: "Solo da região",
  });
  const { project: p, analysisCase: c } = addAnalysisCase(base, section.id);
  Object.assign(c, {
    description: "Partição geométrica",
    direction: "left-to-right",
    methods: ["fellenius"],
    surfaceMode: "fixed",
    fixedCircle: { x: 0, y: 4, radius: 5 },
    waterCondition: "section",
    loadCondition: "section",
  });
  return { p, c, s: p.sections[0], backgroundId: base.materials[0].id };
}
function region(
  p: Project,
  points: number[][],
  id = "region",
  materialId: string | null = "inclusion",
) {
  const r = {
    id,
    name: id,
    materialId,
    points: points.map(([x, y]) => ({ x, y })),
  };
  p.sections[0].regions.push(r);
  return r;
}
const run = (p: Project, settings = profile) =>
  prepareFixedCircleGeometry(
    prepareCoreInput(p, p.analysisCases[0].id),
    settings,
  );
function prepared(p: Project, settings = profile) {
  const result = run(p, settings);
  if (result.status !== "prepared")
    throw new Error(JSON.stringify(result.diagnostics));
  return result.geometry;
}
const area = (g: FixedCircleGeometry, materialId: string) =>
  g.materialAreas.find((m) => m.materialId === materialId)?.areaM2 ?? 0;
function conserved(g: FixedCircleGeometry) {
  for (const item of [g, ...g.slices]) {
    expect(Math.abs(item.areaBalance.residualM2)).toBeLessThanOrEqual(
      item.areaBalance.limitM2,
    );
    expect(item.areaBalance.sumM2).toBeCloseTo(item.areaM2, 10);
    for (const material of item.materialAreas) {
      expect(material.areaM2).toBeGreaterThan(0);
      expect(
        material.sources.reduce((sum, source) => sum + source.areaM2, 0),
      ).toBeCloseTo(material.areaM2, 12);
      expect(material.sources.every((source) => source.areaM2 > 0)).toBe(true);
    }
  }
}

describe("áreas até o arco, com referências independentes", () => {
  it("atribui a massa homogênea ao fundo, sem parâmetros físicos nem mutação", () => {
    const { p, backgroundId } = fixture();
    const before = serializeProject(p);
    const g = prepared(p);
    expect(area(g, backgroundId)).toBeCloseTo(totalArea, 12);
    expect(g.materialAreas).toHaveLength(1);
    expect(g.materialAreas[0].sources).toEqual([
      { regionId: null, areaM2: g.materialAreas[0].areaM2 },
    ]);
    expect(serializeProject(p)).toBe(before);
    expect(Object.isFrozen(g.materialAreas[0].sources[0])).toBe(true);
    expect(Object.isFrozen(g.slices[0].areaBalance)).toBe(true);
    expect(g.materialAreas[0]).not.toHaveProperty("weight");
    expect(run(p).contract).toBe("geostruct-fixed-geometry/2");
    conserved(g);
  });

  it.each([0, 0.05])(
    "confere estrato de inclinação %s por segmento circular oblíquo",
    (slope) => {
      const { p, backgroundId } = fixture();
      region(p, [
        [-10, -2],
        [10, -2],
        [10, -0.5 + 10 * slope],
        [-10, -0.5 - 10 * slope],
      ]);
      const expected = segment(4.5 / Math.sqrt(1 + slope * slope));
      const g = prepared(p);
      expect(area(g, "inclusion")).toBeCloseTo(expected, 11);
      expect(area(g, backgroundId)).toBeCloseTo(totalArea - expected, 11);
      expect(
        g.slices.some(
          (s) =>
            s.materialAreas.length === 2 && s.baseMaterialId === "inclusion",
        ),
      ).toBe(true);
      conserved(g);
    },
  );

  it("divide a massa em duas metades por interface vertical", () => {
    const { p, backgroundId } = fixture();
    region(p, [
      [-10, -2],
      [0, -2],
      [0, 0],
      [-10, 0],
    ]);
    const g = prepared(p);
    expect(area(g, "inclusion")).toBeCloseTo(totalArea / 2, 12);
    expect(area(g, backgroundId)).toBeCloseTo(totalArea / 2, 12);
    conserved(g);
  });

  it("inclui retângulo acima da base com área 0,08 m², sem atribuir toda a fatia ao material da base", () => {
    const { p, backgroundId } = fixture();
    region(p, [
      [-0.2, -0.3],
      [0.2, -0.3],
      [0.2, -0.1],
      [-0.2, -0.1],
    ]);
    const g = prepared(p);
    expect(area(g, "inclusion")).toBeCloseTo(0.08, 13);
    expect(area(g, backgroundId)).toBeCloseTo(totalArea - 0.08, 11);
    expect(g.slices.every((s) => s.baseMaterialId === backgroundId)).toBe(true);
    expect(g.slices).toHaveLength(25);
    conserved(g);
  });

  it("integra inclusão triangular por base × altura / 2", () => {
    const { p } = fixture();
    region(p, [
      [-0.9, -0.4],
      [0.9, -0.4],
      [0, -0.2],
    ]);
    const g = prepared(p);
    expect(area(g, "inclusion")).toBeCloseTo((1.8 * 0.2) / 2, 13);
    conserved(g);
  });

  it("integra região côncava com componentes verticais separados e fundo entre eles", () => {
    const { p, backgroundId } = fixture();
    region(p, [
      [-0.8, -0.6],
      [0.8, -0.6],
      [0.8, -0.4],
      [-0.4, -0.4],
      [-0.4, -0.2],
      [0.8, -0.2],
      [0.8, 0],
      [-0.8, 0],
    ]);
    const g = prepared(p);
    expect(area(g, "inclusion")).toBeCloseTo(1.6 * 0.6 - 1.2 * 0.2, 12);
    expect(area(g, backgroundId)).toBeCloseTo(totalArea - 0.72, 11);
    conserved(g);
  });

  it("soma regiões do mesmo material preservando parcelas e fundo de mesmo ID", () => {
    const { p, backgroundId } = fixture();
    region(
      p,
      [
        [-1, -0.4],
        [-0.5, -0.4],
        [-0.5, -0.2],
        [-1, -0.2],
      ],
      "left",
      backgroundId,
    );
    region(
      p,
      [
        [0.5, -0.4],
        [1, -0.4],
        [1, -0.2],
        [0.5, -0.2],
      ],
      "right",
      backgroundId,
    );
    const g = prepared(p);
    expect(g.materialAreas).toHaveLength(1);
    const sources = g.materialAreas[0].sources;
    expect(sources.map((source) => source.regionId)).toEqual([
      null,
      "left",
      "right",
    ]);
    expect(sources[1].areaM2).toBeCloseTo(0.1, 13);
    expect(sources[2].areaM2).toBeCloseTo(0.1, 13);
    expect(sources[0].areaM2).toBeCloseTo(totalArea - 0.2, 11);
    conserved(g);
  });

  it("não confunde materiais distintos com nomes iguais", () => {
    const { p } = fixture();
    p.materials[1].name = p.materials[0].name;
    region(p, [
      [-1, -0.4],
      [1, -0.4],
      [1, -0.2],
      [-1, -0.2],
    ]);
    expect(prepared(p).materialAreas).toHaveLength(2);
  });

  it("permite fundo sem atribuição quando as regiões cobrem toda a massa", () => {
    const { p, s } = fixture();
    s.backgroundMaterialId = null;
    region(p, [
      [-10, -2],
      [10, -2],
      [10, 0],
      [-10, 0],
    ]);
    const g = prepared(p);
    expect(g.materialAreas[0].sources).toHaveLength(1);
    expect(g.materialAreas[0].sources[0].regionId).toBe("region");
    expect(area(g, "inclusion")).toBeCloseTo(totalArea, 11);
    conserved(g);
  });

  it("compartilha interface com subdivisões diferentes sem sobrepor ou criar fundo artificial", () => {
    const { p, s, backgroundId } = fixture();
    s.backgroundMaterialId = null;
    region(
      p,
      [
        [-10, -2],
        [10, -2],
        [10, 0],
        [-10, -1],
      ],
      "lower",
    );
    region(
      p,
      [
        [-10, -1],
        [0, -0.5],
        [10, 0],
        [-10, 0],
      ],
      "upper",
      backgroundId,
    );
    const g = prepared(p);
    expect(area(g, "inclusion")).toBeCloseTo(
      segment(4.5 / Math.sqrt(1.0025)),
      11,
    );
    expect(
      g.materialAreas
        .flatMap((m) => m.sources)
        .every((source) => source.regionId !== null),
    ).toBe(true);
    conserved(g);
  });
});

describe("invariância e diagnóstico da composição", () => {
  it("preserva a composição do exemplo existente ao refinar e transladar as interfaces", () => {
    const original = exampleProject();
    const { project: p, analysisCase: c } = addAnalysisCase(
      original,
      original.sections[0].id,
    );
    Object.assign(c, {
      description: "Teste de partição",
      direction: "left-to-right",
      methods: ["fellenius"],
      surfaceMode: "fixed",
      fixedCircle: { x: 25, y: 25, radius: 20 },
      waterCondition: "section",
      loadCondition: "section",
    });
    const before = prepared(p);
    const fine = prepared(p, { ...profile, maxArcDegrees: 0.5 });
    for (const m of before.materialAreas)
      expect(area(fine, m.materialId)).toBeCloseTo(m.areaM2, 9);
    const s = p.sections[0];
    for (const point of [
      ...s.terrain,
      ...(s.water ?? []),
      ...s.regions.flatMap((r) => r.points),
    ]) {
      point.x += 100000;
      point.y += 100000;
    }
    s.base += 100000;
    s.loads.forEach((load) => {
      load.x1 += 100000;
      load.x2 += 100000;
    });
    c.fixedCircle.x! += 100000;
    c.fixedCircle.y! += 100000;
    const moved = prepared(p);
    for (const m of before.materialAreas)
      expect(area(moved, m.materialId)).toBeCloseTo(m.areaM2, 7);
  });

  it("conserva cada material sob refinamento, inversão dos contornos e ordem do cadastro", () => {
    const { p } = fixture();
    region(
      p,
      [
        [-0.9, -0.4],
        [-0.4, -0.4],
        [-0.4, -0.2],
        [-0.9, -0.2],
      ],
      "left",
    );
    region(
      p,
      [
        [0.4, -0.4],
        [0.9, -0.4],
        [0.9, -0.2],
        [0.4, -0.2],
      ],
      "right",
    );
    const coarse = prepared(p);
    p.sections[0].regions.reverse().forEach((r) => r.points.reverse());
    const fine = prepared(p, { ...profile, maxArcDegrees: 0.3 });
    for (const material of coarse.materialAreas)
      expect(area(fine, material.materialId)).toBeCloseTo(material.areaM2, 11);
    expect(
      fine.materialAreas.map((m) => m.sources.map((source) => source.regionId)),
    ).toEqual(
      coarse.materialAreas.map((m) =>
        m.sources.map((source) => source.regionId),
      ),
    );
    conserved(fine);
  });

  it.each([0.001, 1000])(
    "escala as áreas pelo quadrado da escala %s",
    (scale) => {
      const { p, s, c } = fixture();
      region(p, [
        [-1, -0.4],
        [1, -0.4],
        [1, -0.2],
        [-1, -0.2],
      ]);
      for (const point of [
        ...s.terrain,
        ...s.regions.flatMap((r) => r.points),
      ]) {
        point.x *= scale;
        point.y *= scale;
      }
      s.base *= scale;
      c.fixedCircle.y! *= scale;
      c.fixedCircle.radius! *= scale;
      expect(
        area(
          prepared(p, { ...profile, toleranceM: profile.toleranceM * scale }),
          "inclusion",
        ) /
          scale ** 2,
      ).toBeCloseTo(0.4, 11);
    },
  );

  it("preserva composição sob translação grande e espelhamento", () => {
    const { p, s, c } = fixture();
    region(p, [
      [-1.1, -0.4],
      [-0.3, -0.4],
      [-0.3, -0.2],
      [-1.1, -0.2],
    ]);
    const before = prepared(p);
    for (const point of [...s.terrain, ...s.regions.flatMap((r) => r.points)]) {
      point.x = 100000 - point.x;
      point.y += 100000;
    }
    s.terrain.reverse();
    s.base += 100000;
    c.fixedCircle.x = 100000;
    c.fixedCircle.y! += 100000;
    const after = prepared(p);
    for (const material of before.materialAreas)
      expect(area(after, material.materialId)).toBeCloseTo(material.areaM2, 8);
  });

  it("bloqueia região sem material que participa só acima da base", () => {
    const { p } = fixture();
    region(
      p,
      [
        [-1, -0.4],
        [1, -0.4],
        [1, -0.2],
        [-1, -0.2],
      ],
      "Sem atribuição",
      null,
    );
    const result = run(p);
    expect(result.status).toBe("blocked");
    expect(result.geometry).toBeNull();
    expect(result.diagnostics[0]).toMatchObject({
      code: "area-material-missing",
      message: expect.stringContaining("Sem atribuição"),
    });
  });

  it("ignora região sem material fora da massa e contato de área nula", () => {
    const { p, backgroundId } = fixture();
    region(
      p,
      [
        [5, -0.4],
        [6, -0.4],
        [6, -0.2],
        [5, -0.2],
      ],
      "outside",
      null,
    );
    region(
      p,
      [
        [-1, -2],
        [1, -2],
        [1, -1],
        [-1, -1],
      ],
      "tangent",
      null,
    );
    const g = prepared(p);
    expect(area(g, backgroundId)).toBeCloseTo(totalArea, 11);
    expect(g.materialAreas[0].sources).toHaveLength(1);
  });

  it("não disfarça discrepância geométrica distribuindo resíduo entre materiais", () => {
    const { p } = fixture();
    const input = prepareCoreInput(p, p.analysisCases[0].id).snapshot!.input;
    const g = prepared(p);
    const altered = g.slices.map((s, i) => ({
      ...s,
      areaM2: s.areaM2 + (i === 0 ? 0.001 : 0),
    }));
    expect(() =>
      partitionMaterialAreas(
        input.geometry,
        g.circle,
        altered,
        profile.toleranceM,
      ),
    ).toThrow(/não conservaram/);
  });

  it("recusa sobreposição mesmo se a conferência externa for omitida", () => {
    const { p } = fixture();
    const g = prepared(p);
    region(
      p,
      [
        [-1, -0.4],
        [1, -0.4],
        [1, -0.2],
        [-1, -0.2],
      ],
      "one",
    );
    region(
      p,
      [
        [-1, -0.3],
        [1, -0.3],
        [1, -0.1],
        [-1, -0.1],
      ],
      "two",
    );
    const input = prepareCoreInput(p, p.analysisCases[0].id).snapshot!.input;
    expect(() =>
      partitionMaterialAreas(
        input.geometry,
        g.circle,
        g.slices,
        profile.toleranceM,
      ),
    ).toThrow(/sobreposição/);
  });

  it("mantém uma inclusão fina de área positiva, sem filtrá-la por arredondamento de exibição", () => {
    const { p } = fixture();
    region(p, [
      [-1, -0.3],
      [1, -0.3],
      [1, -0.299999],
      [-1, -0.299999],
    ]);
    const g = prepared(p);
    expect(area(g, "inclusion")).toBeCloseTo(2e-6, 13);
    conserved(g);
  });

  it("não junta raízes de interfaces paralelas distintas próximas", () => {
    const { p, backgroundId } = fixture();
    region(
      p,
      [
        [-10, -2],
        [10, -2],
        [10, -0.5],
        [-10, -0.5],
      ],
      "lower",
    );
    region(
      p,
      [
        [-10, -0.5 + 1e-10],
        [10, -0.5 + 1e-10],
        [10, 0],
        [-10, 0],
      ],
      "upper",
      backgroundId,
    );
    const result = run(p);
    expect(result.geometry).toBeNull();
    expect(result.diagnostics[0].code).toBe("cuts-too-close");
  });

  it("confere o limite de intervalos antes de expandir milhares de parcelas", () => {
    const { p } = fixture();
    const g = prepared(p);
    const input = prepareCoreInput(p, p.analysisCases[0].id).snapshot!.input;
    const regions = Array.from({ length: 41 }, (_, index) => ({
      id: `many-${index}`,
      name: `Inclusão ${index}`,
      materialId: "inclusion",
      points: Array.from({ length: 500 }, (_, j) => {
        const angle = (2 * Math.PI * j) / 500 + 0.0001;
        return {
          x: -0.1 + index * 0.004 + 0.001 * Math.cos(angle),
          z: -0.3 + 0.001 * Math.sin(angle),
        };
      }),
    }));
    expect(() =>
      partitionMaterialAreas(
        { ...input.geometry, regions },
        g.circle,
        g.slices,
        profile.toleranceM,
      ),
    ).toThrow(/limite operacional/);
  });
});
