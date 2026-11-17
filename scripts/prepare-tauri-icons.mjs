import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Arquivos padrão do template oficial: cópia binária, sem geração ou conversão.
const revision = "c6f5cf68942f187ba7bb738a49ee505c28e6ca5a";
const source = `https://raw.githubusercontent.com/tauri-apps/create-tauri-app/${revision}/templates/_base_/src-tauri/icons/`;
const directory = new URL("../src-tauri/icons/", import.meta.url);
const files = {
  "32x32.png":
    "d151f11e325f7502de0c739a2e51697aa569fd4701ae6e11fae1a3b4c7d5f157",
  "128x128.png":
    "1f3689f6374b0553996fdc99743799216703835070145d7f0e6ec11e6280139e",
  "128x128@2x.png":
    "69194785eef4323955af73b0c03362ac0804db056c2424f9715076cabc0ed103",
  "icon.png":
    "b5d93c8ec365c08b11bd006e46a46e227c681d30bb295af3d017573bfc752a83",
  "icon.ico":
    "e38ca88e1d5490f3dcbc3c3fa525f7fcb7b80fff3cb2f3a4eb1b2d018c0915c1",
  "icon.icns":
    "3dc10493b7de48a61de58f768f8a5708d3a44a068c148cedf0502b9b9b71ba5d",
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

await mkdir(directory, { recursive: true });
for (const [name, expected] of Object.entries(files)) {
  const destination = new URL(name, directory);
  let existing;
  try {
    existing = await readFile(destination);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing) {
    if (sha256(existing) !== expected)
      throw new Error(
        `O ícone local ${name} difere do padrão; arquivo preservado.`,
      );
    continue;
  }
  const response = await fetch(new URL(name, source), {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(
      `Não foi possível baixar ${name}: HTTP ${response.status}.`,
    );
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (sha256(bytes) !== expected)
    throw new Error(`Integridade inválida no ícone padrão ${name}.`);
  await writeFile(destination, bytes);
}
console.log("Ícones padrão do Tauri prontos.");
