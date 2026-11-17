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
import { prepareSliceLoads } from "../../src/core/slice-loads";
import { prepareSliceWeights } from "../../src/core/slice-weights";
import { prepareSlicePressures } from "../../src/core/slice-pressures";
import type { CoreInput, InputPreparation } from "../../src/core/input";

const profile = { toleranceM: 1e-8, maxArcDegrees: 3 };
function strip(id = "left", x1 = -2, x2 = 0, q: number | null = 20) {
  return {
    id,
    name: "Faixa uniforme",
    x1,
    x2,
    q,
    enabled: true,
    source: `Origem ${id}`,
  };
}
function fixture() {
  const base = newProject("Sobrecargas analíticas");
  base.materials[0].gamma = 18;
  const section = base.sections[0];
  Object.assign(section, {
    terrain: [
      { x: -10, y: 0 },
      { x: 10, y: 0 },
    ],
    base: -2,
    backgroundMaterialId: base.materials[0].id,
    waterMode: "dry",
    waterSource: "Condição seca",
    loadCondition: "loads",
    loads: [strip()],
  });
  const { project: p, analysisCase: c } = addAnalysisCase(base, section.id);
  Object.assign(c, {
    description: "Resultantes sem equilíbrio",
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
  return { input, geometry, result: prepareSliceLoads(input, geometry) };
}
function loads(p: Project, settings = profile) {
  const { result } = prepare(p, settings);
  if (result.status !== "prepared")
    throw new Error(JSON.stringify(result.diagnostics));
  return result.loads;
}
function bind(
  input: InputPreparation,
  geometry: FixedCirclePreparation,
  change: Partial<CoreInput>,
) {
  const data = { ...input.snapshot!.input, ...change };
  const revision = JSON.stringify(data);
  return {
    input: {
      ...input,
      snapshot: { input: data, revision },
    } as InputPreparation,
    geometry: { ...geometry, inputRevision: revision },
  };
}

describe("resultantes de faixas por integração independente", () => {
  it("20 kPa em [−2,0] dá 40 kN/m e +40 kN·m/m, com origem e unidades", () => {
    const { p } = fixture();
    const data = loads(p);
    expect(data.forceKNPerM).toBeCloseTo(40, 12);
    expect(data.momentCCWKNmPerM).toBeCloseTo(40, 12);
    expect(data.momentDrivingKNmPerM).toBeCloseTo(40, 12);
    expect(data.strips[0]).toMatchObject({
      id: "left",
      source: "Origem left",
      intensityKPa: 20,
      loadedWidthM: 2,
    });
    expect(data.units).toEqual({
      length: "m",
      intensity: "kPa",
      force: "kN/m",
      moment: "kN·m/m",
    });
    expect(data.selection).toBe("section");
    expect(data.convention).toBe("project-XZ-downward-CCW-positive");
    // Integrais de 20 e −20x em cada intervalo, sem reutilizar a fórmula de ponto médio.
    for (const s of data.slices) {
      for (const c of s.contributions) {
        expect(c.forceKNPerM).toBeCloseTo(20 * c.rightX - 20 * c.leftX, 12);
        expect(c.momentCCWKNmPerM).toBeCloseTo(
          -10 * c.rightX ** 2 + 10 * c.leftX ** 2,
          12,
        );
        expect(c.applicationPoint.z).toBe(0);
      }
    }
  });

  it("recorta faixa parcialmente fora da massa e usa somente a projeção carregada", () => {
    const { p, s } = fixture();
    s.loads = [strip("partial", -8, -1, 12)];
    const data = loads(p); // massa entre −3 e +3; interseção [−3,−1].
    expect(data.forceKNPerM).toBeCloseTo(24, 10);
    expect(data.momentCCWKNmPerM).toBeCloseTo(48, 10);
    expect(data.strips[0].loadedWidthM).toBeCloseTo(2, 12);
    expect(
      data.slices
        .flatMap((s) => s.contributions)
        .every((c) => c.leftX >= -3 - 1e-12 && c.rightX <= -1),
    ).toBe(true);
  });

  it("preserva braço do trecho parcial, diferente do centro da fatia e do ponto do arco", () => {
    const { p } = fixture();
    const { input, geometry } = prepare(p);
    if (geometry.status !== "prepared")
      throw new Error("Geometria indisponível");
    // Fatia isolada fornecida ao estágio de sobrecargas: faixa só ocupa [−2,0] em [−3,3].
    const single = {
      ...geometry,
      geometry: {
        ...geometry.geometry,
        slices: [
          {
            ...geometry.geometry.slices[0],
            number: 1,
            left: { x: -3, topZ: 0, baseZ: 0 },
            right: { x: 3, topZ: 0, baseZ: 0 },
            arcMidpoint: { x: 0, z: -1 },
          },
        ],
      },
    };
    const result = prepareSliceLoads(input, single);
    expect(result.loads?.slices[0].contributions[0]).toMatchObject({
      widthM: 2,
      applicationPoint: { x: -1, z: 0 },
      forceKNPerM: 40,
      armCCWM: 1,
      momentCCWKNmPerM: 40,
    });
  });

  it("faixas opostas anulam momento sem eliminar forças ou contribuições negativas", () => {
    const { p, s } = fixture();
    s.loads.push(strip("right", 0, 2));
    const data = loads(p);
    expect(data.forceKNPerM).toBeCloseTo(80, 12);
    expect(data.momentCCWKNmPerM).toBeCloseTo(0, 12);
    expect(data.strips.map((l) => l.momentCCWKNmPerM)).toEqual([40, -40]);
    expect(data.slices.some((s) => s.momentCCWKNmPerM < 0)).toBe(true);
    expect(data.strips.map((l) => l.id)).toEqual(["left", "right"]); // Mesmo nome, IDs distintos.
  });

  it("faixa centrada conserva força mesmo com momento global zero", () => {
    const { p, s } = fixture();
    s.loads = [strip("center", -1, 1)];
    const data = loads(p);
    expect(data.forceKNPerM).toBeCloseTo(40, 12);
    expect(data.momentCCWKNmPerM).toBeCloseTo(0, 12);
  });

  it("sobreposição soma faixas sem fundir IDs ou multiplicar por largura inclinada", () => {
    const { p, s } = fixture();
    s.terrain = [
      { x: -10, y: -1 },
      { x: 10, y: 1 },
    ];
    s.loads.push(strip("overlap", -1, 1, 10));
    const data = loads(p); // Ambas inteiras na massa: 40+20, 40+0.
    expect(data.forceKNPerM).toBeCloseTo(60, 12);
    expect(data.momentCCWKNmPerM).toBeCloseTo(40, 12);
    expect(data.slices.some((s) => s.contributions.length === 2)).toBe(true);
    for (const c of data.slices.flatMap((s) => s.contributions))
      expect(c.applicationPoint.z).toBeCloseTo(0.1 * c.applicationPoint.x, 13);
  });

  it("ignora faixa fora da massa e contato pontual, sem ponto fictício", () => {
    const { p, s } = fixture();
    const { input, geometry } = prepare(p);
    if (geometry.status !== "prepared")
      throw new Error("Geometria indisponível");
    const boundary = geometry.geometry.slices.at(-1)!.right.x;
    const bound = bind(input, geometry, {
      loads: {
        ...input.snapshot!.input.loads,
        items: [
          strip("touch", boundary, 4, null),
          strip("outside", 5, 6, null),
        ],
      },
    });
    const data = prepareSliceLoads(bound.input, bound.geometry).loads!;
    expect(data.forceKNPerM).toBe(0);
    expect(data.strips.map((l) => l.loadedWidthM)).toEqual([0, 0]);
    expect(data.strips.every((l) => l.intensityKPa === null)).toBe(true);
    expect(data.slices.every((s) => s.contributions.length === 0)).toBe(true);
    s.loads = [strip("outside", 5, 6, null)];
    expect(loads(p).forceKNPerM).toBe(0);
  });

  it("q zero mantém ponto, braço e largura conhecida; q ausente bloqueia sem total parcial", () => {
    const { p, s } = fixture();
    s.loads[0].q = 0;
    const zero = loads(p);
    expect(zero.forceKNPerM).toBe(0);
    expect(zero.strips[0].loadedWidthM).toBe(2);
    expect(
      zero.slices
        .flatMap((s) => s.contributions)
        .some((c) => c.armCCWM > 0 && c.forceKNPerM === 0),
    ).toBe(true);
    s.loads.push(strip("missing", 0, 1, null));
    const { input, geometry, result } = prepare(p);
    expect(result.status).toBe("blocked");
    expect(result.loads).toBeNull();
    expect(result.diagnostics[0]).toMatchObject({
      code: "load-intensity-missing",
      loadId: "missing",
    });
    expect(prepareSliceWeights(input, geometry).status).toBe("prepared");
    expect(prepareSlicePressures(input, geometry).status).toBe("prepared");
  });
});

describe("invariâncias, sentido e condições do caso", () => {
  it("inverter sentido só inverte braços/momentos orientados; ausência não escolhe sentido", () => {
    const { p, c } = fixture();
    c.direction = "right-to-left";
    const reversed = loads(p);
    expect(reversed.momentCCWKNmPerM).toBeCloseTo(40, 12);
    expect(reversed.momentDrivingKNmPerM).toBeCloseTo(-40, 12);
    expect(
      reversed.slices
        .flatMap((s) => s.contributions)
        .every((c) => c.armDrivingM === -c.armCCWM),
    ).toBe(true);
    c.direction = null;
    const unspecified = loads(p);
    expect(unspecified.forceKNPerM).toBeCloseTo(40, 12);
    expect(unspecified.momentDrivingKNmPerM).toBeNull();
    expect(
      unspecified.slices
        .flatMap((s) => s.contributions)
        .every(
          (c) => c.armDrivingM === null && c.momentDrivingKNmPerM === null,
        ),
    ).toBe(true);
  });

  it("espelhar e inverter movimento conserva momento orientado, invertendo CCW", () => {
    const { p, c, s } = fixture();
    const original = loads(p);
    s.loads = [strip("mirror", 0, 2)];
    c.direction = "right-to-left";
    const mirror = loads(p);
    expect(mirror.forceKNPerM).toBeCloseTo(original.forceKNPerM, 12);
    expect(mirror.momentDrivingKNmPerM).toBeCloseTo(
      original.momentDrivingKNmPerM!,
      12,
    );
    expect(mirror.momentCCWKNmPerM).toBeCloseTo(-original.momentCCWKNmPerM, 12);
  });

  it.each([3, 1.5, 0.3])(
    "refinamento de %s° conserva integrais globais",
    (maxArcDegrees) => {
      const { p, s } = fixture();
      s.loads.push(strip("second", -1, 2, 10));
      const data = loads(p, { ...profile, maxArcDegrees });
      expect(data.forceKNPerM).toBeCloseTo(70, 11);
      expect(data.momentCCWKNmPerM).toBeCloseTo(25, 11);
    },
  );

  it("translação de 900 km conserva forças e momentos relativos", () => {
    const { p, s, c } = fixture();
    const dx = 900000,
      dz = 800000;
    s.terrain.forEach((p) => {
      p.x += dx;
      p.y += dz;
    });
    s.base += dz;
    s.loads.forEach((l) => {
      l.x1 += dx;
      l.x2 += dx;
    });
    c.fixedCircle.x! += dx;
    c.fixedCircle.y! += dz;
    const data = loads(p);
    expect(data.forceKNPerM).toBeCloseTo(40, 10);
    expect(data.momentCCWKNmPerM).toBeCloseTo(40, 10);
    expect(
      data.slices
        .flatMap((s) => s.contributions)
        .every((c) => c.applicationPoint.z === dz),
    ).toBe(true);
  });

  it.each([0.001, 100])(
    "escala %s: força proporcional a L, momento a L²",
    (scale) => {
      const { p, s, c } = fixture();
      s.terrain.forEach((p) => {
        p.x *= scale;
        p.y *= scale;
      });
      s.base *= scale;
      s.loads.forEach((l) => {
        l.x1 *= scale;
        l.x2 *= scale;
      });
      c.fixedCircle.x! *= scale;
      c.fixedCircle.y! *= scale;
      c.fixedCircle.radius! *= scale;
      const data = loads(p, { ...profile, toleranceM: 1e-8 * scale });
      expect(data.forceKNPerM / scale).toBeCloseTo(40, 10);
      expect(data.momentCCWKNmPerM / scale ** 2).toBeCloseTo(40, 10);
    },
  );

  it("condições herdadas/próprias excluem inativas e selecionam faixa desabilitada", () => {
    const { p, c, s } = fixture();
    s.loads.push({ ...strip("disabled", 0, 2, 30), enabled: false });
    expect(loads(p).forceKNPerM).toBeCloseTo(40, 12);
    c.loadCondition = "selected";
    c.loadIds = ["disabled"];
    expect(loads(p)).toMatchObject({
      selection: "selected",
      forceKNPerM: 60,
      momentCCWKNmPerM: -60,
    });
    c.loadCondition = "none";
    expect(loads(p)).toMatchObject({
      condition: "none",
      forceKNPerM: 0,
      strips: [],
    });
    c.loadCondition = "section";
    s.loadCondition = "none";
    expect(loads(p)).toMatchObject({
      condition: "none",
      forceKNPerM: 0,
      strips: [],
    });
  });

  it("usa apenas q, sem incorporar peso, água, coesão ou atrito", () => {
    const { p } = fixture();
    p.materials[0].gamma = null;
    p.materials[0].cohesion = null;
    p.materials[0].friction = null;
    const { input, geometry, result } = prepare(p);
    expect(result.loads?.forceKNPerM).toBeCloseTo(40, 12);
    expect(prepareSliceWeights(input, geometry).status).toBe("blocked");
  });
});

describe("contrato, revisão, falhas e precisão", () => {
  it("preserva intensidade positiva pequena e recusa limites de fatias inconsistentes", () => {
    const { p, s } = fixture();
    s.loads[0].q = 1e-12;
    expect(loads(p).forceKNPerM).toBe(2e-12);
    const { input, geometry } = prepare(p);
    if (geometry.status !== "prepared")
      throw new Error("Geometria indisponível");
    const invalid = {
      ...geometry,
      geometry: {
        ...geometry.geometry,
        slices: geometry.geometry.slices.map((s, i) =>
          i === 1 ? { ...s, left: { ...s.left, x: s.left.x - 0.01 } } : s,
        ),
      },
    };
    expect(prepareSliceLoads(input, invalid).diagnostics[0].code).toBe(
      "load-geometry-invalid",
    );
  });

  it("não modifica projeto, entrada, geometria, formato ou histórico; resultado congelado", () => {
    const { p } = fixture();
    const before = serializeProject(p);
    const { input, geometry } = prepare(p);
    const snapshot = JSON.stringify({ input, geometry });
    const r = prepareSliceLoads(input, geometry);
    expect(r).toMatchObject({
      contract: "geostruct-slice-loads/1",
      stage: "surcharge-resultants-only",
      inputRevision: input.snapshot!.revision,
      geometryContract: geometry.contract,
      geometryProfile: profile,
    });
    expect(serializeProject(p)).toBe(before);
    expect(JSON.stringify({ input, geometry })).toBe(snapshot);
    expect(Object.isFrozen(r.loads?.slices[0].contributions)).toBe(true);
    expect(Object.isFrozen(r.loads?.strips[0])).toBe(true);
    expect(Object.isFrozen(r.geometryProfile)).toBe(true);
  });

  it("rejeita entrada/geométrica indisponível, desatualizada e erro de cadastro", () => {
    const { p } = fixture();
    const { input, geometry } = prepare(p);
    expect(
      prepareSliceLoads(
        { status: "unavailable", snapshot: null, diagnostics: [] },
        geometry,
      ).diagnostics[0].code,
    ).toBe("input-unavailable");
    expect(prepareSliceLoads(input, null).diagnostics[0].code).toBe(
      "geometry-unavailable",
    );
    expect(
      prepareSliceLoads(input, { ...geometry, inputRevision: "old" })
        .diagnostics[0].code,
    ).toBe("stale-geometry");
    expect(
      prepareSliceLoads(
        {
          ...input,
          diagnostics: [
            { code: "model-diagnostic", level: "error", message: "Erro" },
          ],
        },
        geometry,
      ).diagnostics[0].code,
    ).toBe("input-error");
  });

  it.each([
    { change: { q: NaN }, code: "load-intensity-invalid" },
    { change: { q: -1 }, code: "load-intensity-invalid" },
    { change: { q: Infinity }, code: "load-intensity-invalid" },
    { change: { x1: 1 }, code: "load-range-invalid" },
    { change: { x1: -11 }, code: "load-range-invalid" },
    { change: { x2: NaN }, code: "load-range-invalid" },
    { change: { q: Number.MAX_VALUE }, code: "load-numerical" },
    { change: { q: Number.MIN_VALUE }, code: "load-numerical" },
  ])("bloqueia entrada direta inválida: $code $change", ({ change, code }) => {
    const { p } = fixture();
    const { input, geometry } = prepare(p);
    const b = bind(input, geometry, {
      loads: {
        ...input.snapshot!.input.loads,
        items: [{ ...strip(), ...change }],
      },
    });
    const r = prepareSliceLoads(b.input, b.geometry);
    expect(r.loads).toBeNull();
    expect(r.diagnostics[0].code).toBe(code);
  });

  it.each(["condition", "empty", "duplicate"])(
    "bloqueia condição inconsistente: %s",
    (kind) => {
      const { p } = fixture();
      const { input, geometry } = prepare(p);
      const b = bind(input, geometry, {
        loads: {
          ...input.snapshot!.input.loads,
          condition: kind === "condition" ? "unspecified" : "loads",
          items: kind === "empty" ? [] : [strip(), strip()],
        },
      });
      expect(prepareSliceLoads(b.input, b.geometry).diagnostics[0].code).toBe(
        kind === "condition"
          ? "load-condition-missing"
          : kind === "empty"
            ? "load-items-missing"
            : "load-id-invalid",
      );
    },
  );

  it("não perde pequena contribuição entre momentos de grandeza oposta", () => {
    const { p } = fixture();
    const { input, geometry } = prepare(p);
    if (geometry.status !== "prepared")
      throw new Error("Geometria indisponível");
    const b = bind(input, geometry, {
      loads: {
        ...input.snapshot!.input.loads,
        items: [
          strip("large-left", -2, 0, 5e15),
          strip("small", -2, 0, 0.5),
          strip("large-right", 0, 2, 5e15),
        ],
      },
    });
    const one = {
      ...b.geometry,
      geometry: {
        ...geometry.geometry,
        slices: [
          {
            ...geometry.geometry.slices[0],
            left: { x: -3, topZ: 0, baseZ: 0 },
            right: { x: 3, topZ: 0, baseZ: 0 },
          },
        ],
      },
    } as FixedCirclePreparation;
    expect(prepareSliceLoads(b.input, one).loads?.momentCCWKNmPerM).toBe(1);
  });
});
