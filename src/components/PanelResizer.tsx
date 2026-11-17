import type { CSSProperties } from "react";
export function PanelResizer({
  label,
  value,
  onChange,
  min,
  max,
  reverse = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  reverse?: boolean;
}) {
  const limit = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div
      className="panel-resizer"
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      style={{ touchAction: "none" } as CSSProperties}
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          onChange(
            limit(
              value +
                (e.key === "ArrowRight" ? 1 : -1) * (reverse ? -1 : 1) * 10,
            ),
          );
        }
      }}
      onPointerDown={(e) => {
        const start = e.clientX,
          initial = value;
        e.currentTarget.setPointerCapture(e.pointerId);
        const el = e.currentTarget;
        const move = (ev: PointerEvent) =>
          onChange(limit(initial + (ev.clientX - start) * (reverse ? -1 : 1)));
        const end = () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", end);
          el.removeEventListener("pointercancel", end);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", end);
        el.addEventListener("pointercancel", end);
      }}
    />
  );
}
