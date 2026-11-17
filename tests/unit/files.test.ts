import { beforeEach, expect, it, vi } from "vitest";
import { exampleProject, serializeProject } from "../../src/domain/model";
const io = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
  stat: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: io.open, save: io.save }));
vi.mock("@tauri-apps/plugin-fs", () => io);
import { openNative, saveProject } from "../../src/lib/files";
beforeEach(() => vi.resetAllMocks());
it("cancelar abrir não lê arquivos", async () => {
  io.open.mockResolvedValue(null);
  expect(await openNative()).toBeNull();
  expect(io.stat).not.toHaveBeenCalled();
});
it("cancelar salvar como preserva o arquivo atual", async () => {
  io.save.mockResolvedValue(null);
  expect(
    await saveProject(exampleProject(), "/original.geo.json", true),
  ).toBeNull();
  expect(io.writeTextFile).not.toHaveBeenCalled();
});
it("salvar usa o caminho escolhido e dados reabríveis", async () => {
  const p = exampleProject();
  io.save.mockResolvedValue("/com espaços/Projeto.geo.json");
  await saveProject(p, null);
  expect(io.writeTextFile).toHaveBeenCalledWith(
    "/com espaços/Projeto.geo.json",
    serializeProject(p),
  );
  io.open.mockResolvedValue("/com espaços/Projeto.geo.json");
  io.stat.mockResolvedValue({ size: 1000 });
  io.readTextFile.mockResolvedValue(serializeProject(p));
  expect((await openNative())?.project).toEqual(p);
});
it("salvar existente não solicita outro caminho e propaga falha de escrita", async () => {
  io.writeTextFile.mockRejectedValue(new Error("Sem permissão"));
  await expect(
    saveProject(exampleProject(), "/original.geo.json"),
  ).rejects.toThrow("Sem permissão");
  expect(io.save).not.toHaveBeenCalled();
});
it("arquivo grande não é lido e erro de leitura é preservado", async () => {
  io.open.mockResolvedValue("/grande.json");
  io.stat.mockResolvedValue({ size: 9 * 1024 * 1024 });
  await expect(openNative()).rejects.toThrow("8 MB");
  expect(io.readTextFile).not.toHaveBeenCalled();
  io.stat.mockResolvedValue({ size: 10 });
  io.readTextFile.mockRejectedValue(new Error("Falha de leitura"));
  await expect(openNative()).rejects.toThrow("Falha de leitura");
});
