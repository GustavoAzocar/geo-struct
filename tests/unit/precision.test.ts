import { describe, expect, it } from "vitest";
import {
  measurePoints,
  precisePoint,
  snapPoint,
} from "../../src/domain/precision";

describe("Captura e precisão de entrada", () => {
  it("prioriza vértices, depois interseções, segmentos e grade", () => {
    const contours = [
      {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        closed: false,
      },
      {
        points: [
          { x: 0, y: 10 },
          { x: 10, y: 0 },
        ],
        closed: false,
      },
    ];
    expect(snapPoint({ x: 0.1, y: 0.2 }, contours, 0.5, 1)).toEqual({
      point: { x: 0, y: 0 },
      kind: "Vértice",
    });
    expect(snapPoint({ x: 5.1, y: 5.1 }, contours, 0.5, 1)).toEqual({
      point: { x: 5, y: 5 },
      kind: "Interseção",
    });
    expect(snapPoint({ x: 2.1, y: 1.9 }, contours, 0.5, 1)).toEqual({
      point: { x: 2, y: 2 },
      kind: "Segmento",
    });
    expect(snapPoint({ x: 3.1, y: 0.9 }, contours, 0.5, 0.25)).toEqual({
      point: { x: 3, y: 1 },
      kind: "Grade",
    });
  });
  it("captura a aresta de fechamento de uma região", () => {
    const contours = [
      {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        closed: true,
      },
    ];
    expect(snapPoint({ x: 4.1, y: 3.9 }, contours, 0.5, 1).point).toEqual({
      x: 4,
      y: 4,
    });
  });
  it("restrição ortogonal respeita a âncora mesmo fora da grade", () => {
    const anchor = { x: 0.3, y: 1.3 };
    expect(
      snapPoint({ x: 4.1, y: 1.5 }, [], 0.5, 1, anchor, true).point,
    ).toEqual({ x: 4, y: 1.3 });
    const contours = [
      {
        points: [
          { x: 4, y: 0 },
          { x: 4, y: 5 },
        ],
        closed: false,
      },
    ];
    expect(
      snapPoint({ x: 4.1, y: 1.5 }, contours, 0.5, 1, anchor, true),
    ).toEqual({ point: { x: 4, y: 1.3 }, kind: "Segmento" });
    expect(snapPoint({ x: 0.4, y: 4.2 }, [], 0, 0, anchor, true)).toEqual({
      point: { x: 0.3, y: 4.2 },
      kind: "Ortogonal",
    });
  });
  it("arraste não se prende ao vértice original nem às suas arestas incidentes", () => {
    const origin = { x: 0, y: 0 };
    const contours = [{ points: [origin, { x: 10, y: 0 }], closed: false }];
    expect(
      snapPoint({ x: 0.1, y: 0.1 }, contours, 1, 0, origin, false, origin),
    ).toEqual({ point: { x: 0.1, y: 0.1 }, kind: "Livre" });
  });
  it("segmentos paralelos ou coincidentes não criam coordenadas indefinidas", () => {
    const contours = [0, 0, 2].map((y) => ({
      points: [
        { x: 0, y },
        { x: 10, y },
      ],
      closed: false,
    }));
    expect(snapPoint({ x: 5, y: 0.1 }, contours, 0.5, 1)).toEqual({
      point: { x: 5, y: 0 },
      kind: "Segmento",
    });
  });
  it("aceita coordenadas absolutas, incrementos e distância/ângulo", () => {
    expect(precisePoint("1,25", "-3,4", "absolute", null)).toEqual({
      x: 1.25,
      y: -3.4,
    });
    const anchor = { x: 3, y: 4 };
    expect(precisePoint("-1", "2,5", "relative", anchor)).toEqual({
      x: 2,
      y: 6.5,
    });
    const p = precisePoint("5", "90", "polar", anchor);
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(9);
    expect(() => precisePoint("2", "3", "relative", null)).toThrow(
      /primeiro ponto/,
    );
    expect(() => precisePoint("0", "20", "polar", anchor)).toThrow(
      /maior que zero/,
    );
    expect(() => precisePoint("", "2", "absolute", null)).toThrow(
      /dois valores/,
    );
    expect(() => precisePoint("1000000", "0", "relative", anchor)).toThrow(
      /limite/,
    );
  });
  it("mede distância, desnível e ângulo sem alterar os pontos", () => {
    const a = { x: 1, y: 2 },
      b = { x: 4, y: 6 };
    expect(measurePoints(a, b)).toEqual({
      distance: 5,
      dx: 3,
      dz: 4,
      angle: (Math.atan2(4, 3) * 180) / Math.PI,
    });
    expect(a).toEqual({ x: 1, y: 2 });
  });
});
