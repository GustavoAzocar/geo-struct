import { useEffect, useRef, useState } from "react";
import {
  Maximize,
  MousePointer2,
  Hand,
  Plus,
  Minus,
  Check,
  X,
} from "lucide-react";
import type { Point, Project, Section, Selection, Tool } from "../domain/model";
import { boundary, distance, elevation } from "../domain/geometry";

export type Visibility = {
  materials: boolean;
  water: boolean;
  loads: boolean;
  circle: boolean;
};
const path = (pts: Point[], close = false) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") +
  (close ? " Z" : "");
const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export const instructions: Record<Tool, string> = {
  select: "Selecione um elemento. Arraste os vértices para editar.",
  pan: "Arraste para mover a vista. Use a roda para ampliar.",
  terrain:
    "Marque o terreno da esquerda para a direita. Enter conclui · Esc cancela.",
  region: "Marque o contorno da região. Enter fecha · Esc cancela.",
  water:
    "Marque a linha piezométrica da esquerda para a direita. Enter conclui.",
  load: "Clique no início e no fim da faixa. Depois informe a sobrecarga nas propriedades.",
  circle: "Clique no centro e em um ponto do círculo para definir o raio.",
};
export function ModelCanvas({
  project,
  section,
  selection,
  tool,
  dark,
  grid,
  snap,
  visibility,
  fitToken,
  onSelect,
  onDraw,
  onVertex,
  onTool,
  onCursor,
  onDrawing,
  onCancel,
  exportRef,
}: {
  project: Project;
  section: Section;
  selection: Selection;
  tool: Tool;
  dark: boolean;
  grid: boolean;
  snap: boolean;
  visibility: Visibility;
  fitToken: number;
  onSelect: (s: Selection) => void;
  onDraw: (t: Tool, p: Point[]) => void;
  onVertex: (index: number, p: Point) => void;
  onTool: (t: Tool) => void;
  onCursor: (p: Point) => void;
  onDrawing: (b: boolean) => void;
  onCancel: () => void;
  exportRef: React.RefObject<SVGSVGElement | null>;
}) {
  const host = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState({ x: 65, y: 430, z: 10 });
  const [points, setPoints] = useState<Point[]>([]),
    [cursor, setCursor] = useState<Point | null>(null),
    [dragged, setDragged] = useState<{ index: number; p: Point } | null>(null);
  const operation = useRef<
    | { type: "pan"; x: number; y: number; vx: number; vy: number }
    | { type: "vertex"; index: number; last: Point }
    | null
  >(null);
  const space = useRef(false);
  useEffect(() => {
    if (!host.current) return;
    const obs = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    obs.observe(host.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    exportRef.current = svg.current;
    return () => {
      exportRef.current = null;
    };
  }, [exportRef]);
  useEffect(() => {
    setPoints([]);
    setDragged(null);
    operation.current = null;
  }, [tool, section.id]);
  useEffect(() => {
    onDrawing(points.length > 0);
  }, [points.length, onDrawing]);
  const fit = () => {
    const pts = boundary(section);
    if (!pts.length) {
      setView({
        x: 60,
        y: size.h - 60,
        z: Math.max(2, Math.min((size.w - 120) / 60, (size.h - 120) / 30)),
      });
      return;
    }
    const xmin = Math.min(...pts.map((p) => p.x)),
      xmax = Math.max(...pts.map((p) => p.x)),
      ymin = Math.min(...pts.map((p) => p.y)),
      ymax = Math.max(...pts.map((p) => p.y));
    const z = Math.max(
      0.00001,
      Math.min(
        (size.w - 130) / Math.max(xmax - xmin, 1),
        (size.h - 170) / Math.max(ymax - ymin, 1),
      ),
    );
    setView({
      x: (size.w - z * (xmax - xmin)) / 2 - z * xmin,
      y: (size.h + z * (ymax - ymin)) / 2 + z * ymin + 15,
      z,
    });
  };
  useEffect(fit, [section.id, fitToken, size.w, size.h]);
  const zoom = (factor: number, px = size.w / 2, py = size.h / 2) =>
    setView((v) => {
      const z = Math.max(0.00001, Math.min(100000, v.z * factor));
      const f = z / v.z;
      return { z, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left,
        py = e.clientY - r.top,
        factor = Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.002);
      setView((v) => {
        const z = Math.max(0.00001, Math.min(100000, v.z * factor));
        const f = z / v.z;
        return { z, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const selectedPoints =
    selection.kind === "terrain"
      ? section.terrain
      : selection.kind === "water"
        ? (section.water ?? [])
        : selection.kind === "region"
          ? (section.regions.find((r) => r.id === selection.id)?.points ?? [])
          : [];
  const shownPoints = dragged
    ? selectedPoints.map((p, i) => (i === dragged.index ? dragged.p : p))
    : selectedPoints;
  const selectedTerrain =
    selection.kind === "terrain" && dragged ? shownPoints : section.terrain;
  const boundaryPoints = boundary({ ...section, terrain: selectedTerrain });
  const world = (e: { clientX: number; clientY: number }): Point => {
    const rect = host.current!.getBoundingClientRect();
    let p = {
      x: (e.clientX - rect.left - view.x) / view.z,
      y: (view.y - e.clientY + rect.top) / view.z,
    };
    if (snap) {
      const candidates = [
        ...section.terrain,
        ...section.regions.flatMap((r) => r.points),
        ...(section.water ?? []),
        ...points,
      ];
      const nearest = candidates
        .filter(
          (pt) =>
            !(
              operation.current?.type === "vertex" &&
              selectedPoints[operation.current.index] === pt
            ),
        )
        .sort((a, b) => distance(a, p) - distance(b, p))[0];
      if (nearest && distance(nearest, p) * view.z < 10) p = nearest;
      else p = { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 };
    }
    return p;
  };
  const finish = () => {
    if (points.length < (tool === "region" ? 3 : 2)) return;
    onDraw(tool, points);
  };
  const cancel = () => {
    operation.current = null;
    setDragged(null);
    setPoints([]);
    onCancel();
  };
  const label = (
    p: Point,
    text: string,
    color = "#493b2d",
    anchor: "start" | "middle" | "end" = "start",
    dy = 0,
  ) => (
    <text
      transform={`translate(${p.x} ${p.y}) scale(${1 / view.z} ${-1 / view.z})`}
      fill={color}
      fontSize={11}
      fontFamily="Inter Variable, sans-serif"
      textAnchor={anchor}
      dy={dy}
      style={{ pointerEvents: "none" }}
    >
      {text}
    </text>
  );
  const isSelected = (kind: Selection["kind"], id?: string) =>
    selection.kind === kind &&
    (!id || ("id" in selection && selection.id === id));
  const screenWorld = (x: number, y: number) => ({
    x: (x - view.x) / view.z,
    y: (view.y - y) / view.z,
  });
  const min = screenWorld(0, size.h),
    max = screenWorld(size.w, 0);
  const rough = 80 / view.z;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const tick = [1, 2, 5, 10].map((n) => n * mag).find((n) => n >= rough)!;
  const xs = Array.from(
    {
      length: Math.min(150, Math.max(0, Math.ceil((max.x - min.x) / tick) + 1)),
    },
    (_, i) => (Math.ceil(min.x / tick) + i) * tick,
  );
  const ys = Array.from(
    {
      length: Math.min(150, Math.max(0, Math.ceil((max.y - min.y) / tick) + 1)),
    },
    (_, i) => (Math.ceil(min.y / tick) + i) * tick,
  );
  const ground = project.materials.find(
    (m) => m.id === section.backgroundMaterialId,
  );
  return (
    <div
      className={`model-canvas tool-${tool}`}
      ref={host}
      tabIndex={0}
      role="region"
      aria-label="Editor da seção 2D"
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget && e.target !== svg.current) return;
        if (e.key === " ") {
          space.current = true;
          e.preventDefault();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          finish();
        }
        if (e.key === "Backspace" && points.length) {
          e.preventDefault();
          setPoints((p) => p.slice(0, -1));
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " ") space.current = false;
      }}
      onBlur={() => {
        space.current = false;
      }}
    >
      <svg
        ref={svg}
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.w} ${size.h}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`Desenho de ${section.name}`}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          host.current?.focus();
          if (e.button === 2) {
            if (points.length) setPoints((p) => p.slice(0, -1));
            return;
          }
          const p = world(e);
          if (e.button === 1 || tool === "pan" || space.current) {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            operation.current = {
              type: "pan",
              x: e.clientX,
              y: e.clientY,
              vx: view.x,
              vy: view.y,
            };
            return;
          }
          if (tool === "select") {
            const vertex = (e.target as Element).closest("[data-vertex]");
            if (vertex) {
              const index = Number(vertex.getAttribute("data-vertex"));
              operation.current = {
                type: "vertex",
                index,
                last: selectedPoints[index],
              };
              setDragged({ index, p: selectedPoints[index] });
              e.currentTarget.setPointerCapture(e.pointerId);
              return;
            }
            const hit = (e.target as Element).closest("[data-pick]");
            if (hit) {
              const kind = hit.getAttribute("data-pick")! as Selection["kind"],
                id = hit.getAttribute("data-id");
              onSelect((id ? { kind, id } : { kind }) as Selection);
            }
            return;
          }
          if (points.length >= 500) return;
          if (e.detail > 1) return;
          const next = [...points, p];
          if ((tool === "circle" || tool === "load") && next.length === 2) {
            onDraw(tool, next);
            return;
          }
          if (points.length && distance(points.at(-1)!, p) < 1e-7) return;
          setPoints(next);
        }}
        onPointerMove={(e) => {
          const op = operation.current;
          const p = world(e);
          setCursor(p);
          onCursor(p);
          if (op?.type === "pan") {
            setView((v) => ({
              ...v,
              x: op.vx + e.clientX - op.x,
              y: op.vy + e.clientY - op.y,
            }));
          } else if (op?.type === "vertex") {
            op.last = p;
            setDragged({ index: op.index, p });
          }
        }}
        onPointerUp={(e) => {
          const op = operation.current;
          operation.current = null;
          if (op?.type === "vertex") {
            onVertex(op.index, op.last);
            setDragged(null);
          }
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          operation.current = null;
          setDragged(null);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          finish();
        }}
      >
        <rect width="100%" height="100%" fill={dark ? "#1e2327" : "#fafaf7"} />
        {grid && (
          <g stroke={dark ? "#343a3d" : "#e9e8e2"} strokeWidth={1}>
            {xs.map((x) => (
              <line
                key={x}
                x1={view.x + x * view.z}
                y1={0}
                x2={view.x + x * view.z}
                y2={size.h}
              />
            ))}
            {ys.map((y) => (
              <line
                key={y}
                x1={0}
                y1={view.y - y * view.z}
                x2={size.w}
                y2={view.y - y * view.z}
              />
            ))}
          </g>
        )}
        <g
          transform={`translate(${view.x} ${view.y}) scale(${view.z} ${-view.z})`}
        >
          {boundaryPoints.length > 0 && (
            <path
              data-pick="terrain"
              d={path(boundaryPoints, true)}
              fill={
                visibility.materials
                  ? (ground?.color ?? "#d1b28a")
                  : dark
                    ? "#303436"
                    : "#ecebe5"
              }
              stroke="#776b58"
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {section.regions.map((r) => {
            const pts =
              selection.kind === "region" && selection.id === r.id && dragged
                ? shownPoints
                : r.points;
            return (
              <path
                key={r.id}
                data-pick="region"
                data-id={r.id}
                d={path(pts, true)}
                fill={
                  visibility.materials
                    ? (project.materials.find((m) => m.id === r.materialId)
                        ?.color ?? "#ddd")
                    : "transparent"
                }
                fillOpacity={0.95}
                stroke={isSelected("region", r.id) ? "#b85e2a" : "#776b58"}
                strokeWidth={isSelected("region", r.id) ? 2.4 : 1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {selectedTerrain.length > 0 && (
            <>
              <path
                data-pick="terrain"
                d={path(selectedTerrain)}
                fill="none"
                stroke={
                  isSelected("terrain")
                    ? "#b85e2a"
                    : dark
                      ? "#eee4d3"
                      : "#4c4234"
                }
                strokeWidth={isSelected("terrain") ? 3 : 2}
                vectorEffect="non-scaling-stroke"
              />
              <path
                data-pick="terrain"
                d={path(selectedTerrain)}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          {visibility.water && section.water && (
            <>
              <path
                data-pick="water"
                d={path(
                  selection.kind === "water" && dragged
                    ? shownPoints
                    : section.water,
                )}
                fill="none"
                stroke="#267aa4"
                strokeDasharray="10 4 2 4"
                strokeWidth={isSelected("water") ? 2.5 : 1.8}
                vectorEffect="non-scaling-stroke"
              />
              <path
                data-pick="water"
                d={path(section.water)}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                vectorEffect="non-scaling-stroke"
              />
              {section.water.length > 0 &&
                label(section.water.at(-1)!, "  LP", "#267aa4")}
            </>
          )}
          {visibility.loads &&
            section.loads.map((l) => {
              const a = elevation(section.terrain, l.x1),
                b = elevation(section.terrain, l.x2);
              if (a === null || b === null) return null;
              const top =
                Math.max(
                  a,
                  b,
                  ...section.terrain
                    .filter((p) => p.x > l.x1 && p.x < l.x2)
                    .map((p) => p.y),
                ) + 3;
              const count = Math.min(
                25,
                Math.max(2, Math.ceil(((l.x2 - l.x1) * view.z) / 22)),
              );
              return (
                <g
                  key={l.id}
                  data-pick="load"
                  data-id={l.id}
                  stroke={isSelected("load", l.id) ? "#b85e2a" : "#a24c38"}
                  strokeWidth={isSelected("load", l.id) ? 2.4 : 1.4}
                >
                  <path
                    d={`M${l.x1} ${top} H${l.x2}`}
                    vectorEffect="non-scaling-stroke"
                  />
                  {Array.from({ length: count + 1 }, (_, i) => {
                    const x = l.x1 + (i * (l.x2 - l.x1)) / count,
                      y = elevation(section.terrain, x)!;
                    return (
                      <path
                        key={i}
                        d={`M${x} ${top} V${y + 0.25} m${-3.5 / view.z} ${7 / view.z} l${3.5 / view.z} ${-7 / view.z} l${3.5 / view.z} ${7 / view.z}`}
                        fill="none"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  <path
                    d={`M${l.x1} ${top} H${l.x2}`}
                    stroke="transparent"
                    strokeWidth={15}
                    vectorEffect="non-scaling-stroke"
                  />
                  {label(
                    { x: (l.x1 + l.x2) / 2, y: top },
                    `${fmt(l.q)} kPa`,
                    "#a24c38",
                    "middle",
                    -9,
                  )}
                </g>
              );
            })}
          {visibility.circle && section.circle && (
            <g data-pick="circle">
              <circle
                cx={section.circle.x}
                cy={section.circle.y}
                r={section.circle.radius}
                fill="none"
                stroke="#7f70a4"
                strokeWidth={isSelected("circle") ? 2.5 : 1.6}
                strokeDasharray="8 5"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={section.circle.x}
                cy={section.circle.y}
                r={section.circle.radius}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                vectorEffect="non-scaling-stroke"
              />
              {label(section.circle, "+ C", "#7f70a4")}
            </g>
          )}
          {tool === "select" &&
            shownPoints.map((p, i) => (
              <g key={i}>
                <circle
                  data-vertex={i}
                  cx={p.x}
                  cy={p.y}
                  r={5 / view.z}
                  fill="#fff"
                  stroke="#a45730"
                  strokeWidth={1.7}
                  vectorEffect="non-scaling-stroke"
                />
                {label(
                  { x: p.x + 8 / view.z, y: p.y + 8 / view.z },
                  `${i + 1}`,
                  dark ? "#fff1d9" : "#573c28",
                )}
              </g>
            ))}
          {points.length > 0 && (
            <g data-transient="true">
              <path
                d={path(
                  [...points, ...(cursor ? [cursor] : [])],
                  tool === "region" && points.length > 1,
                )}
                stroke="#ab582e"
                fill={tool === "region" ? "#ab582e22" : "none"}
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
              {tool === "circle" && cursor && (
                <circle
                  cx={points[0].x}
                  cy={points[0].y}
                  r={distance(points[0], cursor)}
                  fill="none"
                  stroke="#7f70a4"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={4 / view.z}
                  fill="#ab582e"
                />
              ))}
            </g>
          )}
        </g>
        <g
          fill={dark ? "#a6afb6" : "#8b8a80"}
          fontFamily="Inter Variable, sans-serif"
          fontSize={10}
        >
          {xs.map((x) => (
            <text
              key={x}
              x={view.x + x * view.z}
              y={size.h - 9}
              textAnchor="middle"
            >
              {fmt(x)}
            </text>
          ))}
          {ys.map((y) => (
            <text key={y} x={9} y={view.y - y * view.z - 4}>
              {fmt(y)}
            </text>
          ))}
          <text x={size.w - 32} y={size.h - 27}>
            X (m)
          </text>
          <text x={8} y={18}>
            Z (m)
          </text>
        </g>
      </svg>
      <div className="canvas-label">
        <span className="section-tag">SEÇÃO 2D</span>
        <strong>{section.name}</strong>
        <span>
          {section.terrain.length
            ? "Modelo geométrico"
            : "Defina o perfil do terreno para começar"}
        </span>
      </div>
      <div className="canvas-controls">
        <button
          className={`icon-button ${tool === "select" ? "active" : ""}`}
          aria-label="Selecionar no desenho"
          title="Selecionar · V"
          onClick={() => onTool("select")}
        >
          <MousePointer2 size={17} />
        </button>
        <button
          className={`icon-button ${tool === "pan" ? "active" : ""}`}
          aria-label="Mover vista"
          title="Pan · H"
          onClick={() => onTool("pan")}
        >
          <Hand size={17} />
        </button>
        <span />
        <button
          className="icon-button"
          aria-label="Ampliar"
          onClick={() => zoom(1.25)}
        >
          <Plus size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Reduzir"
          onClick={() => zoom(0.8)}
        >
          <Minus size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Enquadrar seção"
          title="Enquadrar · F"
          onClick={fit}
        >
          <Maximize size={17} />
        </button>
      </div>
      {points.length > 0 && (
        <div className="drawing-actions">
          <span>{points.length} pontos</span>
          {!["load", "circle"].includes(tool) && (
            <button
              className="primary"
              disabled={points.length < (tool === "region" ? 3 : 2)}
              onClick={finish}
            >
              <Check size={15} />
              Concluir
            </button>
          )}
          <button className="secondary" onClick={cancel}>
            <X size={15} />
            Cancelar
          </button>
        </div>
      )}
      {section.terrain.length === 0 && points.length === 0 && (
        <div className="empty-canvas">
          <MountainIcon />
          <h2>Desenhe sua primeira seção</h2>
          <p>
            Trace o perfil do terreno ou informe suas coordenadas no painel à
            direita.
          </p>
          <button className="primary" onClick={() => onTool("terrain")}>
            Desenhar terreno
          </button>
        </div>
      )}
    </div>
  );
}
function MountainIcon() {
  return (
    <svg
      width="70"
      height="42"
      viewBox="0 0 70 42"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 36H18L35 12H48L69 36M1 41H69"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M10 36L24 28H49L60 36" stroke="currentColor" opacity=".4" />
    </svg>
  );
}
