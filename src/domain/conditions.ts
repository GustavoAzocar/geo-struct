import { uid, type Section, type Surcharge } from "./model";

export const waterModeLabel = (mode: Section["waterMode"]) =>
  mode === "dry"
    ? "Condição seca"
    : mode === "piezometric"
      ? "Linha piezométrica"
      : "Água não definida";
export const loadConditionLabel = (mode: Section["loadCondition"]) =>
  mode === "none"
    ? "Sem sobrecargas"
    : mode === "loads"
      ? "Sobrecargas cadastradas"
      : "Cargas não definidas";
export const activeWater = (s: Section) =>
  s.waterMode === "piezometric" ? s.water : null;
export const isLoadActive = (s: Section, load: Surcharge) =>
  s.loadCondition === "loads" && load.enabled;
export const activeLoads = (s: Section) =>
  s.loads.filter((l) => isLoadActive(s, l));
export function setWaterMode(
  section: Section,
  mode: Section["waterMode"],
): Section {
  return { ...structuredClone(section), waterMode: mode };
}
export function setLoadCondition(
  section: Section,
  mode: Section["loadCondition"],
): Section {
  return { ...structuredClone(section), loadCondition: mode };
}
export function loadPending(load: Surcharge): string[] {
  const pending: string[] = [];
  if (load.q === null) pending.push("intensidade q");
  if (!load.source.trim()) pending.push("origem da sobrecarga");
  return pending;
}
function availableName(s: Section, base: string): string {
  let name = base.slice(0, 100),
    n = 2;
  while (s.loads.some((l) => l.name === name))
    name = `${base.slice(0, 100)} (${n++})`;
  return name;
}
export function createLoad(
  s: Section,
  x1: number,
  x2: number,
): { section: Section; load: Surcharge } {
  if (s.loads.length >= 100)
    throw new Error("Limite de 100 sobrecargas por seção.");
  const load: Surcharge = {
    id: uid(),
    name: availableName(s, "Sobrecarga"),
    x1,
    x2,
    q: null,
    enabled: true,
    source: "",
  };
  const section = structuredClone(s);
  section.loadCondition = "loads";
  section.loads.push(load);
  return { section, load };
}
export function duplicateLoad(
  s: Section,
  id: string,
): { section: Section; load: Surcharge } {
  if (s.loads.length >= 100)
    throw new Error("Limite de 100 sobrecargas por seção.");
  const source = s.loads.find((l) => l.id === id);
  if (!source) throw new Error("Selecione uma sobrecarga existente.");
  const load = {
    ...structuredClone(source),
    id: uid(),
    name: availableName(s, `${source.name.slice(0, 90)} — cópia`),
    enabled: false,
  };
  const section = structuredClone(s);
  section.loads.push(load);
  return { section, load };
}
export function enableLoad(s: Section, id: string, enabled: boolean): Section {
  const next = structuredClone(s),
    load = next.loads.find((l) => l.id === id);
  if (!load) throw new Error("A sobrecarga não existe mais.");
  load.enabled = enabled;
  return next;
}
export function removeLoad(s: Section, id: string): Section {
  if (!s.loads.some((l) => l.id === id))
    throw new Error("A sobrecarga não existe mais.");
  const next = structuredClone(s);
  next.loads = next.loads.filter((l) => l.id !== id);
  return next;
}
