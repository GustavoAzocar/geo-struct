import { newProject } from "../../src/domain/model";
import { addAnalysisCase } from "../../src/domain/analysis";
import { prepareCoreInput } from "../../src/domain/core-input";
import { prepareFixedCircleGeometry } from "../../src/core/fixed-circle";
import { prepareSliceWeights } from "../../src/core/slice-weights";
import { prepareSlicePressures } from "../../src/core/slice-pressures";
import { prepareSliceLoads } from "../../src/core/slice-loads";
import { prepareSliceMechanics } from "../../src/core/slice-mechanics";

type Mutable<T> = T extends object
  ? { -readonly [K in keyof T]: Mutable<T[K]> }
  : T;
export const copy = <T>(x: T): Mutable<T> => structuredClone(x) as Mutable<T>;
export function fixture() {
  const base = newProject("Talude de conferência");
  Object.assign(base.materials[0], {
    name: "Solo",
    gamma: 18,
    cohesion: 5,
    friction: 30,
    mode: "effective",
    source: "Caso próprio",
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
    name: "Fellenius fixo",
    methods: ["fellenius", "bishop"],
    direction: "left-to-right",
    surfaceMode: "fixed",
    fixedCircle: { x: 0, y: 4, radius: 5 },
    waterCondition: "section",
    loadCondition: "section",
  });
  return p;
}
export function prepare(p = fixture(), angle = 3) {
  const input = prepareCoreInput(p, p.analysisCases[0].id);
  const geometry = prepareFixedCircleGeometry(input, {
    toleranceM: 1e-8,
    maxArcDegrees: angle,
  });
  const mechanics = prepareSliceMechanics(input, geometry, {
    weights: prepareSliceWeights(input, geometry),
    pressures: prepareSlicePressures(input, geometry),
    loads: prepareSliceLoads(input, geometry),
  });
  if (!input.snapshot || mechanics.status !== "prepared")
    throw new Error(JSON.stringify(mechanics.diagnostics));
  return {
    input: copy({ ...input, snapshot: input.snapshot }),
    mechanics: copy(mechanics),
  };
}
// Entradas mecânicas manuais, independentes da preparação geométrica.
// Comprimentos, ângulos e forças do caso são impostos para verificar a equação.
export function manual(
  rows = [{ w: 100, length: 2, angle: 30, u: 10 }],
  c = 5,
  phi = 30,
) {
  const b = prepare();
  b.input.snapshot.input.surface = {
    mode: "fixed",
    circle: { x: 0, z: 4, radius: 10 },
  };
  b.mechanics.mechanics.circleRadiusM = 10;
  const seed = b.mechanics.mechanics.slices[0];
  b.mechanics.mechanics.slices = rows.map((row, i) => {
    const s = copy(seed),
      a = (row.angle * Math.PI) / 180;
    Object.assign(s, {
      number: i + 1,
      order: i + 1,
      alphaRadians: a,
      sinAlpha: Math.sin(a),
      cosAlpha: Math.cos(a),
      baseLengthM: row.length,
      widthM: row.length * Math.cos(a),
    });
    Object.assign(s.baseMaterial, {
      cohesionKPa: c,
      frictionDegrees: phi,
      frictionRadians: (phi * Math.PI) / 180,
      tanPhi: Math.tan((phi * Math.PI) / 180),
    });
    s.weight.weightKNPerM = row.w;
    s.water.prescribed.pressureKPa = row.u;
    s.water.usedPressureKPa = row.u;
    s.surcharge = {
      forceKNPerM: 0,
      momentDrivingKNmPerM: 0,
      contributions: [],
    };
    return s;
  });
  return b;
}
export function load(b: ReturnType<typeof manual>, x: number, force = 15) {
  const s = b.mechanics.mechanics.slices[0];
  s.surcharge = {
    forceKNPerM: force,
    momentDrivingKNmPerM: -x * force,
    contributions: [
      {
        loadId: "faixa-manual",
        leftX: x - 0.5,
        rightX: x + 0.5,
        widthM: 1,
        forceKNPerM: force,
        applicationPoint: { x, z: 0 },
        localApplicationPoint: { x, z: -4 },
        armCCWM: -x,
        momentCCWKNmPerM: -x * force,
        armDrivingM: -x,
        momentDrivingKNmPerM: -x * force,
      },
    ],
  };
}
