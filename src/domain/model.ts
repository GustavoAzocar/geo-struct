import { z } from "zod";

const coordinate = z.number().finite().min(-1e6).max(1e6);
const id = z.string().min(1).max(100);
const name = z.string().trim().min(1, "Informe um nome.").max(120);
const pointSchema = z.object({ x: coordinate, y: coordinate });
const points = z.array(pointSchema).max(500);
export const materialSchema = z.object({
  id,
  name,
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  gamma: z.number().finite().positive().max(100).nullable(),
  cohesion: z.number().finite().min(0).max(1e6).nullable(),
  friction: z.number().finite().min(0).lt(90).nullable(),
  mode: z.enum(["effective", "total"]),
  source: z.string().max(2000),
});
const sectionSchema = z.object({
  id,
  name,
  terrain: points,
  base: coordinate,
  backgroundMaterialId: id,
  regions: z.array(z.object({ id, name, materialId: id, points })).max(64),
  water: points.nullable(),
  loads: z
    .array(
      z.object({
        id,
        name,
        x1: coordinate,
        x2: coordinate,
        q: z.number().finite().min(0).max(1e6),
      }),
    )
    .max(100),
  circle: z
    .object({
      x: coordinate,
      y: coordinate,
      radius: z.number().finite().positive().max(1e6),
    })
    .nullable(),
});
export const projectSchema = z
  .object({
    format: z.literal("geostruct"),
    version: z.literal(1),
    id,
    name,
    author: z.string().max(200),
    description: z.string().max(4000),
    units: z.literal("m-kN-kPa"),
    materials: z.array(materialSchema).min(1).max(100),
    sections: z.array(sectionSchema).min(1).max(100),
  })
  .superRefine((p, ctx) => {
    const ids = [
      p.id,
      ...p.materials.map((x) => x.id),
      ...p.sections.flatMap((s) => [
        s.id,
        ...s.regions.map((x) => x.id),
        ...s.loads.map((x) => x.id),
      ]),
    ];
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Identificadores duplicados no projeto.",
      });
    const materials = new Set(p.materials.map((x) => x.id));
    for (const s of p.sections) {
      if (
        ![s.backgroundMaterialId, ...s.regions.map((x) => x.materialId)].every(
          (x) => materials.has(x),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: `Material inexistente em ${s.name}.`,
        });
    }
  });
export type Point = z.infer<typeof pointSchema>;
export type Material = z.infer<typeof materialSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Selection =
  | { kind: "project" | "section" | "terrain" | "water" | "circle" }
  | { kind: "material" | "region" | "load"; id: string };
export type Tool =
  | "select"
  | "pan"
  | "terrain"
  | "region"
  | "water"
  | "load"
  | "circle"
  | "insert-vertex"
  | "delete-vertex"
  | "move-contour"
  | "copy-region"
  | "split-region"
  | "measure";
export const uid = () => crypto.randomUUID();
export const newMaterial = (): Material => ({
  id: uid(),
  name: "Novo solo",
  color: "#caa16e",
  gamma: null,
  cohesion: null,
  friction: null,
  mode: "effective",
  source: "",
});
export const newSection = (
  materialId: string,
  sectionName = "Seção 01",
): Section => ({
  id: uid(),
  name: sectionName,
  terrain: [],
  base: -10,
  backgroundMaterialId: materialId,
  regions: [],
  water: null,
  loads: [],
  circle: null,
});
export function newProject(projectName: string, author = ""): Project {
  const m = newMaterial();
  m.name = "Solo 1";
  return {
    format: "geostruct",
    version: 1,
    id: uid(),
    name: projectName,
    author,
    description: "",
    units: "m-kN-kPa",
    materials: [m],
    sections: [newSection(m.id)],
  };
}
export function exampleProject(): Project {
  const p = newProject("Talude em duas camadas", "");
  p.description =
    "Exemplo ilustrativo próprio para explorar a modelagem. Não é um caso de validação de estabilidade.";
  p.materials[0] = {
    ...p.materials[0],
    name: "Solo residual",
    color: "#d5b68c",
    gamma: 19,
    cohesion: 12,
    friction: 28,
    source: "Dados ilustrativos para demonstração; sem investigação de campo.",
  };
  const fill: Material = {
    ...newMaterial(),
    name: "Aterro compactado",
    color: "#bc8150",
    gamma: 18,
    cohesion: 5,
    friction: 30,
    source: "Dados ilustrativos para demonstração; sem investigação de campo.",
  };
  p.materials.push(fill);
  const s = p.sections[0];
  s.name = "Seção A–A";
  s.base = 0;
  s.terrain = [
    { x: 0, y: 22 },
    { x: 18, y: 22 },
    { x: 38, y: 10 },
    { x: 60, y: 10 },
  ];
  s.regions = [
    {
      id: uid(),
      name: "Camada de aterro",
      materialId: fill.id,
      points: [
        { x: 0, y: 15 },
        { x: 0, y: 22 },
        { x: 18, y: 22 },
        { x: 38, y: 10 },
        { x: 60, y: 10 },
        { x: 60, y: 6 },
        { x: 38, y: 6 },
        { x: 18, y: 15 },
      ],
    },
  ];
  s.water = [
    { x: 0, y: 12 },
    { x: 18, y: 12 },
    { x: 38, y: 7 },
    { x: 60, y: 7 },
  ];
  s.loads = [{ id: uid(), name: "Sobrecarga de crista", x1: 5, x2: 14, q: 20 }];
  return p;
}
export function duplicateSection(s: Section): Section {
  return {
    ...structuredClone(s),
    id: uid(),
    name: `${s.name.slice(0, 100)} — cópia`,
    regions: s.regions.map((r) => ({ ...structuredClone(r), id: uid() })),
    loads: s.loads.map((l) => ({ ...l, id: uid() })),
  };
}
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export function parseProject(text: string): Project {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error("O arquivo excede o limite de 8 MB.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não contém um JSON válido.");
  }
  const r = projectSchema.safeParse(value);
  if (!r.success)
    throw new Error(
      "Projeto incompatível ou inválido: " +
        r.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" · "),
    );
  return r.data;
}
export const serializeProject = (p: Project) =>
  JSON.stringify(projectSchema.parse(p), null, 2) + "\n";
