import polygonClipping from "polygon-clipping";
import type { Point, Section, Selection } from "./model";
import { distance, EPS, onSegment, signedArea } from "./geometry";

export type ContourTarget =
  | { kind: "terrain" }
  | { kind: "water" }
  | { kind: "region"; id: string };
export const contourTarget = (s: Selection): ContourTarget | null =>
  s.kind === "terrain" || s.kind === "water" || s.kind === "region"
    ? (s as ContourTarget)
    : null;
export function contourPoints(s: Section, t: ContourTarget): Point[] {
  if (t.kind === "terrain") return s.terrain;
  if (t.kind === "water") return s.water ?? [];
  const region = s.regions.find((r) => r.id === t.id);
  if (!region) throw new Error("Selecione uma região existente.");
  return region.points;
}
function setPoints(s: Section, t: ContourTarget, p: Point[]) {
  if (p.length > 500)
    throw new Error("A edição ultrapassa 500 pontos em um contorno.");
  if (t.kind === "terrain") s.terrain = p;
  else if (t.kind === "water") s.water = p;
  else s.regions.find((r) => r.id === t.id)!.points = p;
}
const same = (a: Point, b: Point) => distance(a, b) <= EPS;
export const segments = (points: Point[], closed = false): [Point, Point][] =>
  points
    .slice(0, closed ? points.length : -1)
    .map((p, i) => [p, points[(i + 1) % points.length]]);
export function projectOnSegment(p: Point, a: Point, b: Point): Point {
  const length2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t =
    length2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length2,
          ),
        );
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}
function addOnEdges(
  points: Point[],
  closed: boolean,
  additions: Point[],
): Point[] {
  return points.flatMap((a, i) => {
    if (!closed && i === points.length - 1) return [{ ...a }];
    const b = points[(i + 1) % points.length];
    const inside = additions
      .filter((p) => !same(p, a) && !same(p, b) && onSegment(p, a, b))
      .sort((p, q) => distance(a, p) - distance(a, q));
    return [
      { ...a },
      ...inside
        .filter((p, j) => j === 0 || !same(p, inside[j - 1]))
        .map((p) => ({ ...p })),
    ];
  });
}
function physicalContours(s: Section): ContourTarget[] {
  return [
    { kind: "terrain" },
    ...s.regions.map((r) => ({ kind: "region" as const, id: r.id })),
  ];
}
const isTarget = (a: ContourTarget, b: ContourTarget) =>
  a.kind === b.kind &&
  (a.kind !== "region" || (b.kind === "region" && a.id === b.id));

// A mesma transformação é aplicada a todas as fronteiras coincidentes.
// A água permanece independente das interfaces físicas do solo.
export function deformContour(
  section: Section,
  target: ContourTarget,
  replacement: Point[],
  linked = true,
): Section {
  const old = contourPoints(section, target);
  if (old.length !== replacement.length)
    throw new Error(
      "A edição de vértices precisa preservar sua correspondência.",
    );
  const next = structuredClone(section);
  if (old.every((p, i) => p.x === replacement[i].x && p.y === replacement[i].y))
    return next;
  const oldEdges = segments(old, target.kind === "region");
  const newEdges = segments(replacement, target.kind === "region");
  const map = (p: Point): Point => {
    const index = old.findIndex((q) => same(p, q));
    if (index >= 0) return { ...replacement[index] };
    const edge = oldEdges.findIndex(([a, b]) => onSegment(p, a, b));
    if (edge < 0) return { ...p };
    const [a, b] = oldEdges[edge],
      [c, d] = newEdges[edge];
    const f = distance(a, p) / distance(a, b);
    return { x: c.x + f * (d.x - c.x), y: c.y + f * (d.y - c.y) };
  };
  if (linked && target.kind !== "water") {
    for (const t of physicalContours(next)) {
      if (isTarget(t, target)) continue;
      setPoints(
        next,
        t,
        addOnEdges(contourPoints(section, t), t.kind === "region", old).map(
          map,
        ),
      );
    }
  }
  setPoints(
    next,
    target,
    replacement.map((p) => ({ ...p })),
  );
  return next;
}
export function moveContourVertex(
  section: Section,
  target: ContourTarget,
  index: number,
  point: Point,
  linked = true,
): Section {
  const points = contourPoints(section, target);
  if (!points[index]) throw new Error("Vértice inexistente.");
  return deformContour(
    section,
    target,
    points.map((p, i) => (i === index ? point : p)),
    linked,
  );
}
export function insertContourVertex(
  section: Section,
  target: ContourTarget,
  edge: number,
  point: Point,
  linked = true,
): Section {
  const points = contourPoints(section, target);
  const pair = segments(points, target.kind === "region")[edge];
  if (!pair) throw new Error("Selecione um segmento do contorno.");
  let anchor = projectOnSegment(point, ...pair);
  // Uma nova linha da tabela pode criar uma saliência além da projeção da
  // aresta. Nesse caso, vincule o novo vértice ao meio da aresta original.
  if ((same(anchor, pair[0]) || same(anchor, pair[1])) && !same(point, anchor))
    anchor = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
  if (same(anchor, pair[0]) || same(anchor, pair[1]))
    throw new Error("Escolha o interior do segmento, afastado dos vértices.");
  const next = structuredClone(section);
  const targets =
    linked && target.kind !== "water" ? physicalContours(next) : [target];
  for (const t of targets)
    setPoints(
      next,
      t,
      addOnEdges(contourPoints(next, t), t.kind === "region", [anchor]),
    );
  const index = contourPoints(next, target).findIndex((p) => same(p, anchor));
  return moveContourVertex(next, target, index, point, linked);
}
export function deleteContourVertex(
  section: Section,
  target: ContourTarget,
  index: number,
  linked = true,
): Section {
  const points = contourPoints(section, target),
    closed = target.kind === "region";
  if (!points[index]) throw new Error("Vértice inexistente.");
  if (points.length <= (closed ? 3 : 2))
    throw new Error(
      closed
        ? "Uma região precisa manter três vértices."
        : "O perfil precisa manter dois pontos.",
    );
  const removed = points[index];
  const prev =
    closed || index > 0
      ? points[(index + points.length - 1) % points.length]
      : null;
  const after =
    closed || index < points.length - 1
      ? points[(index + 1) % points.length]
      : null;
  const map = (p: Point): Point => {
    if (!prev || !after) return { ...p };
    const d1 = distance(prev, removed),
      d2 = distance(removed, after);
    let f: number;
    if (onSegment(p, prev, removed)) f = distance(prev, p) / (d1 + d2);
    else if (onSegment(p, removed, after))
      f = (d1 + distance(removed, p)) / (d1 + d2);
    else return { ...p };
    return {
      x: prev.x + f * (after.x - prev.x),
      y: prev.y + f * (after.y - prev.y),
    };
  };
  const next = structuredClone(section);
  if (linked && target.kind !== "water") {
    for (const t of physicalContours(next)) {
      if (isTarget(t, target)) continue;
      setPoints(
        next,
        t,
        contourPoints(section, t)
          .filter((p) => !same(p, removed))
          .map(map),
      );
    }
  }
  setPoints(
    next,
    target,
    points.filter((_, i) => i !== index).map((p) => ({ ...p })),
  );
  return next;
}
export function replaceContourCoordinates(
  section: Section,
  target: ContourTarget,
  points: Point[],
  originalRows: (number | null)[],
  linked = true,
): Section {
  let next = structuredClone(section);
  const old = contourPoints(section, target);
  const kept = originalRows.filter((i): i is number => i !== null);
  if (
    originalRows.length !== points.length ||
    kept.some((i, j) => !old[i] || (j > 0 && i <= kept[j - 1]))
  )
    throw new Error(
      "A correspondência dos pontos foi perdida. Reabra as propriedades e tente novamente.",
    );
  // Uma lista colada substitui o contorno; pontos antigos sem correspondência
  // não podem ser interpretados como movimentos de interfaces.
  if (kept.length === 0 || old.length === 0) {
    setPoints(next, target, points);
    return next;
  }
  if (kept.length < Math.min(old.length, target.kind === "region" ? 3 : 2))
    throw new Error(
      "Mantenha os pontos mínimos do contorno durante a edição. Para substituí-lo por completo, use Colar lista de coordenadas.",
    );
  for (let i = old.length - 1; i >= 0; i--)
    if (!kept.includes(i)) next = deleteContourVertex(next, target, i, linked);
  next = deformContour(
    next,
    target,
    points.filter((_, i) => originalRows[i] !== null),
    linked,
  );
  for (let i = 0; i < points.length; i++) {
    if (originalRows[i] !== null) continue;
    const current = contourPoints(next, target);
    if (i > 0 && (i < current.length || target.kind === "region"))
      next = insertContourVertex(next, target, i - 1, points[i], linked);
    else {
      const updated = [...current];
      updated.splice(i, 0, points[i]);
      setPoints(next, target, updated);
    }
  }
  return next;
}
export function translateContour(
  section: Section,
  target: ContourTarget,
  delta: Point,
  linked = true,
): Section {
  return deformContour(
    section,
    target,
    contourPoints(section, target).map((p) => ({
      x: p.x + delta.x,
      y: p.y + delta.y,
    })),
    linked,
  );
}
export function copyRegion(
  section: Section,
  id: string,
  delta: Point,
  newId: string,
): Section {
  const next = structuredClone(section),
    source = next.regions.find((r) => r.id === id);
  if (!source) throw new Error("Selecione uma região de solo para copiar.");
  next.regions.push({
    ...source,
    id: newId,
    name: `${source.name.slice(0, 100)} — cópia`,
    points: source.points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })),
  });
  return next;
}
export function splitRegion(
  section: Section,
  id: string,
  a: Point,
  b: Point,
  newId: string,
): Section {
  const source = section.regions.find((r) => r.id === id);
  if (!source) throw new Error("Selecione uma região de solo para dividir.");
  const length = distance(a, b);
  if (length <= EPS)
    throw new Error("Defina dois pontos distintos para a reta de divisão.");
  const dx = (b.x - a.x) / length,
    dy = (b.y - a.y) / length;
  const span = 4 * (Math.max(...source.points.map((p) => distance(a, p))) + 1);
  const p = { x: a.x - dx * span, y: a.y - dy * span },
    q = { x: a.x + dx * span, y: a.y + dy * span };
  const ring = [source.points.map((v) => [v.x, v.y] as [number, number])];
  const pieces = [1, -1].flatMap((sign) => {
    const nx = -dy * span * sign,
      ny = dx * span * sign;
    return polygonClipping.intersection(ring, [
      [
        [p.x, p.y],
        [q.x, q.y],
        [q.x + nx, q.y + ny],
        [p.x + nx, p.y + ny],
      ],
    ]);
  });
  if (pieces.length !== 2 || pieces.some((poly) => poly.length !== 1))
    throw new Error(
      "A reta precisa dividir a região em exatamente duas partes, sem ilhas ou furos.",
    );
  const parts = pieces.map((poly) =>
    poly[0].slice(0, -1).map(([x, y]) => ({ x, y })),
  );
  if (parts.some((part) => Math.abs(signedArea(part)) <= EPS * EPS))
    throw new Error("A divisão produz uma região sem área.");
  const next = structuredClone(section);
  next.regions.find((r) => r.id === id)!.points = parts[0];
  next.regions.push({
    ...source,
    id: newId,
    name: `${source.name.slice(0, 100)} — parte 2`,
    points: parts[1],
  });
  return next;
}
