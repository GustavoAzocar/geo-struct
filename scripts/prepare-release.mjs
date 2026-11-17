import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const r = JSON.parse(readFileSync(".github/release-request.json", "utf8"));
assert.equal(r.schemaVersion, 1);
assert.match(r.tag, /^v\d+\.\d+\.\d+$/);
assert.match(r.commit, /^[a-f0-9]{40}$/);
const repo = process.env.GITHUB_REPOSITORY;
assert.equal(repo, "ricardocorsini/geo-struct");
execFileSync("git", ["fetch", "origin", r.commit]);
for (const path of ["package.json", "src-tauri/tauri.conf.json"]) {
  const value = JSON.parse(
    execFileSync("git", ["show", `${r.commit}:${path}`], { encoding: "utf8" }),
  );
  assert.equal(value.version, r.tag.slice(1));
}
const refs = JSON.parse(
  execFileSync("gh", ["api", `repos/${repo}/git/matching-refs/tags/${r.tag}`], {
    encoding: "utf8",
  }),
);
const existing = refs.find((x) => x.ref === `refs/tags/${r.tag}`);
if (existing)
  assert.equal(existing.object.sha, r.commit, "A tag existente é imutável.");
else
  execFileSync(
    "gh",
    [
      "api",
      `repos/${repo}/git/refs`,
      "--method",
      "POST",
      "-f",
      `ref=refs/tags/${r.tag}`,
      "-f",
      `sha=${r.commit}`,
    ],
    { stdio: "inherit" },
  );
