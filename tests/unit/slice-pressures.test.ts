import { describe, expect, it } from "vitest";
import {
  newProject,
  serializeProject,
  type Project,
} from "../../src/domain/model";
import { addAnalysisCase } from "../../src/domain/analysis";
import { prepareCoreInput } from "../../src/domain/core-input";
import {
  prepareFixedCircleGeometry,
  type FixedCirclePreparation,
} from "../../src/core/fixed-circle";
import { prepareSlicePressures } from "../../src/core/slice-pressures";
import { prepareSliceWeights } from "../../src/core/slice-weights";
import type { CoreInput, InputPreparation } from "../../src/core/input";

const profile = { toleranceM: 1e-8, maxArcDegrees: 2.8 };
function fixture() {
  const base = newProject("Pressões analíticas");
  base.materials[0].gamma = 18;
  const section = base.sections[0];
  Object.assign(section, {
    terrain: [
      { x: -10, y: 0 },
      { x: 10, y: 0 },
    ],
    base: -2,
    backgroundMaterialId: base.materials[0].id,
    waterMode: "piezometric",
    waterUnitWeight: 10,
    water: [
      { x: -10, y: -0.5 },
      { x: 10, y: -0.5 },
    ],
    waterSource: "Hipótese de verificação",
    loadCondition: "none",
  });
  const { project: p, analysisCase: c } = addAnalysisCase(base, section.id);
  Object.assign(c, {
    description: "Pressões prescritas sem FS",
    direction: "left-to-right",
    methods: ["fellenius"],
    surfaceMode: "fixed",
    fixedCircle: { x: 0, y: 4, radius: 5 },
    waterCondition: "section",
    loadCondition: "section",
  });
  return { p, c, s: p.sections[0] };
}
function prepare(p: Project, settings = profile) {
  const input = prepareCoreInput(p, p.analysisCases[0].id);
  const geometry = prepareFixedCircleGeometry(input, settings);
  return { input, geometry, result: prepareSlicePressures(input, geometry) };
}
function pressures(p: Project, settings = profile) {
  const { result } = prepare(p, settings);
  if (result.status !== "prepared")
    throw new Error(JSON.stringify(result.diagnostics));
  return result.pressures;
}
function bindWater(
  input: InputPreparation,
  geometry: FixedCirclePreparation,
  water: Partial<CoreInput["water"]>,
) {
  const data = {
    ...input.snapshot!.input,
    water: { ...input.snapshot!.input.water, ...water },
  };
  const revision = JSON.stringify(data);
  return {
    input: {
      ...input,
      snapshot: { input: data, revision },
    } as InputPreparation,
    geometry: { ...geometry, inputRevision: revision },
  };
}

describe("pressão prescrita com referências independentes", () => {
  it("obtém 5 kPa em (0, −1) para linha −0,5 e γw = 10", () => {
    const { p } = fixture();
    const data = pressures(p);
    const central = data.slices.find((s) => Math.abs(s.basePoint.x) < 1e-12)!;
    expect(central.basePoint.z).toBeCloseTo(-1, 12);
    expect(central.signedHeadM).toBeCloseTo(0.5, 12);
    expect(central.pressureKPa).toBeCloseTo(5, 12);
    expect(data.maxPressureKPa).toBeCloseTo(5, 12);
    expect(data.minPressureKPa).toBe(0);
    expect(data.positivePressureCount).toBe(19);
    expect(data.units).toEqual({
      length: "m",
      pressure: "kPa",
      unitWeight: "kN/m³",
    });
    expect(data.water).toMatchObject({
      mode: "piezometric",
      selection: "section",
      unitWeightKNPerM3: 10,
      source: "Hipótese de verificação",
    });
    expect(
      data.slices.some((s) => s.signedHeadM! < 0 && s.pressureKPa === 0),
    ).toBe(true);
  });

  it("usa altura vertical e ponto do arco, não o centro da corda ou da largura", () => {
    const { p, s } = fixture();
    s.water = [
      { x: -10, y: -1.1 },
      { x: 10, y: -0.1 },
    ]; // zp = −0,6 + 0,05x
    const { geometry, result } = prepare(p);
    if (geometry.status !== "prepared" || result.status !== "prepared")
      throw new Error("Preparação indisponível");
    for (const slice of result.pressures.slices) {
      const x = slice.basePoint.x;
      const z = 4 - Math.sqrt(25 - x * x);
      expect(slice.basePoint.z).toBeCloseTo(z, 12);
      expect(slice.piezometricZ).toBeCloseTo(-0.6 + 0.05 * x, 12);
      expect(slice.pressureKPa).toBeCloseTo(
        10 * Math.max(0, -0.6 + 0.05 * x - z),
        11,
      );
    }
    const i = result.pressures.slices.findIndex(
      (s) => s.pressureKPa > 1 && Math.abs(s.basePoint.x) > 1,
    );
    const g = geometry.geometry.slices[i],
      actual = result.pressures.slices[i];
    const chordX = (g.left.x + g.right.x) / 2;
    const chordZ = (g.left.baseZ + g.right.baseZ) / 2;
    expect(Math.abs(actual.basePoint.x - chordX)).toBeGreaterThan(1e-5);
    expect(
      Math.abs(actual.pressureKPa - 10 * (-0.6 + 0.05 * chordX - chordZ)),
    ).toBeGreaterThan(1e-4);
  });

  it("mantém zero na linha e acima dela, sem sucção", () => {
    const { p, s } = fixture();
    s.water = [
      { x: -10, y: -1 },
      { x: 10, y: -1 },
    ];
    expect(pressures(p).slices.every((s) => s.pressureKPa === 0)).toBe(true);
    const { input, geometry } = prepare(p);
    if (geometry.status !== "prepared")
      throw new Error("Geometria indisponível");
    // Ponto independente do arco (0, −1), para testar igualdade exata na linha.
    const one = {
      ...geometry,
      geometry: {
        ...geometry.geometry,
        slices: [
          {
            ...geometry.geometry.slices[0],
            left: { ...geometry.geometry.slices[0].left, x: -0.1 },
            right: { ...geometry.geometry.slices[0].right, x: 0.1 },
            arcMidpoint: { x: 0, z: -1 },
          },
        ],
      },
    };
    const result = prepareSlicePressures(input, one);
    expect(result.pressures?.slices[0]).toMatchObject({
      signedHeadM: 0,
      positiveHeadM: 0,
      pressureKPa: 0,
    });
    s.water!.forEach((p) => {
      p.y = -2;
    });
    expect(
      pressures(p).slices.every(
        (s) => s.signedHeadM! < 0 && s.pressureKPa === 0,
      ),
    ).toBe(true);
  });

  it("condição seca ignora linha e γw guardados, sem inventar cotas", () => {
    const { p, c, s } = fixture();
    c.waterCondition = "dry";
    c.waterSource = "Hipótese seca do caso";
    s.waterUnitWeight = null;
    s.water = [
      { x: -10, y: 10 },
      { x: 10, y: 10 },
    ];
    const data = pressures(p);
    expect(data.water).toMatchObject({
      mode: "dry",
      selection: "dry",
      source: "Hipótese seca do caso",
      unitWeightKNPerM3: null,
    });
    expect(
      data.slices.every(
        (s) =>
          s.pressureKPa === 0 &&
          s.piezometricZ === null &&
          s.signedHeadM === null &&
          s.waterSegmentIndex === null,
      ),
    ).toBe(true);
    expect(data.coverage.lineLeftX).toBeNull();
  });

  it("avalia nós e trechos da linha com origem determinística", () => {
    const { p } = fixture();
    const { input, geometry } = prepare(p);
    if (geometry.status !== "prepared")
      throw new Error("Geometria indisponível");
    const central = geometry.geometry.slices.find(
      (s) => Math.abs(s.arcMidpoint.x) < 1e-12,
    )!;
    const x = central.arcMidpoint.x;
    const bound = bindWater(input, geometry, {
      line: [
        { x: -10, z: -0.8 },
        { x, z: -0.25 },
        { x: 10, z: -0.9 },
      ],
    });
    const result = prepareSlicePressures(bound.input, bound.geometry);
    expect(
      result.pressures?.slices.find((s) => s.number === central.number),
    ).toMatchObject({
      piezometricZ: -0.25,
      pressureKPa: 7.5,
      waterSegmentIndex: 0,
    });
    expect(result.pressures!.slices.at(-1)!.waterSegmentIndex).toBe(1);
  });

  it("aceita cobertura do candidato mesmo sem cobrir toda a seção", () => {
    const { p, s } = fixture();
    s.water = [
      { x: -3, y: -0.5 },
      { x: 3, y: -0.5 },
    ];
    const { input, geometry, result } = prepare(p);
    expect(
      input.diagnostics.some((d) =>
        d.message.includes("não cobre toda a seção"),
      ),
    ).toBe(true);
    expect(
      result.status,
      JSON.stringify({
        geometry: geometry.diagnostics,
        pressure: result.diagnostics,
      }),
    ).toBe("prepared");
    expect(result.pressures?.coverage).toMatchObject({
      lineLeftX: -3,
      lineRightX: 3,
    });
  });

  it("não altera pressão ao mudar sentido, resistência, pesos ou sobrecarga", () => {
    const { p, c, s } = fixture();
    const original = pressures(p);
    p.materials[0].gamma = null;
    p.materials[0].cohesion = null;
    p.materials[0].friction = null;
    p.materials[0].mode = "total";
    c.direction = "right-to-left";
    s.loadCondition = "loads";
    s.loads = [
      {
        id: "q",
        name: "Faixa",
        x1: -8,
        x2: 8,
        q: 100,
        source: "Teste",
        enabled: true,
      },
    ];
    const { input, geometry, result } = prepare(p);
    expect(result.pressures?.slices).toEqual(original.slices);
    expect(prepareSliceWeights(input, geometry).status).toBe("blocked");
    p.materials[0].mode = null;
    expect(pressures(p).slices).toEqual(original.slices);
  });

  it("γw ausente bloqueia apenas pressões; peso próprio continua disponível", () => {
    const { p, s } = fixture();
    s.waterUnitWeight = null;
    const { input, geometry, result } = prepare(p);
    expect(geometry.status).toBe("prepared");
    expect(prepareSliceWeights(input, geometry).status).toBe("prepared");
    expect(result.pressures).toBeNull();
    expect(result.diagnostics[0].code).toBe("water-unit-weight-missing");
  });

  it("refina a amostragem mantendo a lei analítica, sem somar pressões", () => {
    const { p } = fixture();
    const coarse = pressures(p);
    const fine = pressures(p, { ...profile, maxArcDegrees: 0.28 });
    expect(fine.slices.length).toBeGreaterThan(coarse.slices.length);
    for (const s of fine.slices)
      expect(s.pressureKPa).toBeCloseTo(
        10 * Math.max(0, Math.sqrt(25 - s.basePoint.x ** 2) - 4.5),
        11,
      );
    expect(fine).not.toHaveProperty("totalPressure");
    expect(fine).not.toHaveProperty("waterForce");
  });

  it.each([0.01, 1000])(
    "pressão escala linearmente com comprimentos × %s",
    (scale) => {
      const { p, c, s } = fixture();
      const original = pressures(p);
      for (const point of [...s.terrain, ...s.water!]) {
        point.x *= scale;
        point.y *= scale;
      }
      s.base *= scale;
      c.fixedCircle.y! *= scale;
      c.fixedCircle.radius! *= scale;
      const scaled = pressures(p, {
        ...profile,
        toleranceM: profile.toleranceM * scale,
      });
      expect(scaled.slices).toHaveLength(original.slices.length);
      scaled.slices.forEach((s, i) =>
        expect(s.pressureKPa / scale).toBeCloseTo(
          original.slices[i].pressureKPa,
          10,
        ),
      );
    },
  );

  it("conserva pressões sob translação e espelhamento", () => {
    const { p, s, c } = fixture();
    s.water = [
      { x: -10, y: -1.1 },
      { x: 10, y: -0.1 },
    ];
    const original = pressures(p);
    for (const point of [...s.terrain, ...s.water!]) {
      point.x = 100000 - point.x;
      point.y += 100000;
    }
    s.terrain.reverse();
    s.water!.reverse();
    s.base += 100000;
    c.fixedCircle.x = 100000;
    c.fixedCircle.y! += 100000;
    const mirrored = pressures(p);
    expect(mirrored.slices).toHaveLength(original.slices.length);
    mirrored.slices.forEach((s, i) =>
      expect(s.pressureKPa).toBeCloseTo(
        original.slices[original.slices.length - 1 - i].pressureKPa,
        7,
      ),
    );
  });
});

describe("limites de cobertura e integridade das pressões", () => {
  it("não aceita cobertura só dos centros nem prolonga uma lacuna menor que ε", () => {
    const { p } = fixture();
    const { input, geometry } = prepare(p);
    if (geometry.status !== "prepared")
      throw new Error("Geometria indisponível");
    const first = geometry.geometry.slices[0];
    for (const left of [
      first.arcMidpoint.x,
      first.left.x + profile.toleranceM / 4,
    ]) {
      // Exercita a guarda independente, inclusive contra uma geometria permissiva nas bordas.
      const bound = bindWater(input, geometry, {
        line: [
          { x: left, z: -0.5 },
          { x: 4, z: -0.5 },
        ],
      });
      const result = prepareSlicePressures(bound.input, bound.geometry);
      expect(result.pressures).toBeNull();
      expect(result.diagnostics[0].code).toBe("water-coverage");
    }
  });

  it("verifica cobertura no extremo direito também", () => {
    const { p } = fixture();
    const { input, geometry } = prepare(p);
    const bound = bindWater(input, geometry, {
      line: [
        { x: -4, z: -0.5 },
        { x: 2.99, z: -0.5 },
      ],
    });
    expect(
      prepareSlicePressures(bound.input, bound.geometry).diagnostics[0].code,
    ).toBe("water-coverage");
  });

  it("bloqueia linha acima do terreno, incluindo nó interior entre cotas baixas", () => {
    const { p, s } = fixture();
    s.water = [
      { x: -10, y: -0.5 },
      { x: 0, y: 0.1 },
      { x: 10, y: -0.5 },
    ];
    const { input, geometry, result } = prepare(p);
    expect(geometry.status).toBe("prepared");
    expect(prepareSliceWeights(input, geometry).status).toBe("prepared");
    expect(result.pressures).toBeNull();
    expect(result.diagnostics[0]).toMatchObject({
      code: "water-above-terrain",
      x: 0,
    });
    expect(result.diagnostics[0].message).toContain(
      "não distingue água confinada",
    );
  });

  it("conferência acima do terreno inclui seus nós e o lado baixo de face vertical", () => {
    for (const terrain of [
      [
        { x: -10, y: 0 },
        { x: 0, y: -0.4 },
        { x: 10, y: 0 },
      ],
      [
        { x: -10, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: -0.4 },
        { x: 10, y: -0.4 },
      ],
    ]) {
      const { p, s } = fixture();
      s.terrain = terrain;
      s.water = [
        { x: -10, y: -0.3 },
        { x: 10, y: -0.3 },
      ];
      const { result } = prepare(p);
      expect(result.diagnostics[0]).toMatchObject({
        code: "water-above-terrain",
        x: 0,
      });
    }
  });

  it("aceita linha no terreno e ignora cotas acima dele fora do candidato", () => {
    const { p, s } = fixture();
    s.water = [
      { x: -10, y: 2 },
      { x: -4, y: 0 },
      { x: 4, y: 0 },
      { x: 10, y: 2 },
    ];
    expect(pressures(p).maxPressureKPa).toBeCloseTo(10, 12);
  });

  it.each([0, -1, NaN, Infinity])(
    "rejeita γw inválido %s no contrato independente",
    (gamma) => {
      const { p } = fixture();
      const { input, geometry } = prepare(p);
      const bound = bindWater(input, geometry, { unitWeight: gamma });
      expect(
        prepareSlicePressures(bound.input, bound.geometry).diagnostics[0].code,
      ).toBe("water-unit-weight-invalid");
    },
  );

  it.each([null, [], [{ x: 0, z: 0 }]].map((line) => ({ line })))(
    "rejeita linha ausente/incompleta %j",
    ({ line }) => {
      const { p } = fixture();
      const { input, geometry } = prepare(p);
      const bound = bindWater(input, geometry, { line });
      expect(
        prepareSlicePressures(bound.input, bound.geometry).diagnostics[0].code,
      ).toBe("water-line-missing");
    },
  );

  it.each(
    [
      [
        { x: 1, z: -0.5 },
        { x: -1, z: -0.5 },
      ],
      [
        { x: -4, z: -0.5 },
        { x: -4, z: -0.6 },
      ],
      [
        { x: -4, z: NaN },
        { x: 4, z: -0.5 },
      ],
    ].map((line) => ({ line })),
  )("rejeita linha inválida sem reordenar pontos %j", ({ line }) => {
    const { p } = fixture();
    const { input, geometry } = prepare(p);
    const bound = bindWater(input, geometry, { line });
    expect(
      prepareSlicePressures(bound.input, bound.geometry).diagnostics[0].code,
    ).toBe("water-line-invalid");
  });

  it("não interpreta condição ausente como seca", () => {
    const { p } = fixture();
    const { input, geometry } = prepare(p);
    const bound = bindWater(input, geometry, { mode: "unspecified" });
    const result = prepareSlicePressures(bound.input, bound.geometry);
    expect(result.pressures).toBeNull();
    expect(result.diagnostics[0].code).toBe("water-condition-missing");
  });

  it("preserva pressão pequena positiva em vez de usar ε geométrico como corte", () => {
    const { p, s } = fixture();
    s.waterUnitWeight = 1e-9;
    const data = pressures(p);
    expect(data.maxPressureKPa).toBeCloseTo(5e-10, 20);
    expect(data.positivePressureCount).toBe(19);
  });

  it("rejeita perda numérica em produto positivo em vez de fornecer zero", () => {
    const { p } = fixture();
    const { input, geometry } = prepare(p);
    const bound = bindWater(input, geometry, { unitWeight: Number.MIN_VALUE });
    expect(
      prepareSlicePressures(bound.input, bound.geometry).diagnostics[0].code,
    ).toBe("pressure-numerical");
  });

  it("rejeita produto não finito", () => {
    const { p } = fixture();
    const { input, geometry } = prepare(p);
    if (geometry.status !== "prepared")
      throw new Error("Geometria indisponível");
    const bound = bindWater(input, geometry, { unitWeight: Number.MAX_VALUE });
    const deep = {
      ...geometry,
      inputRevision: bound.geometry.inputRevision,
      geometry: {
        ...geometry.geometry,
        slices: geometry.geometry.slices.map((s) => ({
          ...s,
          arcMidpoint: { ...s.arcMidpoint, z: -2.5 },
        })),
      },
    };
    expect(prepareSlicePressures(bound.input, deep).diagnostics[0].code).toBe(
      "pressure-numerical",
    );
  });

  it("exige entrada/geometria disponíveis e recusa revisão antiga", () => {
    const { p, s, c } = fixture();
    const { geometry } = prepare(p);
    expect(
      prepareSlicePressures(prepareCoreInput({}, c.id), null).diagnostics[0]
        .code,
    ).toBe("input-unavailable");
    expect(
      prepareSlicePressures(prepareCoreInput(p, c.id), null).diagnostics[0]
        .code,
    ).toBe("geometry-unavailable");
    s.waterUnitWeight = 9.81;
    expect(
      prepareSlicePressures(prepareCoreInput(p, c.id), geometry).diagnostics[0]
        .code,
    ).toBe("stale-geometry");
  });

  it("não altera arquivo, entradas, pesos ou geometria e não calcula u usado ou FS", () => {
    const { p, s } = fixture();
    s.waterSource = "";
    const file = serializeProject(p);
    const { input, geometry } = prepare(p);
    const weights = prepareSliceWeights(input, geometry);
    const before = JSON.stringify({ input, geometry, weights });
    const result = prepareSlicePressures(input, geometry);
    expect(result.status).toBe("prepared");
    expect(result.inputRevision).toBe(input.snapshot!.revision);
    expect(result.geometryProfile).toEqual(profile);
    expect(Object.isFrozen(result.pressures!.slices[0].basePoint)).toBe(true);
    expect(result.pressures!.water.source).toBe("");
    expect(JSON.stringify({ input, geometry, weights })).toBe(before);
    expect(serializeProject(p)).toBe(file);
    expect(result.pressures).not.toHaveProperty("factorOfSafety");
    expect(result.pressures!.slices[0]).not.toHaveProperty(
      "effectivePressureKPa",
    );
  });
});
