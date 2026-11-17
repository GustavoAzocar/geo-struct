import type { PointXZ } from "./input";

export type Circle = { x: number; z: number; radius: number };
export type GeometryDiagnostic = { code: string; message: string };
export class GeometryError extends Error {
  constructor(readonly diagnostic: GeometryDiagnostic) {
    super(diagnostic.message);
  }
}
export function fail(code: string, message: string): never {
  throw new GeometryError({ code, message });
}

export function lowerArc(c: Circle, x: number): PointXZ {
  const u = (x - c.x) / c.radius;
  if (!Number.isFinite(u) || Math.abs(u) > 1)
    fail("arc-domain", "Um corte ficou fora do domínio do arco inferior.");
  return { x, z: c.z - c.radius * Math.sqrt((1 - u) * (1 + u)) };
}
export const arcAngle = (c: Circle, x: number) =>
  Math.asin((x - c.x) / c.radius);

/** Raízes analíticas em coordenadas locais; orientação canônica de arestas compartilhadas. */
export function segmentCircleIntersections(
  c: Circle,
  first: PointXZ,
  last: PointXZ,
  tolerance: number,
): PointXZ[] {
  const [a, b] =
    first.x < last.x || (first.x === last.x && first.z <= last.z)
      ? [first, last]
      : [last, first];
  const dx = b.x - a.x,
    dz = b.z - a.z,
    length = Math.hypot(dx, dz);
  if (length === 0)
    fail("zero-segment", "Há um segmento geométrico de comprimento nulo.");
  const ux = dx / length,
    uz = dz / length;
  const ax = (a.x - c.x) / c.radius,
    az = (a.z - c.z) / c.radius;
  const distance = ax * uz - az * ux;
  const projection = -(ax * ux + az * uz);
  const eps = tolerance / c.radius;
  if (![distance, projection, eps].every(Number.isFinite))
    fail(
      "numerical-resolution",
      "As dimensões não permitem resolver as interseções nesta precisão.",
    );
  if (Math.abs(distance) > 1 + eps) return [];
  const offset =
    Math.abs(1 - Math.abs(distance)) <= eps
      ? 0
      : Math.sqrt((1 - Math.abs(distance)) * (1 + Math.abs(distance)));
  const roots =
    offset === 0 ? [projection] : [projection - offset, projection + offset];
  const points: PointXZ[] = [];
  for (const root of roots) {
    const along = root * c.radius;
    if (along < -tolerance || along > length + tolerance) continue;
    let p = {
      x: c.x + c.radius * (ax + root * ux),
      z: c.z + c.radius * (az + root * uz),
    };
    if (
      Math.abs(along) <= tolerance &&
      Math.abs(Math.hypot(a.x - c.x, a.z - c.z) - c.radius) <= tolerance
    )
      p = { ...a };
    else if (
      Math.abs(along - length) <= tolerance &&
      Math.abs(Math.hypot(b.x - c.x, b.z - c.z) - c.radius) <= tolerance
    )
      p = { ...b };
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z))
      fail(
        "numerical-resolution",
        "A interseção não pôde ser representada com coordenadas finitas.",
      );
    if (p.z <= c.z && Math.abs(p.x - c.x) <= c.radius) points.push(p);
  }
  return points;
}

/** Limite unilateral do terreno, preservando saltos verticais. */
export function terrainElevation(
  terrain: readonly PointXZ[],
  x: number,
  side: "left" | "right",
): number {
  const segments: [PointXZ, PointXZ][] = [];
  for (let i = 0; i < terrain.length - 1; i++) {
    const a = terrain[i],
      b = terrain[i + 1];
    if (b.x > a.x && a.x <= x && x <= b.x) segments.push([a, b]);
  }
  const segment = side === "left" ? segments[0] : segments.at(-1);
  if (!segment)
    fail(
      "terrain-coverage",
      "O terreno não cobre um dos cortes da superfície.",
    );
  const [a, b] = segment;
  return a.z + (b.z - a.z) * ((x - a.x) / (b.x - a.x));
}

export function pointInRegion(
  p: PointXZ,
  polygon: readonly PointXZ[],
  tolerance: number,
): "inside" | "outside" | "boundary" {
  let inside = false;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    const t =
      length2 === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2),
          );
    if (Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)) <= tolerance)
      return "boundary";
    if (a.z > p.z !== b.z > p.z && p.x < a.x + ((p.z - a.z) * dx) / dz)
      inside = !inside;
  }
  return inside ? "inside" : "outside";
}

/** Área entre arco e corda. Série de θ − sin θ, para 0 < θ <= 3 graus. */
export function circularSegmentArea(radius: number, angle: number): number {
  const t2 = angle * angle;
  return (
    ((radius * radius * angle * t2) / 12) *
    (1 - t2 / 20 + (t2 * t2) / 840 - t2 ** 3 / 60480 + t2 ** 4 / 6652800)
  );
}
