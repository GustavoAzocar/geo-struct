import { isTauri } from "@tauri-apps/api/core";
import {
  MAX_FILE_BYTES,
  parseProject,
  serializeProject,
  type Project,
} from "../domain/model";

export const desktop = isTauri();
export const safeName = (s: string) =>
  s
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .trim()
    .slice(0, 100) || "projeto";
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function openNative(): Promise<{
  project: Project;
  path: string;
} | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile, stat } = await import("@tauri-apps/plugin-fs");
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Projeto GeoStruct", extensions: ["json"] }],
  });
  if (!path) return null;
  if ((await stat(path)).size > MAX_FILE_BYTES)
    throw new Error("O arquivo excede o limite de 8 MB.");
  return { project: parseProject(await readTextFile(path)), path };
}
export async function saveProject(
  p: Project,
  currentPath: string | null,
  asCopy = false,
): Promise<string | null> {
  const content = serializeProject(p);
  if (!desktop) {
    download(`${safeName(p.name)}.geo.json`, content);
    return "download";
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const path =
    (!asCopy && currentPath) ||
    (await save({
      defaultPath: `${safeName(p.name)}.geo.json`,
      filters: [{ name: "Projeto GeoStruct", extensions: ["json"] }],
    }));
  if (!path) return null;
  await writeTextFile(path, content);
  return path;
}
export async function exportText(
  name: string,
  content: string,
  type: string,
): Promise<boolean> {
  if (!desktop) {
    download(name, content, type);
    return true;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await save({
    defaultPath: name,
    filters: [{ name: "Arquivo", extensions: [name.split(".").at(-1)!] }],
  });
  if (!path) return false;
  await writeTextFile(path, content);
  return true;
}
const RECOVERY_KEY = "geostruct.recovery.v1";
export function getRecovery(): { project: Project; savedAt: string } | null {
  const text = localStorage.getItem(RECOVERY_KEY);
  if (!text) return null;
  const data = JSON.parse(text);
  return {
    project: parseProject(JSON.stringify(data.project)),
    savedAt: String(data.savedAt),
  };
}
export function putRecovery(p: Project) {
  localStorage.setItem(
    RECOVERY_KEY,
    JSON.stringify({ project: p, savedAt: new Date().toISOString() }),
  );
}
export function removeRecovery() {
  localStorage.removeItem(RECOVERY_KEY);
}
