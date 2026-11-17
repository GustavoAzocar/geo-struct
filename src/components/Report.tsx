import {
  activeWater,
  waterModeLabel,
  loadConditionLabel,
  isLoadActive,
} from "../domain/conditions";
import type { Project } from "../domain/model";
import {
  materialMode,
  materialName,
  materialPending,
  materialUses,
} from "../domain/materials";
import { diagnose, boundary } from "../domain/geometry";
import { exportText, safeName } from "../lib/files";
const number = (n: number | null) =>
  n === null
    ? "Não informado"
    : n.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
export function Report({
  project,
  onError,
}: {
  project: Project;
  onError: (s: string) => void;
}) {
  const diagnostics = diagnose(project);
  return (
    <>
      <div className="report-actions no-print">
        <button className="secondary" onClick={() => window.print()}>
          Imprimir / PDF
        </button>
        <button
          className="primary"
          onClick={async () => {
            try {
              const content =
                document.getElementById("project-report")!.outerHTML;
              await exportText(
                `${safeName(project.name)}-entradas.html`,
                `<!doctype html><html lang="pt-BR"><meta charset="UTF-8"><title>GeoStruct · Relatório de entradas</title><style>body{font:14px system-ui;max-width:1000px;margin:40px auto;padding:20px;color:#302d28}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}svg{width:100%;height:280px}h2{margin-top:32px}section{break-inside:avoid}p{line-height:1.6}</style><body>${content}</body></html>`,
                "text/html",
              );
            } catch (e) {
              onError((e as Error).message);
            }
          }}
        >
          Exportar HTML
        </button>
      </div>
      <article id="project-report" className="project-report">
        <div className="report-brand">OPENSTRUCT / GEOSTRUCT 0.1.0</div>
        <h1>{project.name}</h1>
        <p>
          Relatório de dados de entrada ·{" "}
          {new Date().toLocaleDateString("pt-BR")}
        </p>
        <p>Responsável: {project.author || "Não informado"}</p>
        {project.description && <p>{project.description}</p>}
        <p>
          <strong>Etapa de modelagem.</strong> Este documento não contém cálculo
          de fator de segurança, dimensionamento de contenções ou aprovação de
          estabilidade. Unidades: m, kN, kPa.
        </p>
        <h2>Materiais</h2>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>γ (kN/m³)</th>
              <th>c / c′ (kPa)</th>
              <th>φ / φ′ (°)</th>
              <th>Parâmetros</th>
              <th>Cadastro / uso</th>
            </tr>
          </thead>
          <tbody>
            {project.materials.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{number(m.gamma)}</td>
                <td>{number(m.cohesion)}</td>
                <td>{number(m.friction)}</td>
                <td>{materialMode(m.mode)}</td>
                <td>
                  {materialPending(m).length
                    ? `Falta: ${materialPending(m).join(", ")}.`
                    : "Dados preenchidos."}{" "}
                  {materialUses(project, m.id).length} atribuições.
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {project.materials.map((m) => (
          <p key={m.id}>
            <strong>{m.name} — origem:</strong>{" "}
            {m.source.trim() || "Não informada"}
          </p>
        ))}
        {project.sections.map((s) => {
          const water = activeWater(s);
          const pts = boundary(s),
            xmin = Math.min(...pts.map((p) => p.x)),
            xmax = Math.max(...pts.map((p) => p.x)),
            ymin = Math.min(...pts.map((p) => p.y)),
            ymax = Math.max(...pts.map((p) => p.y));
          const d = (points: typeof pts) =>
            points.map((p) => `${p.x},${-p.y}`).join(" ");
          return (
            <section key={s.id}>
              <h2>{s.name}</h2>
              <p>
                Base: {number(s.base)} m · Solo de fundo:{" "}
                {materialName(project, s.backgroundMaterialId)}
              </p>
              {pts.length > 0 && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox={`${xmin - 2} ${-ymax - 2} ${xmax - xmin + 4} ${ymax - ymin + 4}`}
                  role="img"
                  aria-label={`Seção ${s.name}`}
                >
                  <polygon
                    points={d(pts)}
                    fill={
                      project.materials.find(
                        (m) => m.id === s.backgroundMaterialId,
                      )?.color ?? "#a4a7a9"
                    }
                    stroke="#675d50"
                    strokeWidth="0.1"
                  />
                  {s.regions.map((r) => (
                    <polygon
                      key={r.id}
                      points={d(r.points)}
                      fill={
                        project.materials.find((m) => m.id === r.materialId)
                          ?.color ?? "#a4a7a9"
                      }
                      stroke="#675d50"
                      strokeWidth="0.1"
                    />
                  ))}
                  {water && (
                    <polyline
                      points={d(water)}
                      fill="none"
                      stroke="#277ca7"
                      strokeWidth="0.15"
                      strokeDasharray="0.6 0.3"
                    />
                  )}
                </svg>
              )}
              <h3>Terreno · X ; Z (m)</h3>
              <p>
                {s.terrain
                  .map((p) => `(${number(p.x)} ; ${number(p.y)})`)
                  .join(" · ") || "Não definido"}
              </p>
              {s.regions.map((r) => (
                <div key={r.id}>
                  <h3>
                    {r.name} · {materialName(project, r.materialId)}
                  </h3>
                  <p>
                    {r.points
                      .map((p) => `(${number(p.x)} ; ${number(p.y)})`)
                      .join(" · ")}
                  </p>
                </div>
              ))}
              <h3>Água · {waterModeLabel(s.waterMode)}</h3>
              <p>
                Peso específico da água γw: {number(s.waterUnitWeight)} kN/m³
                {s.waterMode !== "piezometric" ? " (guardado, inativo)" : ""}.
                Origem da condição: {s.waterSource.trim() || "Não informada"}.
              </p>
              {s.water && s.waterMode !== "piezometric" && (
                <p>Linha guardada, inativa na condição atual:</p>
              )}
              <p>
                {s.water
                  ? s.water
                      .map((p) => `(${number(p.x)} ; ${number(p.y)})`)
                      .join(" · ")
                  : "Sem linha piezométrica prescrita."}
              </p>
              <h3>Sobrecargas verticais uniformes</h3>
              <p>
                Condição: {loadConditionLabel(s.loadCondition)}. Intensidades na
                projeção horizontal.
              </p>
              {s.loads.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>X inicial (m)</th>
                      <th>X final (m)</th>
                      <th>q (kPa)</th>
                      <th>Estado</th>
                      <th>Origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.loads.map((l) => (
                      <tr key={l.id}>
                        <td>{l.name}</td>
                        <td>{number(l.x1)}</td>
                        <td>{number(l.x2)}</td>
                        <td>{number(l.q)}</td>
                        <td>
                          {isLoadActive(s, l) ? "Ativa" : "Inativa"}
                          {!l.enabled ? " — desabilitada" : ""}
                        </td>
                        <td>{l.source.trim() || "Não informada"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>Nenhuma faixa cadastrada.</p>
              )}
              {s.circle && (
                <p>
                  Círculo de tentativa: centro ({number(s.circle.x)} ;{" "}
                  {number(s.circle.y)}) m; raio {number(s.circle.radius)} m.
                  Admissibilidade não verificada.
                </p>
              )}
            </section>
          );
        })}
        <h2>Conferência da modelagem</h2>
        {diagnostics.length ? (
          <ul>
            {diagnostics.map((d, i) => (
              <li key={i}>
                {d.level === "error"
                  ? "Erro"
                  : d.level === "info"
                    ? "Informação"
                    : "Aviso"}
                : {d.message}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Nenhuma inconsistência detectada pelas verificações de modelagem
            implementadas. Isso não constitui validação de engenharia.
          </p>
        )}
        <p>
          Formato geostruct/{project.version} · Projeto {project.id}
        </p>
      </article>
    </>
  );
}
