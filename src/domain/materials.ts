import {
  newMaterial,
  type Material,
  type Project,
  type Selection,
} from "./model";

export type MaterialUse = {
  sectionId: string;
  sectionName: string;
  label: string;
  selection: Selection;
};
export type MaterialDestination =
  | { kind: "background" }
  | { kind: "region"; id: string };
export const materialMode = (mode: Material["mode"]) =>
  mode === "effective"
    ? "Tensões efetivas — c′, φ′"
    : mode === "total"
      ? "Tensões totais — c, φ"
      : "Não definido";
export function materialPending(m: Material): string[] {
  const missing: string[] = [];
  if (m.gamma === null) missing.push("peso específico total γ");
  if (m.mode === null) missing.push("tipo de parâmetros de resistência");
  if (m.cohesion === null)
    missing.push(m.mode === "effective" ? "coesão c′" : "coesão c");
  if (m.friction === null)
    missing.push(m.mode === "effective" ? "atrito φ′" : "atrito φ");
  if (!m.source.trim()) missing.push("origem dos parâmetros");
  return missing;
}
export function materialUses(p: Project, id: string): MaterialUse[] {
  return p.sections.flatMap((s) => [
    ...(s.backgroundMaterialId === id
      ? [
          {
            sectionId: s.id,
            sectionName: s.name,
            label: "Solo de fundo",
            selection: { kind: "terrain" as const },
          },
        ]
      : []),
    ...s.regions
      .filter((r) => r.materialId === id)
      .map((r) => ({
        sectionId: s.id,
        sectionName: s.name,
        label: r.name,
        selection: { kind: "region" as const, id: r.id },
      })),
  ]);
}
export function materialName(p: Project, id: string | null): string {
  return p.materials.find((m) => m.id === id)?.name ?? "Sem material";
}
export function availableMaterialName(p: Project, base: string): string {
  const root = base.slice(0, 105);
  let name = root,
    suffix = 2;
  while (p.materials.some((m) => m.name === name))
    name = `${root} (${suffix++})`;
  return name;
}
export function addMaterial(
  p: Project,
  sourceId?: string,
): { project: Project; material: Material } {
  if (p.materials.length >= 100) throw new Error("Limite de 100 materiais.");
  const source = sourceId
    ? p.materials.find((m) => m.id === sourceId)
    : undefined;
  if (sourceId && !source) throw new Error("Selecione um material existente.");
  const m = source
    ? {
        ...structuredClone(source),
        id: newMaterial().id,
        name: availableMaterialName(p, `${source.name.slice(0, 95)} — cópia`),
      }
    : { ...newMaterial(), name: availableMaterialName(p, "Novo solo") };
  return { project: { ...p, materials: [...p.materials, m] }, material: m };
}
export function assignMaterial(
  p: Project,
  sectionId: string,
  destinations: MaterialDestination[],
  materialId: string | null,
): Project {
  if (materialId !== null && !p.materials.some((m) => m.id === materialId))
    throw new Error("Selecione um material existente.");
  if (!destinations.length)
    throw new Error("Selecione ao menos um destino para a atribuição.");
  const next = structuredClone(p),
    section = next.sections.find((s) => s.id === sectionId);
  if (!section) throw new Error("A seção não existe mais.");
  for (const destination of destinations) {
    if (destination.kind === "background")
      section.backgroundMaterialId = materialId;
    else {
      const r = section.regions.find((r) => r.id === destination.id);
      if (!r) throw new Error("Uma das regiões selecionadas não existe mais.");
      r.materialId = materialId;
    }
  }
  return next;
}
export function removeMaterial(
  p: Project,
  id: string,
  replacementId?: string,
): Project {
  if (!p.materials.some((m) => m.id === id))
    throw new Error("O material não existe mais.");
  const uses = materialUses(p, id);
  if (
    uses.length &&
    (!replacementId ||
      replacementId === id ||
      !p.materials.some((m) => m.id === replacementId))
  )
    throw new Error(
      "Escolha outro material para substituir todas as atribuições antes de excluir.",
    );
  const next = structuredClone(p);
  for (const s of next.sections) {
    if (s.backgroundMaterialId === id) s.backgroundMaterialId = replacementId!;
    for (const r of s.regions)
      if (r.materialId === id) r.materialId = replacementId!;
  }
  next.materials = next.materials.filter((m) => m.id !== id);
  return next;
}
