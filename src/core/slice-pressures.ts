import type { CoreInput, Immutable, InputPreparation, PointXZ } from "./input";
import type { FixedCirclePreparation, GeometryProfile } from "./fixed-circle";
import { freeze } from "./immutable";
import { GeometryError, terrainElevation } from "./circle-geometry";

export type SlicePressure = {
  number: number;
  basePoint: PointXZ;
  piezometricZ: number | null;
  signedHeadM: number | null;
  positiveHeadM: number;
  pressureKPa: number;
  waterSegmentIndex: number | null;
};
export type PressureDiagnostic = {
  code: string;
  message: string;
  sliceNumber?: number;
  x?: number;
};
export type SlicePressurePreparation = Immutable<
  {
    contract: "geostruct-slice-pressures/1";
    stage: "pore-pressure-only";
    inputRevision: string | null;
    geometryContract: "geostruct-fixed-geometry/2" | null;
    geometryProfile: GeometryProfile | null;
  } & (
    | {
        status: "prepared";
        pressures: {
          representativePoint: "arc-midpoint";
          units: { length: "m"; pressure: "kPa"; unitWeight: "kN/m³" };
          water: {
            mode: "dry" | "piezometric";
            selection: CoreInput["water"]["selection"];
            source: string;
            unitWeightKNPerM3: number | null;
          };
          coverage: {
            leftX: number;
            rightX: number;
            lineLeftX: number | null;
            lineRightX: number | null;
          };
          slices: SlicePressure[];
          minPressureKPa: number;
          maxPressureKPa: number;
          positivePressureCount: number;
        };
        diagnostics: [];
      }
    | { status: "blocked"; pressures: null; diagnostics: PressureDiagnostic[] }
  )
>;

class PressureError extends Error {
  constructor(readonly diagnostic: PressureDiagnostic) {
    super(diagnostic.message);
  }
}
function fail(
  code: string,
  message: string,
  details: Partial<PressureDiagnostic> = {},
): never {
  throw new PressureError({ ...details, code, message });
}
function finite(value: number): number {
  if (!Number.isFinite(value))
    fail(
      "pressure-numerical",
      "A pressão ou seus intermediários não são finitos. Nenhum valor foi substituído por zero.",
    );
  return value;
}

/** Interpolação sem extrapolação. Em nó interior, a origem é o segmento anterior. */
function sample(line: readonly PointXZ[], x: number) {
  if (x < line[0].x || x > line.at(-1)!.x)
    fail(
      "water-coverage",
      "A linha piezométrica não cobre todo o intervalo do círculo preparado. Não há extrapolação.",
      { x },
    );
  let lo = 0,
    hi = line.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (line[mid].x < x) lo = mid;
    else hi = mid;
  }
  const a = line[lo],
    b = line[lo + 1];
  const t = finite((x - a.x) / (b.x - a.x));
  const rise = finite(t * finite(b.z - a.z));
  return {
    index: lo,
    z: finite(a.z + rise),
    headAt: (z: number) => finite(finite(a.z - z) + rise),
    scale: Math.max(Math.abs(a.z), Math.abs(b.z)),
  };
}

/** Pressão prescrita somente. Não depende de pesos, resistência ou do editor. */
export function prepareSlicePressures(
  preparation: InputPreparation,
  geometryPreparation: FixedCirclePreparation | null,
): SlicePressurePreparation {
  const common = {
    contract: "geostruct-slice-pressures/1" as const,
    stage: "pore-pressure-only" as const,
    inputRevision: preparation.snapshot?.revision ?? null,
    geometryContract: geometryPreparation?.contract ?? null,
    geometryProfile: geometryPreparation
      ? { ...geometryPreparation.profile }
      : null,
  };
  try {
    if (!preparation.snapshot)
      fail(
        "input-unavailable",
        "A entrada do caso está indisponível para preparar as pressões.",
      );
    if (!geometryPreparation || geometryPreparation.status !== "prepared")
      fail(
        "geometry-unavailable",
        "Prepare uma geometria válida antes das pressões de água.",
      );
    if (geometryPreparation.contract !== "geostruct-fixed-geometry/2")
      fail(
        "geometry-contract",
        "A versão da geometria não é compatível com a preparação das pressões.",
      );
    if (geometryPreparation.inputRevision !== preparation.snapshot.revision)
      fail(
        "stale-geometry",
        "As fatias pertencem a outra revisão das entradas. Prepare novamente as fatias.",
      );
    if (preparation.diagnostics.some((d) => d.level === "error"))
      fail(
        "input-error",
        "Corrija os erros de cadastro antes de preparar as pressões.",
      );
    const input = preparation.snapshot.input;
    const geometry = geometryPreparation.geometry;
    if (!geometry.slices.length)
      fail(
        "pressure-geometry-invalid",
        "Não há fatias para preparar as pressões.",
      );
    const numbers = new Set<number>();
    for (const [i, s] of geometry.slices.entries()) {
      if (
        !Number.isInteger(s.number) ||
        s.number < 1 ||
        numbers.has(s.number) ||
        ![s.left.x, s.right.x, s.arcMidpoint.x, s.arcMidpoint.z].every(
          Number.isFinite,
        ) ||
        !(s.left.x < s.arcMidpoint.x && s.arcMidpoint.x < s.right.x) ||
        (i > 0 && geometry.slices[i - 1].right.x !== s.left.x)
      )
        fail(
          "pressure-geometry-invalid",
          "Há fatia ou ponto representativo inconsistente na preparação das pressões.",
          { sliceNumber: s.number },
        );
      numbers.add(s.number);
    }
    const leftX = geometry.slices[0].left.x,
      rightX = geometry.slices.at(-1)!.right.x;
    const water = input.water;
    if (water.mode !== "dry" && water.mode !== "piezometric")
      fail(
        "water-condition-missing",
        "Defina explicitamente condição seca ou linha piezométrica. Ausência de dados não significa pressão zero.",
      );
    let line: CoreInput["water"]["line"] = null;
    let gamma: number | null = null;
    if (water.mode === "piezometric") {
      line = water.line;
      if (!line || line.length < 2)
        fail(
          "water-line-missing",
          "Informe ao menos dois pontos da linha piezométrica.",
        );
      if (
        line.some(
          (p, i) =>
            !Number.isFinite(p.x) ||
            !Number.isFinite(p.z) ||
            (i > 0 && p.x <= line![i - 1].x),
        )
      )
        fail(
          "water-line-invalid",
          "A linha piezométrica precisa ter coordenadas finitas e X estritamente crescente.",
        );
      gamma = water.unitWeight;
      if (gamma === null)
        fail(
          "water-unit-weight-missing",
          "Informe o peso específico da água γw (kN/m³) para preparar as pressões.",
        );
      if (!Number.isFinite(gamma) || gamma <= 0)
        fail(
          "water-unit-weight-invalid",
          "O peso específico da água γw precisa ser positivo e finito (kN/m³).",
        );
      sample(line, leftX);
      sample(line, rightX);
      const xs = [
        ...new Set([
          leftX,
          rightX,
          ...input.geometry.terrain.map((p) => p.x),
          ...line.map((p) => p.x),
        ]),
      ]
        .filter((x) => x >= leftX && x <= rightX)
        .sort((a, b) => a - b);
      for (const x of xs) {
        const sampleAtX = sample(line, x);
        const ground = finite(
          x === leftX
            ? terrainElevation(input.geometry.terrain, x, "right")
            : x === rightX
              ? terrainElevation(input.geometry.terrain, x, "left")
              : Math.min(
                  terrainElevation(input.geometry.terrain, x, "left"),
                  terrainElevation(input.geometry.terrain, x, "right"),
                ),
        );
        const roundoff =
          32 * Number.EPSILON * Math.max(sampleAtX.scale, Math.abs(ground));
        if (sampleAtX.headAt(ground) > roundoff)
          fail(
            "water-above-terrain",
            "Há carga piezométrica acima do terreno no intervalo do círculo. Esta etapa não distingue água confinada de lâmina externa; as pressões não foram preparadas. Geometria e pesos permanecem disponíveis.",
            { x },
          );
      }
    }
    const slices: SlicePressure[] = geometry.slices.map((s) => {
      const at = line ? sample(line, s.arcMidpoint.x) : null;
      const signedHeadM = at ? at.headAt(s.arcMidpoint.z) : null;
      const positiveHeadM = Math.max(0, signedHeadM ?? 0);
      const pressureKPa = gamma === null ? 0 : finite(gamma * positiveHeadM);
      if (positiveHeadM > 0 && pressureKPa === 0)
        fail(
          "pressure-numerical",
          "Uma pressão positiva ficou abaixo da representação numérica. Nenhuma pressão foi substituída por zero.",
          { sliceNumber: s.number },
        );
      return {
        number: s.number,
        basePoint: { ...s.arcMidpoint },
        piezometricZ: at?.z ?? null,
        signedHeadM,
        positiveHeadM,
        pressureKPa,
        waterSegmentIndex: at?.index ?? null,
      };
    });
    return freeze({
      ...common,
      status: "prepared" as const,
      pressures: {
        representativePoint: "arc-midpoint" as const,
        units: {
          length: "m" as const,
          pressure: "kPa" as const,
          unitWeight: "kN/m³" as const,
        },
        water: {
          mode: water.mode,
          selection: water.selection,
          source: water.source,
          unitWeightKNPerM3: gamma,
        },
        coverage: {
          leftX,
          rightX,
          lineLeftX: line?.[0].x ?? null,
          lineRightX: line?.at(-1)!.x ?? null,
        },
        slices,
        minPressureKPa: Math.min(...slices.map((s) => s.pressureKPa)),
        maxPressureKPa: Math.max(...slices.map((s) => s.pressureKPa)),
        positivePressureCount: slices.filter((s) => s.pressureKPa > 0).length,
      },
      diagnostics: [] as [],
    });
  } catch (error) {
    if (!(error instanceof PressureError) && !(error instanceof GeometryError))
      throw error;
    return freeze({
      ...common,
      status: "blocked" as const,
      pressures: null,
      diagnostics: [error.diagnostic],
    });
  }
}
