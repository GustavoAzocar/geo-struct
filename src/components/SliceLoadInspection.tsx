import { useState } from "react";
import type { SliceLoadPreparation } from "../core/slice-loads";

const number = (n: number) =>
  n.toLocaleString("pt-BR", {
    maximumSignificantDigits: 8,
    notation: n !== 0 && Math.abs(n) < 1e-6 ? "scientific" : "standard",
  });
const oriented = (n: number | null) =>
  n === null ? "Sentido pendente" : number(n);

export function SliceLoadInspection({
  result,
}: {
  result: SliceLoadPreparation;
}) {
  const [selected, setSelected] = useState(0);
  const loads = result.status === "prepared" ? result.loads : null;
  const slice = loads?.slices[selected] ?? loads?.slices[0];
  const strips = new Map(loads?.strips.map((l) => [l.id, l]));
  return (
    <details className="slice-load-inspection">
      <summary>Sobrecargas por fatia</summary>
      <p>
        Q = q × largura horizontal carregada. Força vertical descendente no
        centro do trecho carregado, por metro fora do plano. Faixas sobrepostas
        são somadas, mantendo suas origens.
      </p>
      {result.status === "blocked" && (
        <>
          <p>
            Sobrecargas não preparadas; geometria, pesos e pressões disponíveis
            podem ser consultados.
          </p>
          <ul aria-label="Diagnósticos das sobrecargas">
            {result.diagnostics.map((d, i) => (
              <li key={i}>{d.message}</li>
            ))}
          </ul>
        </>
      )}
      {loads && slice && (
        <>
          <p aria-label="Condição de sobrecargas na inspeção">
            <strong>
              {loads.condition === "none"
                ? "Sem sobrecargas por escolha explícita"
                : "Faixas ativas do caso"}
            </strong>
            .{" "}
            {loads.selection === "section"
              ? "Condição herdada da seção."
              : "Condição própria do caso."}
          </p>
          <p aria-label="Convenção dos momentos">
            Coordenadas X/Z originais. Centro do círculo: (
            {number(loads.circleCenter.x)}; {number(loads.circleCenter.z)}) m.{" "}
            CCW positivo = anti-horário. Braço d = xc − xq; momento M = Q × d.
            {loads.direction === null
              ? " Sentido não definido: apenas momentos CCW disponíveis."
              : ` Momento no sentido do movimento: positivo ${loads.direction === "left-to-right" ? "anti-horário (esquerda → direita)" : "horário (direita → esquerda)"}.`}
          </p>
          <p aria-label="Resumo das sobrecargas na inspeção">
            Resultante descendente:{" "}
            <strong>{number(loads.forceKNPerM)} kN/m</strong>. Momento CCW:{" "}
            {number(loads.momentCCWKNmPerM)} kN·m/m.
            {loads.momentDrivingKNmPerM !== null && (
              <>
                {" "}
                Momento no sentido do movimento:{" "}
                {number(loads.momentDrivingKNmPerM)} kN·m/m.
              </>
            )}
          </p>
          {loads.strips.length > 0 && (
            <div className="materials-table-wrap slice-table-wrap">
              <table
                className="materials-table"
                aria-label="Totais por faixa de sobrecarga"
              >
                <thead>
                  <tr>
                    <th>Faixa / origem</th>
                    <th>Intervalo cadastrado (m)</th>
                    <th>q (kPa)</th>
                    <th>Largura na massa (m)</th>
                    <th>Q (kN/m)</th>
                    <th>M CCW (kN·m/m)</th>
                    <th>M no sentido (kN·m/m)</th>
                  </tr>
                </thead>
                <tbody>
                  {loads.strips.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong>{l.name}</strong>
                        <small>ID: {l.id}</small>
                        <small>
                          Origem: {l.source.trim() || "não informada"}
                        </small>
                      </td>
                      <td>
                        {number(l.x1)} a {number(l.x2)}
                      </td>
                      <td>
                        {l.intensityKPa === null
                          ? "Não informada"
                          : number(l.intensityKPa)}
                      </td>
                      <td>
                        {number(l.loadedWidthM)}
                        {l.loadedWidthM === 0 && (
                          <small>Fora da massa / contato sem largura</small>
                        )}
                      </td>
                      <td>{number(l.forceKNPerM)}</td>
                      <td>{number(l.momentCCWKNmPerM)}</td>
                      <td>{oriented(l.momentDrivingKNmPerM)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <label className="field">
            <span>Conferir contribuições de uma fatia</span>
            <select
              aria-label="Fatia para inspecionar sobrecargas"
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {loads.slices.map((s, i) => (
                <option key={s.number} value={i}>
                  Fatia {s.number} · {number(s.forceKNPerM)} kN/m
                </option>
              ))}
            </select>
          </label>
          <div
            className="info-card"
            aria-label="Sobrecargas da fatia selecionada"
          >
            <p>
              Fatia {slice.number} · Q = {number(slice.forceKNPerM)} kN/m · M
              CCW = {number(slice.momentCCWKNmPerM)} kN·m/m.
            </p>
            {slice.contributions.length === 0 && (
              <p>Sem trecho carregado nesta fatia.</p>
            )}
          </div>
          {slice.contributions.length > 0 && (
            <div className="materials-table-wrap slice-table-wrap">
              <table
                className="materials-table"
                aria-label="Contribuições de sobrecarga da fatia"
              >
                <thead>
                  <tr>
                    <th>Faixa / origem</th>
                    <th>q (kPa)</th>
                    <th>Trecho carregado (m)</th>
                    <th>L (m)</th>
                    <th>X aplicação (m)</th>
                    <th>Z terreno (m)</th>
                    <th>Q (kN/m)</th>
                    <th>d CCW (m)</th>
                    <th>M CCW (kN·m/m)</th>
                    <th>d no sentido (m)</th>
                    <th>M no sentido (kN·m/m)</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.contributions.map((c) => {
                    const l = strips.get(c.loadId)!;
                    return (
                      <tr key={c.loadId}>
                        <td>
                          <strong>{l.name}</strong>
                          <small>ID: {l.id}</small>
                          <small>
                            Origem: {l.source.trim() || "não informada"}
                          </small>
                        </td>
                        <td>{number(l.intensityKPa!)}</td>
                        <td>
                          {number(c.leftX)} a {number(c.rightX)}
                        </td>
                        <td>{number(c.widthM)}</td>
                        <td>{number(c.applicationPoint.x)}</td>
                        <td>{number(c.applicationPoint.z)}</td>
                        <td>{number(c.forceKNPerM)}</td>
                        <td>{number(c.armCCWM)}</td>
                        <td>{number(c.momentCCWKNmPerM)}</td>
                        <td>{oriented(c.armDrivingM)}</td>
                        <td>{oriented(c.momentDrivingKNmPerM)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="materials-table-wrap slice-table-wrap">
            <table
              className="materials-table"
              aria-label="Resultantes de sobrecarga por fatia"
            >
              <thead>
                <tr>
                  <th>Fatia</th>
                  <th>Faixas com trecho carregado</th>
                  <th>Q (kN/m)</th>
                  <th>M CCW (kN·m/m)</th>
                  <th>M no sentido (kN·m/m)</th>
                </tr>
              </thead>
              <tbody>
                {loads.slices.map((s) => (
                  <tr key={s.number}>
                    <td>{s.number}</td>
                    <td>{s.contributions.length}</td>
                    <td>{number(s.forceKNPerM)}</td>
                    <td>{number(s.momentCCWKNmPerM)}</td>
                    <td>{oriented(s.momentDrivingKNmPerM)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="hint">
        Momento nulo não elimina a força. Parcelas com sinais opostos são
        preservadas. Preparação isolada das sobrecargas, sem equações de
        equilíbrio ou FS.
      </p>
    </details>
  );
}
