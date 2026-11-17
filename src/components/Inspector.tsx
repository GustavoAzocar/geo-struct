import { useEffect, useState } from "react";
import { Plus, Trash2, Check, RotateCcw } from "lucide-react";
import {
  projectSchema,
  type Project,
  type Section,
  type Selection,
  type Point,
} from "../domain/model";
import { contourTarget, replaceContourCoordinates } from "../domain/editing";
import { diagnose, parseCoordinates, parseNumber } from "../domain/geometry";

const labels: Record<Selection["kind"], string> = {
  project: "Dados do projeto",
  section: "Dados da seção",
  terrain: "Perfil do terreno",
  region: "Região de solo",
  material: "Material",
  water: "Linha piezométrica",
  load: "Sobrecarga",
  circle: "Círculo de tentativa",
};
export function Inspector({
  project,
  section,
  selection,
  onApply,
  onDirty,
  linked,
}: {
  project: Project;
  section: Section;
  selection: Selection;
  onApply: (p: Project) => void;
  onDirty: (b: boolean) => void;
  linked: boolean;
}) {
  const source =
    selection.kind === "material"
      ? project.materials.find((m) => m.id === selection.id)
      : selection.kind === "region"
        ? section.regions.find((r) => r.id === selection.id)
        : selection.kind === "load"
          ? section.loads.find((l) => l.id === selection.id)
          : selection.kind === "project"
            ? project
            : selection.kind === "circle"
              ? section.circle
              : section;
  const initialPoints: Point[] =
    selection.kind === "terrain"
      ? section.terrain
      : selection.kind === "water"
        ? (section.water ?? [])
        : selection.kind === "region"
          ? ((source as Section["regions"][number])?.points ?? [])
          : [];
  const initial = Object.fromEntries(
    Object.entries(source ?? {})
      .filter(
        ([, v]) => typeof v === "string" || typeof v === "number" || v === null,
      )
      .map(([k, v]) => [k, v === null ? "" : String(v)]),
  );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [coordinates, setCoordinates] = useState<string[][]>(
    initialPoints.map((p) => [String(p.x), String(p.y)]),
  );
  const [originalRows, setOriginalRows] = useState<(number | null)[]>(
    initialPoints.map((_, i) => i),
  );
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  const change = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
    setError("");
  };
  const editCoordinates = (coords: string[][]) => {
    setCoordinates(coords);
    setDirty(true);
    setError("");
  };
  const reset = () => {
    setValues(initial);
    setCoordinates(initialPoints.map((p) => [String(p.x), String(p.y)]));
    setOriginalRows(initialPoints.map((_, i) => i));
    setError("");
    setDirty(false);
    setPaste("");
  };
  const field = (
    key: string,
    label: string,
    opts: {
      number?: boolean;
      textarea?: boolean;
      hint?: string;
      type?: string;
    } = {},
  ) => (
    <label className="field" key={key}>
      <span>{label}</span>
      {opts.textarea ? (
        <textarea
          value={values[key] ?? ""}
          onChange={(e) => change(key, e.target.value)}
          rows={3}
        />
      ) : (
        <input
          type={opts.type ?? "text"}
          inputMode={opts.number ? "decimal" : undefined}
          value={values[key] ?? ""}
          onChange={(e) => change(key, e.target.value)}
          autoComplete="off"
        />
      )}
      {opts.hint && <small>{opts.hint}</small>}
    </label>
  );
  const materialSelect = (key: string, label: string) => (
    <label className="field">
      <span>{label}</span>
      <select value={values[key]} onChange={(e) => change(key, e.target.value)}>
        {project.materials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
  const number = (key: string, label: string, optional = false) => {
    const value = values[key] ?? "";
    if (!value.trim() && optional) return null;
    const n = parseNumber(value);
    if (n === null)
      throw new Error(
        `${label}: informe um número válido. Use ponto ou vírgula decimal.`,
      );
    return n;
  };
  const apply = () => {
    try {
      const p = structuredClone(project),
        s = p.sections.find((x) => x.id === section.id)!;
      const points = () =>
        parseCoordinates(coordinates.map((row) => row.join(" ; ")).join("\n"));
      const target = contourTarget(selection);
      if (target)
        Object.assign(
          s,
          replaceContourCoordinates(
            section,
            target,
            points(),
            originalRows,
            linked,
          ),
        );
      switch (selection.kind) {
        case "project":
          p.name = values.name;
          p.author = values.author;
          p.description = values.description;
          break;
        case "section":
          s.name = values.name;
          s.base = number("base", "Cota da base")!;
          s.backgroundMaterialId = values.backgroundMaterialId;
          break;
        case "terrain":
          s.base = number("base", "Cota da base")!;
          s.backgroundMaterialId = values.backgroundMaterialId;
          break;
        case "region": {
          const r = s.regions.find((x) => x.id === selection.id)!;
          r.name = values.name;
          r.materialId = values.materialId;
          break;
        }
        case "water":
          break;
        case "material": {
          const m = p.materials.find((x) => x.id === selection.id)!;
          m.name = values.name;
          m.color = values.color;
          m.gamma = number("gamma", "Peso específico", true);
          m.cohesion = number("cohesion", "Coesão", true);
          m.friction = number("friction", "Atrito", true);
          m.mode = values.mode as "effective" | "total";
          m.source = values.source;
          break;
        }
        case "load": {
          const l = s.loads.find((x) => x.id === selection.id)!;
          l.name = values.name;
          l.x1 = number("x1", "X inicial")!;
          l.x2 = number("x2", "X final")!;
          l.q = number("q", "Sobrecarga")!;
          break;
        }
        case "circle":
          s.circle = {
            x: number("x", "Centro X")!,
            y: number("y", "Centro Y")!,
            radius: number("radius", "Raio")!,
          };
          break;
      }
      const parsed = projectSchema.safeParse(p);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((i) => `${String(i.path.at(-1))}: ${i.message}`)
            .join(" · "),
        );
      const before = new Set(
        diagnose(project)
          .filter((d) => d.level === "error")
          .map((d) => `${d.target}:${d.message}`),
      );
      const added = diagnose(p).find(
        (d) => d.level === "error" && !before.has(`${d.target}:${d.message}`),
      );
      if (added) throw new Error(added.message);
      setDirty(false);
      onDirty(false);
      onApply(parsed.data);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const showCoordinates = ["terrain", "region", "water"].includes(
    selection.kind,
  );
  if (!source && selection.kind !== "water")
    return (
      <aside className="inspector">
        <div className="panel-heading">PROPRIEDADES</div>
        <p className="hint padded">
          Selecione um elemento no desenho ou na árvore.
        </p>
      </aside>
    );
  return (
    <aside className="inspector" aria-label="Propriedades">
      <div className="panel-heading">
        <span>PROPRIEDADES</span>
        {dirty && <span className="draft-badge">Em edição</span>}
      </div>
      <form
        className="inspector-form"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="inspector-fields">
          <h2>{labels[selection.kind]}</h2>
          {["project", "section", "region", "material", "load"].includes(
            selection.kind,
          ) && field("name", "Nome")}
          {selection.kind === "project" && (
            <>
              {field("author", "Responsável")}
              {field("description", "Descrição", { textarea: true })}
              <div className="info-card">
                Comprimentos em m · forças em kN · tensões em kPa. Os materiais
                são compartilhados entre as seções.
              </div>
            </>
          )}
          {["section", "terrain"].includes(selection.kind) && (
            <>
              {field("base", "Cota da base (m)", {
                number: true,
                hint: "Abaixo de todos os pontos do terreno.",
              })}
              {materialSelect("backgroundMaterialId", "Solo de fundo")}
              <p className="hint">
                O solo de fundo preenche o domínio fora das regiões desenhadas.
              </p>
            </>
          )}
          {selection.kind === "region" &&
            materialSelect("materialId", "Material da região")}
          {selection.kind === "material" && (
            <>
              {field("color", "Cor", { type: "color" })}
              {field("gamma", "Peso específico total γ (kN/m³)", {
                number: true,
              })}
              <div className="field-row">
                {field("cohesion", "Coesão c (kPa)", { number: true })}
                {field("friction", "Atrito φ (°)", { number: true })}
              </div>
              <label className="field">
                <span>Parâmetros de resistência</span>
                <select
                  value={values.mode}
                  onChange={(e) => change("mode", e.target.value)}
                >
                  <option value="effective">Tensões efetivas — c′, φ′</option>
                  <option value="total">Tensões totais — c, φ</option>
                </select>
              </label>
              {field("source", "Origem dos parâmetros", {
                textarea: true,
                hint: "Investigação, ensaio, referência ou hipótese adotada.",
              })}
              <p className="hint">
                Campos vazios ficam identificados como pendentes. Esta versão
                não calcula resistência ou fator de segurança.
              </p>
            </>
          )}
          {selection.kind === "load" && (
            <>
              <div className="field-row">
                {field("x1", "X inicial (m)", { number: true })}
                {field("x2", "X final (m)", { number: true })}
              </div>
              {field("q", "Sobrecarga q (kPa)", {
                number: true,
                hint: "Vertical, descendente, uniforme na projeção horizontal. Faixas sobrepostas serão somadas pelo futuro motor.",
              })}
            </>
          )}
          {selection.kind === "circle" && (
            <>
              <div className="field-row">
                {field("x", "Centro X (m)", { number: true })}
                {field("y", "Centro Y (m)", { number: true })}
              </div>
              {field("radius", "Raio (m)", { number: true })}
              <div className="info-card">
                Círculo geométrico de tentativa. Ainda não foi verificado quanto
                à admissibilidade ou estabilidade.
              </div>
            </>
          )}
          {selection.kind === "water" && (
            <p className="hint">
              Carga piezométrica prescrita. A linha não representa uma análise
              de fluxo nem água externa.
            </p>
          )}
          {showCoordinates && (
            <>
              <div className="field-heading">
                Coordenadas <span>m</span>
              </div>
              <div className="coordinate-table">
                <div className="coordinate-head">
                  <span>#</span>
                  <span>X</span>
                  <span>Z</span>
                  <span />
                </div>
                {coordinates.map((row, i) => (
                  <div className="coordinate-row" key={i}>
                    <span>{i + 1}</span>
                    {row.map((value, k) => (
                      <input
                        key={k}
                        aria-label={`${k === 0 ? "X" : "Z"} do ponto ${i + 1}`}
                        inputMode="decimal"
                        value={value}
                        onChange={(e) =>
                          editCoordinates(
                            coordinates.map((r, j) =>
                              j === i
                                ? r.map((v, l) =>
                                    l === k ? e.target.value : v,
                                  )
                                : r,
                            ),
                          )
                        }
                      />
                    ))}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remover ponto ${i + 1}`}
                      onClick={() => {
                        editCoordinates(coordinates.filter((_, j) => i !== j));
                        setOriginalRows((rows) =>
                          rows.filter((_, j) => i !== j),
                        );
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="text-button"
                type="button"
                disabled={coordinates.length >= 500}
                onClick={() => {
                  editCoordinates([...coordinates, ["", ""]]);
                  setOriginalRows((rows) => [...rows, null]);
                }}
              >
                <Plus size={14} />
                Adicionar ponto
              </button>
              <details className="coordinate-paste">
                <summary>Colar lista de coordenadas</summary>
                <p className="hint">
                  Uma linha por ponto: X ; Z. A lista substitui o contorno;
                  vínculos entre vértices antigos e novos não são inferidos.
                  Aceita tabulação e vírgula decimal.
                </p>
                <textarea
                  aria-label="Lista de coordenadas"
                  placeholder={"0 ; 20\n15 ; 20\n30 ; 8\n50 ; 8"}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  rows={5}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    try {
                      const parsed = parseCoordinates(paste);
                      setOriginalRows(parsed.map(() => null));
                      editCoordinates(
                        parsed.map((pt) => [String(pt.x), String(pt.y)]),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Usar coordenadas
                </button>
              </details>
            </>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="inspector-actions">
          <button
            type="button"
            className="secondary"
            disabled={!dirty}
            onClick={reset}
          >
            <RotateCcw size={14} />
            Descartar
          </button>
          <button type="submit" className="primary" disabled={!dirty}>
            <Check size={14} />
            Aplicar
          </button>
        </div>
      </form>
    </aside>
  );
}
