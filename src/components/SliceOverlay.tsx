import type { FixedCircleGeometry } from "../core/fixed-circle";

/** Desenho da geometria preparada; não participa dos cálculos de área. */
export function SliceOverlay({ geometry }: { geometry: FixedCircleGeometry }) {
  const radius = geometry.circle.radius;
  return (
    <g
      data-slice-preview="true"
      pointerEvents="none"
      stroke="#2e8194"
      fill="#39a0ad"
      fillOpacity={0.12}
    >
      {geometry.slices.map((slice) => {
        const l = slice.left,
          r = slice.right;
        // O grupo pai usa Z para cima; o caminho percorre a base de +X para −X.
        const d = `M${l.x} ${l.topZ} L${r.x} ${r.topZ} L${r.x} ${r.baseZ} A${radius} ${radius} 0 0 0 ${l.x} ${l.baseZ} Z`;
        return (
          <path
            key={slice.number}
            data-slice={slice.number}
            d={d}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}
