import type { CoreInput, Immutable, InputPreparation, PointXZ } from "./input";
import type { FixedCirclePreparation, GeometryProfile } from "./fixed-circle";
import { freeze } from "./immutable";
import { GeometryError, terrainElevation } from "./circle-geometry";

type LoadTotals = {
  forceKNPerM: number;
  momentCCWKNmPerM: number;
  momentDrivingKNmPerM: number | null;
};
export type LoadContribution = LoadTotals & {
  loadId: string;
  leftX: number;
  rightX: number;
  widthM: number;
  applicationPoint: PointXZ;
  armCCWM: number;
  armDrivingM: number | null;
};
export type LoadDiagnostic = {
  code: string;
  message: string;
  loadId?: string;
  sliceNumber?: number;
};
export type SliceLoadPreparation = Immutable<
  {
    contract: "geostruct-slice-loads/1";
    stage: "surcharge-resultants-only";
    inputRevision: string | null;
    geometryContract: "geostruct-fixed-geometry/2" | null;
    geometryProfile: GeometryProfile | null;
  } & (
    | {
        status: "prepared";
        loads: LoadTotals & {
          units: {
            length: "m";
            intensity: "kPa";
            force: "kN/m";
            moment: "kN·m/m";
          };
          convention: "project-XZ-downward-CCW-positive";
          direction: CoreInput["analysis"]["direction"];
          selection: CoreInput["loads"]["selection"];
          condition: "none" | "loads";
          circleCenter: PointXZ;
          strips: (LoadTotals & {
            id: string;
            name: string;
            source: string;
            x1: number;
            x2: number;
            intensityKPa: number | null;
            loadedWidthM: number;
          })[];
          slices: (LoadTotals & {
            number: number;
            contributions: LoadContribution[];
          })[];
        };
        diagnostics: [];
      }
    | { status: "blocked"; loads: null; diagnostics: LoadDiagnostic[] }
  )
>;

class LoadError extends Error {
  constructor(readonly diagnostic: LoadDiagnostic) {
    super(diagnostic.message);
  }
}
function fail(
  code: string,
  message: string,
  details: Partial<LoadDiagnostic> = {},
): never {
  throw new LoadError({ ...details, code, message });
}
function finite(value: number): number {
  if (!Number.isFinite(value))
    fail(
      "load-numerical",
      "A resultante, o momento ou seus intermediários não são finitos. Nenhum total parcial foi preparado.",
    );
  return value === 0 ? 0 : value;
}
function product(a: number, b: number): number {
  const value = finite(a * b);
  if (a !== 0 && b !== 0 && value === 0)
    fail(
      "load-numerical",
      "Uma contribuição não nula ficou abaixo da representação numérica. Nenhuma contribuição foi substituída por zero.",
    );
  return value;
}

/** Soma compensada de Neumaier: preserva parcelas pequenas entre momentos opostos. */
class Sum {
  private value = 0;
  private correction = 0;
  add(v: number) {
    const next = finite(this.value + v);
    this.correction = finite(
      this.correction +
        (Math.abs(this.value) >= Math.abs(v)
          ? this.value - next + v
          : v - next + this.value),
    );
    this.value = next;
  }
  total() {
    return finite(this.value + this.correction);
  }
}
class Totals {
  private force = new Sum();
  private moment = new Sum();
  add(c: Pick<LoadTotals, "forceKNPerM" | "momentCCWKNmPerM">) {
    this.force.add(c.forceKNPerM);
    this.moment.add(c.momentCCWKNmPerM);
  }
  result(sign: number | null): LoadTotals {
    const moment = this.moment.total();
    return {
      forceKNPerM: this.force.total(),
      momentCCWKNmPerM: moment,
      momentDrivingKNmPerM: sign === null ? null : product(sign, moment),
    };
  }
}

/** Faixas verticais uniformes por largura horizontal. Sem equilíbrio ou resistência. */
export function prepareSliceLoads(
  preparation: InputPreparation,
  geometryPreparation: FixedCirclePreparation | null,
): SliceLoadPreparation {
  const common = {
    contract: "geostruct-slice-loads/1" as const,
    stage: "surcharge-resultants-only" as const,
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
        "A entrada do caso está indisponível para preparar as sobrecargas.",
      );
    if (!geometryPreparation || geometryPreparation.status !== "prepared")
      fail(
        "geometry-unavailable",
        "Prepare uma geometria válida antes das resultantes das sobrecargas.",
      );
    if (geometryPreparation.contract !== "geostruct-fixed-geometry/2")
      fail(
        "geometry-contract",
        "A versão da geometria não é compatível com a preparação das sobrecargas.",
      );
    if (geometryPreparation.inputRevision !== preparation.snapshot.revision)
      fail(
        "stale-geometry",
        "As fatias pertencem a outra revisão das entradas. Prepare novamente as fatias.",
      );
    if (preparation.diagnostics.some((d) => d.level === "error"))
      fail(
        "input-error",
        "Corrija os erros de cadastro antes de preparar as sobrecargas.",
      );
    const input = preparation.snapshot.input;
    const geometry = geometryPreparation.geometry;
    const { circle, slices } = geometry;
    const numbers = new Set<number>();
    if (!slices.length || ![circle.x, circle.z].every(Number.isFinite))
      fail(
        "load-geometry-invalid",
        "Não há círculo e fatias válidos para preparar as sobrecargas.",
      );
    for (const [i, s] of slices.entries()) {
      if (
        !Number.isInteger(s.number) ||
        s.number < 1 ||
        numbers.has(s.number) ||
        ![s.left.x, s.right.x].every(Number.isFinite) ||
        s.left.x >= s.right.x ||
        (i > 0 && slices[i - 1].right.x !== s.left.x)
      )
        fail(
          "load-geometry-invalid",
          "Há limites ou numeração de fatia inconsistentes na preparação das sobrecargas.",
          { sliceNumber: s.number },
        );
      numbers.add(s.number);
    }
    const { condition, selection, items } = input.loads;
    if (condition !== "none" && condition !== "loads")
      fail(
        "load-condition-missing",
        "Defina explicitamente as faixas ativas ou a condição sem sobrecargas. Ausência de dados não significa carga zero.",
      );
    if (condition === "loads" && !items.length)
      fail(
        "load-items-missing",
        "A condição com sobrecargas não contém faixas ativas.",
      );
    const direction = input.analysis.direction;
    if (
      direction !== null &&
      direction !== "left-to-right" &&
      direction !== "right-to-left"
    )
      fail(
        "load-direction-invalid",
        "O sentido de movimento informado é inválido.",
      );
    const sign =
      direction === null ? null : direction === "left-to-right" ? 1 : -1;
    const leftX = slices[0].left.x,
      rightX = slices.at(-1)!.right.x;
    const terrain = input.geometry.terrain;
    const ids = new Set<string>();
    const active = condition === "none" ? [] : items;
    for (const load of active) {
      if (!load.id || ids.has(load.id))
        fail(
          "load-id-invalid",
          "Há faixas sem identificação ou com ID repetido.",
          { loadId: load.id },
        );
      ids.add(load.id);
      if (
        !Number.isFinite(load.x1) ||
        !Number.isFinite(load.x2) ||
        load.x1 >= load.x2 ||
        !terrain.length ||
        load.x1 < terrain[0].x ||
        load.x2 > terrain.at(-1)!.x
      )
        fail(
          "load-range-invalid",
          `A faixa “${load.name}” precisa de limites finitos, extensão positiva e cobertura pelo terreno.`,
          { loadId: load.id },
        );
      if (Math.min(rightX, load.x2) > Math.max(leftX, load.x1)) {
        if (load.q === null)
          fail(
            "load-intensity-missing",
            `Informe a intensidade q (kPa) da faixa “${load.name}”, que intercepta a massa. Nulo não significa zero.`,
            { loadId: load.id },
          );
        if (!Number.isFinite(load.q) || load.q < 0)
          fail(
            "load-intensity-invalid",
            `A intensidade da faixa “${load.name}” deve ser finita e não negativa.`,
            { loadId: load.id },
          );
      }
    }
    const stripSums = new Map(
      active.map((l) => [l.id, { totals: new Totals(), width: new Sum() }]),
    );
    const all = new Totals();
    const prepared = slices.map((slice) => {
      const totals = new Totals();
      const contributions: LoadContribution[] = [];
      for (const load of active) {
        const a = Math.max(slice.left.x, load.x1),
          b = Math.min(slice.right.x, load.x2);
        if (b <= a) continue;
        const widthM = finite(b - a);
        const x = finite(a + widthM / 2);
        if (!(a < x && x < b))
          fail(
            "load-numerical",
            "O ponto de aplicação da faixa não é representável entre seus limites.",
            { loadId: load.id, sliceNumber: slice.number },
          );
        const forceKNPerM = product(load.q!, widthM);
        const armCCWM = finite(finite(circle.x - a) - widthM / 2);
        const momentCCWKNmPerM = product(forceKNPerM, armCCWM);
        const contribution: LoadContribution = {
          loadId: load.id,
          leftX: a,
          rightX: b,
          widthM,
          applicationPoint: {
            x,
            z: finite(terrainElevation(terrain, x, "right")),
          },
          forceKNPerM,
          armCCWM,
          momentCCWKNmPerM,
          armDrivingM: sign === null ? null : product(sign, armCCWM),
          momentDrivingKNmPerM:
            sign === null ? null : product(sign, momentCCWKNmPerM),
        };
        contributions.push(contribution);
        totals.add(contribution);
        all.add(contribution);
        stripSums.get(load.id)!.totals.add(contribution);
        stripSums.get(load.id)!.width.add(widthM);
      }
      return { number: slice.number, contributions, ...totals.result(sign) };
    });
    return freeze({
      ...common,
      status: "prepared" as const,
      loads: {
        units: {
          length: "m" as const,
          intensity: "kPa" as const,
          force: "kN/m" as const,
          moment: "kN·m/m" as const,
        },
        convention: "project-XZ-downward-CCW-positive" as const,
        direction,
        selection,
        condition,
        circleCenter: { x: circle.x, z: circle.z },
        strips: active.map((l) => ({
          id: l.id,
          name: l.name,
          source: l.source,
          x1: l.x1,
          x2: l.x2,
          intensityKPa: l.q,
          loadedWidthM: stripSums.get(l.id)!.width.total(),
          ...stripSums.get(l.id)!.totals.result(sign),
        })),
        slices: prepared,
        ...all.result(sign),
      },
      diagnostics: [] as [],
    });
  } catch (error) {
    if (!(error instanceof LoadError) && !(error instanceof GeometryError))
      throw error;
    return freeze({
      ...common,
      status: "blocked" as const,
      loads: null,
      diagnostics: [error.diagnostic],
    });
  }
}
