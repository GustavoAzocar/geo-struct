import type { Point } from "./model";
import { distance, EPS, parseNumber } from "./geometry";
import { projectOnSegment, segments } from "./editing";

export type Precision = { gridStep: number; ortho: boolean; linked: boolean };
export type SnapContour = { points: Point[]; closed: boolean };
export function snapPoint(
  raw: Point,
  contours: SnapContour[],
  radius: number,
  gridStep: number,
  anchor: Point | null = null,
  ortho = false,
  excluded: Point | null = null,
): { point: Point; kind: string } {
  const axis =
    ortho && anchor
      ? Math.abs(raw.x - anchor.x) >= Math.abs(raw.y - anchor.y)
        ? "x"
        : "y"
      : null;
  const lock = (p: Point): Point =>
    axis === "x"
      ? { x: p.x, y: anchor!.y }
      : axis === "y"
        ? { x: anchor!.x, y: p.y }
        : p;
  const p = lock(raw);
  const allowed = (q: Point) =>
    (!excluded || distance(q, excluded) > EPS) && distance(q, lock(q)) <= EPS;
  const nearest = (points: Point[]) => {
    let best: Point | null = null,
      d = radius;
    for (const q of points)
      if (allowed(q) && distance(p, q) < d) {
        best = q;
        d = distance(p, q);
      }
    return best;
  };
  const vertex = nearest(contours.flatMap((c) => c.points));
  if (vertex) return { point: { ...vertex }, kind: "Vértice" };
  const nearEdges = contours
    .flatMap((c) => segments(c.points, c.closed))
    .filter(
      ([a, b]) =>
        (!excluded ||
          (distance(a, excluded) > EPS && distance(b, excluded) > EPS)) &&
        distance(p, projectOnSegment(p, a, b)) < radius,
    );
  const intersections: Point[] = [];
  for (let i = 0; i < nearEdges.length; i++)
    for (let j = i + 1; j < nearEdges.length; j++) {
      const [a, b] = nearEdges[i],
        [c, d] = nearEdges[j];
      const rx = b.x - a.x,
        ry = b.y - a.y,
        sx = d.x - c.x,
        sy = d.y - c.y;
      const denominator = rx * sy - ry * sx;
      if (
        Math.abs(denominator) <=
        EPS * Math.max(EPS, Math.hypot(rx, ry) * Math.hypot(sx, sy))
      )
        continue;
      const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator;
      const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denominator;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1)
        intersections.push({ x: a.x + t * rx, y: a.y + t * ry });
    }
  const intersection = nearest(intersections);
  if (intersection) return { point: intersection, kind: "Interseção" };
  const projections = nearEdges.flatMap(([a, b]) => {
    if (!axis) return [projectOnSegment(p, a, b)];
    const other = axis === "x" ? "y" : "x",
      delta = b[other] - a[other];
    if (Math.abs(delta) <= EPS)
      return Math.abs(a[other] - anchor![other]) <= EPS
        ? [projectOnSegment(p, a, b)]
        : [];
    const t = (anchor![other] - a[other]) / delta;
    return t >= 0 && t <= 1
      ? [{ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }]
      : [];
  });
  const edge = nearest(projections);
  if (edge) return { point: lock(edge), kind: "Segmento" };
  if (Number.isFinite(gridStep) && gridStep > 0)
    return {
      point: lock({
        x: Math.round(p.x / gridStep) * gridStep,
        y: Math.round(p.y / gridStep) * gridStep,
      }),
      kind: "Grade",
    };
  return { point: p, kind: axis ? "Ortogonal" : "Livre" };
}
export function precisePoint(
  first: string,
  second: string,
  mode: "absolute" | "relative" | "polar",
  anchor: Point | null,
): Point {
  const a = parseNumber(first),
    b = parseNumber(second);
  if (a === null || b === null)
    throw new Error("Preencha os dois valores. Use ponto ou vírgula decimal.");
  if (mode !== "absolute" && !anchor)
    throw new Error(
      "Informe o primeiro ponto por coordenadas X/Z ou pelo desenho.",
    );
  if (mode === "polar" && a <= 0)
    throw new Error("A distância deve ser maior que zero.");
  const p =
    mode === "absolute"
      ? { x: a, y: b }
      : mode === "relative"
        ? { x: anchor!.x + a, y: anchor!.y + b }
        : {
            x: anchor!.x + a * Math.cos((b * Math.PI) / 180),
            y: anchor!.y + a * Math.sin((b * Math.PI) / 180),
          };
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.y) ||
    Math.abs(p.x) > 1e6 ||
    Math.abs(p.y) > 1e6
  )
    throw new Error("Coordenadas fora do limite de ±1.000.000 m.");
  return p;
}
export function measurePoints(a: Point, b: Point) {
  const dx = b.x - a.x,
    dz = b.y - a.y;
  return {
    distance: Math.hypot(dx, dz),
    dx,
    dz,
    angle: (Math.atan2(dz, dx) * 180) / Math.PI,
  };
}
