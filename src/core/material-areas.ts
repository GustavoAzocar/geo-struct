import type { CoreInput, PointXZ } from "./input";
import {
  arcAngle,
  circularSegmentArea,
  fail,
  lowerArc,
  sameSupportingLine,
  type Circle,
} from "./circle-geometry";

export const MAX_MATERIAL_INTERVALS = 20_000;
export const MAX_MATERIAL_EDGE_EVALUATIONS = 2_000_000;

export type MaterialArea = {
  materialId: string;
  areaM2: number;
  sources: { regionId: string | null; areaM2: number }[];
};
export type AreaBalance = {
  sumM2: number;
  residualM2: number;
  limitM2: number;
};
export type SliceMaterialAreas = {
  materialAreas: MaterialArea[];
  areaBalance: AreaBalance;
};
type SliceOutline = {
  number: number;
  left: { x: number; topZ: number };
  right: { x: number; topZ: number };
  areaM2: number;
};
type Line = { kind: "line"; a: PointXZ; b: PointXZ };
type Boundary = Line | { kind: "arc" };
type Edge = Line & { regionId: string };
type Event = { starts: Edge[]; ends: Edge[] };
type Source = { materialId: string | null; name: string };

class Sum {
  value = 0;
  private compensation = 0;
  add(value: number) {
    const increment = value - this.compensation;
    const next = this.value + increment;
    this.compensation = next - this.value - increment;
    this.value = next;
  }
}
const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const line = (a: PointXZ, b: PointXZ): Line =>
  a.x < b.x ? { kind: "line", a, b } : { kind: "line", a: b, b: a };
function lineZ(edge: Line, x: number): number {
  if (x === edge.a.x) return edge.a.z;
  if (x === edge.b.x) return edge.b.z;
  return (
    edge.a.z + (edge.b.z - edge.a.z) * ((x - edge.a.x) / (edge.b.x - edge.a.x))
  );
}
function sameBoundary(a: Boundary, b: Boundary): boolean {
  if (a === b || (a.kind === "arc" && b.kind === "arc")) return true;
  if (a.kind !== "line" || b.kind !== "line") return false;
  return sameSupportingLine(a.a, a.b, b.a, b.b);
}

function materialTotals(
  areas: Map<string | null, Sum>,
  sources: Map<string | null, Source>,
): MaterialArea[] {
  const materials = new Map<string, MaterialArea["sources"]>();
  for (const [regionId, area] of areas) {
    const materialId = sources.get(regionId)!.materialId!;
    const entries = materials.get(materialId) ?? [];
    entries.push({ regionId, areaM2: area.value });
    materials.set(materialId, entries);
  }
  return [...materials.entries()]
    .sort(([a], [b]) => compareIds(a, b))
    .map(([materialId, entries]) => {
      entries.sort((a, b) =>
        a.regionId === null
          ? -1
          : b.regionId === null
            ? 1
            : compareIds(a.regionId, b.regionId),
      );
      const area = new Sum();
      entries.forEach((entry) => area.add(entry.areaM2));
      return { materialId, areaM2: area.value, sources: entries };
    });
}
function balance(
  expected: number,
  materials: MaterialArea[],
  width: number,
  tolerance: number,
  context: string,
): AreaBalance {
  const sum = new Sum();
  materials.forEach((material) => sum.add(material.areaM2));
  const residualM2 = sum.value - expected;
  const limitM2 = tolerance * width;
  if (
    ![sum.value, residualM2, limitM2].every(Number.isFinite) ||
    limitM2 <= 0 ||
    Math.abs(residualM2) > limitM2
  )
    fail(
      "material-area-conservation",
      `As subáreas não conservaram a área ${context} dentro do limite ε × largura. Nenhuma parcela foi ajustada.`,
    );
  return { sumM2: sum.value, residualM2, limitM2 };
}

/** Partição geométrica, com fundo integrado por complemento de intervalos, sem pesos. */
export function partitionMaterialAreas(
  geometry: CoreInput["geometry"],
  circle: Circle,
  slices: readonly SliceOutline[],
  tolerance: number,
): {
  slices: SliceMaterialAreas[];
  materialAreas: MaterialArea[];
  areaBalance: AreaBalance;
} {
  const local = (p: PointXZ): PointXZ => ({
    x: p.x - circle.x,
    z: p.z - circle.z,
  });
  const c = { x: 0, z: 0, radius: circle.radius };
  const outlines = slices.map((s) => ({
    ...s,
    left: local({ x: s.left.x, z: s.left.topZ }),
    right: local({ x: s.right.x, z: s.right.topZ }),
  }));
  if (!outlines.length)
    fail("material-area-input", "Não há fatias para decompor por material.");
  const firstX = outlines[0].left.x;
  const lastX = outlines.at(-1)!.right.x;
  const topZ = Math.max(...outlines.flatMap((s) => [s.left.z, s.right.z]));
  const events = new Map<number, Event>();
  const event = (x: number) => {
    let found = events.get(x);
    if (!found) {
      found = { starts: [], ends: [] };
      events.set(x, found);
    }
    return found;
  };
  for (const s of outlines) {
    event(s.left.x);
    event(s.right.x);
  }
  const sources = new Map<string | null, Source>([
    [
      null,
      { materialId: geometry.backgroundMaterialId, name: "solo de fundo" },
    ],
  ]);
  for (const region of geometry.regions) {
    sources.set(region.id, {
      materialId: region.materialId,
      name: region.name,
    });
    const points = region.points.map(local);
    const xs = points.map((p) => p.x),
      zs = points.map((p) => p.z);
    if (
      Math.max(...xs) <= firstX ||
      Math.min(...xs) >= lastX ||
      Math.max(...zs) <= -c.radius ||
      Math.min(...zs) >= topZ
    )
      continue;
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      if (a.x > firstX && a.x < lastX) event(a.x);
      if (a.x === b.x) continue;
      const edge: Edge = { ...line(a, b), regionId: region.id };
      const start = Math.max(firstX, edge.a.x),
        end = Math.min(lastX, edge.b.x);
      if (start >= end) continue;
      event(start).starts.push(edge);
      event(end).ends.push(edge);
    }
  }
  const xs = [...events.keys()].sort((a, b) => a - b);
  let activeCount = 0,
    evaluations = 0;
  for (const x of xs.slice(0, -1)) {
    const e = events.get(x)!;
    activeCount += e.starts.length - e.ends.length;
    evaluations += activeCount;
  }
  if (
    xs.length - 1 > MAX_MATERIAL_INTERVALS ||
    evaluations > MAX_MATERIAL_EDGE_EVALUATIONS
  )
    fail(
      "material-area-capacity",
      `A composição excederia o limite operacional de ${MAX_MATERIAL_INTERVALS} intervalos internos ou ${MAX_MATERIAL_EDGE_EVALUATIONS} avaliações de arestas. Nenhuma área foi truncada.`,
    );
  const bySlice = slices.map(() => new Map<string | null, Sum>());
  const total = new Map<string | null, Sum>();
  const active = new Set<Edge>();
  const arc: Boundary = { kind: "arc" };
  let sliceIndex = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const x1 = xs[i],
      x2 = xs[i + 1],
      width = x2 - x1,
      middle = x1 + width / 2;
    if (middle <= x1 || middle >= x2)
      fail(
        "material-area-resolution",
        "Dois limites internos não permitem representar um ponto intermediário. Reveja a geometria ou a escala.",
      );
    const e = events.get(x1)!;
    e.ends.forEach((edge) => active.delete(edge));
    e.starts.forEach((edge) => active.add(edge));
    while (x1 >= outlines[sliceIndex].right.x) sliceIndex++;
    const s = outlines[sliceIndex];
    const top = line(s.left, s.right);
    const z = (boundary: Boundary, x: number) =>
      boundary.kind === "arc" ? lowerArc(c, x).z : lineZ(boundary, x);
    const arcMiddle = z(arc, middle),
      topMiddle = z(top, middle);
    const crossings = new Map<string, { edge: Edge; z: number }[]>();
    for (const edge of active) {
      const entries = crossings.get(edge.regionId) ?? [];
      entries.push({ edge, z: lineZ(edge, middle) });
      crossings.set(edge.regionId, entries);
    }
    const bands: { regionId: string; lower: Boundary; upper: Boundary }[] = [];
    for (const [regionId, entries] of crossings) {
      if (entries.length % 2 !== 0)
        fail(
          "material-area-topology",
          `O contorno de ${sources.get(regionId)!.name} não fecha os intervalos da fatia ${s.number}.`,
        );
      entries.sort((a, b) => a.z - b.z);
      for (let j = 0; j < entries.length; j += 2) {
        const lower = entries[j],
          upper = entries[j + 1];
        if (upper.z <= arcMiddle || lower.z >= topMiddle) continue;
        if (upper.z <= lower.z)
          fail(
            "material-area-topology",
            `Há bordas indistinguíveis na composição da fatia ${s.number}.`,
          );
        bands.push({
          regionId,
          lower: lower.z > arcMiddle ? lower.edge : arc,
          upper: upper.z < topMiddle ? upper.edge : top,
        });
      }
    }
    bands.sort((a, b) => z(a.lower, middle) - z(b.lower, middle));
    const integrate = (upper: Boundary, lower: Boundary): number => {
      if (sameBoundary(upper, lower)) return 0;
      const h1 = z(upper, x1) - z(lower, x1),
        h2 = z(upper, x2) - z(lower, x2);
      if (
        upper.kind === "line" &&
        lower.kind === "line" &&
        h1 === 0 &&
        h2 === 0
      )
        return 0;
      // Só os encontros com o arco têm a resolução explícita das raízes.
      const endpointTolerance = lower.kind === "arc" ? tolerance : 0;
      if (
        upper.kind === "arc" ||
        h1 < -endpointTolerance ||
        h2 < -endpointTolerance
      )
        fail(
          "material-area-overlap",
          `Há sobreposição ou inversão de bordas na composição da fatia ${s.number}. Nenhuma região tem prioridade.`,
        );
      const area =
        (width * (Math.max(0, h1) + Math.max(0, h2))) / 2 +
        (lower.kind === "arc"
          ? circularSegmentArea(c.radius, arcAngle(c, x2) - arcAngle(c, x1))
          : 0);
      if (!Number.isFinite(area) || area <= 0)
        fail(
          "material-area-resolution",
          `Uma parcela da fatia ${s.number} não pôde ser representada com área positiva finita.`,
        );
      return area;
    };
    const add = (regionId: string | null, area: number) => {
      if (area === 0) return;
      const source = sources.get(regionId)!;
      if (source.materialId === null)
        fail(
          "area-material-missing",
          `Atribua material a ${source.name}, que contribui para a área da fatia ${s.number}.`,
        );
      for (const map of [bySlice[sliceIndex], total]) {
        const sum = map.get(regionId) ?? new Sum();
        sum.add(area);
        map.set(regionId, sum);
      }
    };
    let cursor: Boundary = arc;
    for (const band of bands) {
      add(null, integrate(band.lower, cursor));
      add(band.regionId, integrate(band.upper, band.lower));
      cursor = band.upper;
    }
    add(null, integrate(top, cursor));
  }
  const expected = new Sum();
  const parts = slices.map((s, i) => {
    expected.add(s.areaM2);
    const materialAreas = materialTotals(bySlice[i], sources);
    return {
      materialAreas,
      areaBalance: balance(
        s.areaM2,
        materialAreas,
        s.right.x - s.left.x,
        tolerance,
        `da fatia ${s.number}`,
      ),
    };
  });
  const materialAreas = materialTotals(total, sources);
  return {
    slices: parts,
    materialAreas,
    areaBalance: balance(
      expected.value,
      materialAreas,
      lastX - firstX,
      tolerance,
      "total",
    ),
  };
}
