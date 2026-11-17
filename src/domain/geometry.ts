import polygonClipping from "polygon-clipping";
import type { Point, Section, Project } from "./model";
// Tolerância geométrica de modelagem, em metros. Não é tolerância do futuro solver.
export const EPS = 1e-7;
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export function signedArea(points: Point[]): number {
  return (
    points.reduce((a, p, i) => {
      const q = points[(i + 1) % points.length];
      return a + p.x * q.y - q.x * p.y;
    }, 0) / 2
  );
}
export function onSegment(p: Point, a: Point, b: Point): boolean {
  return (
    Math.abs(cross(a, b, p)) <= EPS * Math.max(1, distance(a, b)) &&
    p.x >= Math.min(a.x, b.x) - EPS &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    p.y >= Math.min(a.y, b.y) - EPS &&
    p.y <= Math.max(a.y, b.y) + EPS
  );
}
export function segmentsIntersect(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): boolean {
  const c1 = cross(a, b, c),
    c2 = cross(a, b, d),
    c3 = cross(c, d, a),
    c4 = cross(c, d, b);
  return (
    (c1 * c2 < 0 && c3 * c4 < 0) ||
    onSegment(a, c, d) ||
    onSegment(b, c, d) ||
    onSegment(c, a, b) ||
    onSegment(d, a, b)
  );
}
export function polygonError(p: Point[]): string | null {
  if (p.length < 3) return "Uma região precisa de ao menos três vértices.";
  for (let i = 0; i < p.length; i++) {
    if (distance(p[i], p[(i + 1) % p.length]) <= EPS)
      return "Há vértices consecutivos coincidentes.";
    for (let j = i + 1; j < p.length; j++) {
      if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
      if (
        segmentsIntersect(
          p[i],
          p[(i + 1) % p.length],
          p[j],
          p[(j + 1) % p.length],
        )
      )
        return "O contorno cruza ou toca a si próprio.";
    }
  }
  if (Math.abs(signedArea(p)) <= EPS * EPS) return "A região tem área nula.";
  return null;
}
export function lineError(points: Point[]): string | null {
  if (points.length < 2)
    return "Informe ao menos dois pontos, da esquerda para a direita.";
  if (points.some((p, i) => i > 0 && p.x - points[i - 1].x <= EPS))
    return "As coordenadas X devem crescer. Faces verticais e perfis em balanço ficam para uma próxima etapa.";
  return null;
}
export function elevation(points: Point[], x: number): number | null {
  if (points.length < 2 || x < points[0].x - EPS || x > points.at(-1)!.x + EPS)
    return null;
  for (let i = 1; i < points.length; i++)
    if (x <= points[i].x + EPS) {
      const a = points[i - 1],
        b = points[i];
      return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    }
  return null;
}
export function boundary(s: Section): Point[] {
  return s.terrain.length < 2
    ? []
    : [
        ...s.terrain,
        { x: s.terrain.at(-1)!.x, y: s.base },
        { x: s.terrain[0].x, y: s.base },
      ];
}
const ring = (p: Point[]): polygonClipping.Polygon => [
  p.map(({ x, y }) => [x, y]),
];
function clippedArea(mp: polygonClipping.MultiPolygon): number {
  return mp.reduce(
    (a, poly) =>
      a +
      poly.reduce(
        (v, r, i) =>
          v +
          (i === 0 ? 1 : -1) *
            Math.abs(signedArea(r.map(([x, y]) => ({ x, y })))),
        0,
      ),
    0,
  );
}
export function regionError(
  s: Section,
  points: Point[],
  exceptId?: string,
): string | null {
  const err = polygonError(points);
  if (err) return err;
  if (lineError(s.terrain))
    return "Defina primeiro um perfil de terreno válido.";
  if (s.terrain.some((p) => p.y <= s.base + EPS))
    return "A base deve ficar abaixo de todo o terreno.";
  try {
    if (
      clippedArea(polygonClipping.difference(ring(points), ring(boundary(s)))) >
      EPS * EPS
    )
      return "A região deve ficar inteiramente dentro da seção.";
    for (const r of s.regions)
      if (
        r.id !== exceptId &&
        !polygonError(r.points) &&
        clippedArea(
          polygonClipping.intersection(ring(points), ring(r.points)),
        ) >
          EPS * EPS
      )
        return `A região se sobrepõe a “${r.name}”. Contornos podem compartilhar bordas.`;
  } catch {
    return "Não foi possível verificar os contornos. Revise os vértices.";
  }
  return null;
}
export type Diagnostic = {
  level: "error" | "warning" | "info";
  message: string;
  target: string;
  sectionId?: string;
};
export function diagnose(p: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const m of p.materials) {
    if ([m.gamma, m.cohesion, m.friction].some((v) => v === null))
      out.push({
        level: "warning",
        target: m.id,
        message: `${m.name}: complete peso específico, coesão e atrito.`,
      });
    if (!m.source.trim())
      out.push({
        level: "warning",
        target: m.id,
        message: `${m.name}: informe a origem dos parâmetros.`,
      });
  }
  for (const s of p.sections) {
    const push = (level: Diagnostic["level"], message: string, target = s.id) =>
      out.push({
        level,
        message: `${s.name}: ${message}`,
        target,
        sectionId: s.id,
      });
    const err = lineError(s.terrain);
    if (err) {
      push("error", err);
      continue;
    }
    if (s.terrain.some((pt) => pt.y <= s.base + EPS))
      push("error", "a cota da base deve ficar abaixo de todo o terreno.");
    for (const r of s.regions) {
      const e = regionError(s, r.points, r.id);
      if (e) push("error", `${r.name}: ${e}`, r.id);
    }
    if (s.water) {
      const e = lineError(s.water);
      if (e) push("error", `linha piezométrica: ${e}`, "water");
      else {
        if (
          s.water[0].x > s.terrain[0].x + EPS ||
          s.water.at(-1)!.x < s.terrain.at(-1)!.x - EPS
        )
          push(
            "warning",
            "a linha piezométrica não cobre toda a seção.",
            "water",
          );
        const xs = [...s.terrain, ...s.water].map((v) => v.x);
        if (
          xs.some((x) => {
            const g = elevation(s.terrain, x),
              w = elevation(s.water!, x);
            return g !== null && w !== null && w > g + EPS;
          })
        )
          push(
            "warning",
            "há carga piezométrica acima do terreno; isso não modela lâmina de água externa.",
            "water",
          );
      }
    }
    for (const l of s.loads)
      if (
        l.x2 - l.x1 <= EPS ||
        l.x1 < s.terrain[0].x - EPS ||
        l.x2 > s.terrain.at(-1)!.x + EPS
      )
        push(
          "error",
          `${l.name}: confira os limites da faixa sobre o terreno.`,
          l.id,
        );
  }
  return out;
}
export function parseNumber(value: string): number | null {
  const v = value.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(v)) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
export function parseCoordinates(text: string): Point[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((x) => x.trim());
  if (lines.length > 500) throw new Error("Limite de 500 pontos por contorno.");
  return lines.map((line, i) => {
    const values = line.trim().split(/[;\t ]+/);
    const x = parseNumber(values[0] ?? ""),
      y = parseNumber(values[1] ?? "");
    if (
      values.length !== 2 ||
      x === null ||
      y === null ||
      Math.abs(x) > 1e6 ||
      Math.abs(y) > 1e6
    )
      throw new Error(
        `Linha ${i + 1}: use X ; Y, com valores entre −1.000.000 e 1.000.000 m.`,
      );
    return { x, y };
  });
}
