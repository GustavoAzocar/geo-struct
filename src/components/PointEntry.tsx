import { useState } from "react";
import type { Point } from "../domain/model";
import { precisePoint } from "../domain/precision";

export function PointEntry({
  anchor,
  onPoint,
}: {
  anchor: Point | null;
  onPoint: (p: Point) => void;
}) {
  const [mode, setMode] = useState<"absolute" | "relative" | "polar">(
    "absolute",
  );
  const [first, setFirst] = useState(""),
    [second, setSecond] = useState(""),
    [error, setError] = useState("");
  return (
    <details className="point-entry">
      <summary>Entrada precisa</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onPoint(precisePoint(first, second, mode, anchor));
            setError("");
            setFirst("");
            setSecond("");
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <label>
          Entrada
          <select
            aria-label="Tipo de coordenadas"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="absolute">X / Z</option>
            <option value="relative">ΔX / ΔZ</option>
            <option value="polar">Distância / ângulo</option>
          </select>
        </label>
        <label>
          {mode === "absolute"
            ? "X (m)"
            : mode === "relative"
              ? "ΔX (m)"
              : "Distância (m)"}
          <input
            aria-label="Primeira coordenada"
            inputMode="decimal"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
        </label>
        <label>
          {mode === "absolute"
            ? "Z (m)"
            : mode === "relative"
              ? "ΔZ (m)"
              : "Ângulo (°)"}
          <input
            aria-label="Segunda coordenada"
            inputMode="decimal"
            value={second}
            onChange={(e) => setSecond(e.target.value)}
          />
        </label>
        <button className="secondary" type="submit">
          Adicionar ponto
        </button>
        <small>
          Ângulo a partir de +X, positivo para cima. A entrada numérica preserva
          os valores digitados.
        </small>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
