import { z } from "zod";

const coordinate = z.number().finite().min(-1e6).max(1e6);
const id = z.string().min(1).max(100);
const name = z.string().trim().min(1, "Informe um nome.").max(120);
const pointSchema = z.object({ x: coordinate, y: coordinate }).strict();
const points = z.array(pointSchema).max(500);
export const materialSchema = z
  .object({
    id,
    name,
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    gamma: z
      .number()
      .finite()
      .positive("O peso específico deve ser maior que zero.")
      .max(100, "O limite de cadastro do peso específico é 100 kN/m³.")
      .nullable(),
    cohesion: z
      .number()
      .finite()
      .min(0, "A coesão não pode ser negativa.")
      .max(1e6, "O limite de cadastro da coesão é 1.000.000 kPa.")
      .nullable(),
    friction: z
      .number()
      .finite()
      .min(0, "O atrito não pode ser negativo.")
      .lt(90, "O atrito deve ser menor que 90°.")
      .nullable(),
    mode: z.enum(["effective", "total"]).nullable(),
    source: z.string().max(2000),
  })
  .strict();
const regionSchema = z
  .object({ id, name, materialId: id.nullable(), points })
  .strict();
const sectionSchema = z
  .object({
    id,
    name,
    terrain: points,
    base: coordinate,
    backgroundMaterialId: id.nullable(),
    regions: z.array(regionSchema).max(64),
    water: points.nullable(),
    loads: z
      .array(
        z
          .object({
            id,
            name,
            x1: coordinate,
            x2: coordinate,
            q: z.number().finite().min(0).max(1e6),
          })
          .strict(),
      )
      .max(100),
    circle: z
      .object({
        x: coordinate,
        y: coordinate,
        radius: z.number().finite().positive().max(1e6),
      })
      .strict()
      .nullable(),
  })
  .strict();
const projectFields = z
  .object({
    format: z.literal("geostruct"),
    version: z.literal(2),
    id,
    name,
    author: z.string().max(200),
    description: z.string().max(4000),
    units: z.literal("m-kN-kPa"),
    materials: z.array(materialSchema).max(100),
    sections: z.array(sectionSchema).min(1).max(100),
  })
  .strict();
function checkReferences(
  p: {
    id: string;
    materials: { id: string }[];
    sections: {
      id: string;
      name: string;
      backgroundMaterialId: string | null;
      regions: { id: string; materialId: string | null }[];
      loads: { id: string }[];
    }[];
  },
  ctx: z.RefinementCtx,
) {
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
        (x) => x === null || materials.has(x),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: `Material inexistente em ${s.name}.`,
      });
  }
}
export const projectSchema = projectFields.superRefine(checkReferences);
const legacyProjectSchema = projectFields
  .extend({
    version: z.literal(1),
    materials: z
      .array(materialSchema.extend({ mode: z.enum(["effective", "total"]) }))
      .min(1)
      .max(100),
    sections: z
      .array(
        sectionSchema.extend({
          backgroundMaterialId: id,
          regions: z.array(regionSchema.extend({ materialId: id })).max(64),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine(checkReferences);
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
  mode: null,
  source: "",
});
export const newSection = (sectionName = "Seção 01"): Section => ({
  id: uid(),
  name: sectionName,
  terrain: [],
  base: -10,
  backgroundMaterialId: null,
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
    version: 2,
    id: uid(),
    name: projectName,
    author,
    description: "",
    units: "m-kN-kPa",
    materials: [m],
    sections: [newSection()],
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
    mode: "effective",
    source: "Dados ilustrativos para demonstração; sem investigação de campo.",
  };
  const fill: Material = {
    ...newMaterial(),
    name: "Aterro compactado",
    color: "#bc8150",
    gamma: 18,
    cohesion: 5,
    friction: 30,
    mode: "effective",
    source: "Dados ilustrativos para demonstração; sem investigação de campo.",
  };
  p.materials.push(fill);
  const s = p.sections[0];
  s.backgroundMaterialId = p.materials[0].id;
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
export function readProject(text: string): {
  project: Project;
  migrated: boolean;
} {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error("O arquivo excede o limite de 8 MB.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não contém um JSON válido.");
  }
  const legacy =
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1;
  const r = (legacy ? legacyProjectSchema : projectSchema).safeParse(value);
  if (!r.success)
    throw new Error(
      "Projeto incompatível ou inválido: " +
        r.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" · "),
    );
  return {
    project: projectSchema.parse({ ...r.data, version: 2 }),
    migrated: legacy,
  };
}
export const parseProject = (text: string): Project =>
  readProject(text).project;
export const serializeProject = (p: Project) =>
  JSON.stringify(projectSchema.parse(p), null, 2) + "\n";
