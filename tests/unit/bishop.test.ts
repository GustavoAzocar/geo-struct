import { describe, expect, it } from "vitest";
import {
  solveBishop,
  MAX_BISHOP_ITERATIONS,
  type BishopProfile,
} from "../../src/core/bishop";
import { solveFellenius } from "../../src/core/fellenius";
import { serializeProject } from "../../src/domain/model";
import { fixture, prepare, manual, load, copy } from "../fixtures/equilibrium";

const profile: BishopProfile = {
  initialFactor: 1.4,
  residualTolerance: 1e-12,
  maxIterations: 100,
  singularityThreshold: 0,
  drivingThresholdKNPerM: 1e-8,
  tensionToleranceKPa: 0,
};
const evaluate = (b = manual(), p = profile) =>
  solveBishop(b.input, b.mechanics, p);
const codes = (r: ReturnType<typeof evaluate>) =>
  r.diagnostics.map((d) => d.code);
function bishopFixture() {
  const p = fixture();
  p.materials[0].cohesion = 0;
  return p;
}
const run = (p = bishopFixture(), angle = 3) => evaluate(prepare(p, angle));
function reference() {
  // Duncan 2014, fig. 7.40 p. 157: transcrição da candidata #30, sem reconstrução geométrica.
  const rows = [
    [36659, 20, 43.2, 0, 38],
    [215174, 35.2, 40.2, 1450, 20],
    [683527, 65, 35, 2392, 20],
    [894190, 62.5, 28.7, 3449, 20],
    [1406585, 89.9, 21.7, 3741, 20],
    [1648280, 105.7, 13.1, 2131, 20],
    [315386, 21.2, 7.7, 719, 20],
    [1055716, 81.8, 3.4, 805, 38],
    [867907, 114.7, -4.8, 452, 38],
    [98993, 49.8, -11.7, 0, 38],
  ];
  const ft = 0.3048,
    lbf = 0.0044482216152605;
  const force = lbf / ft;
  const b = manual(
    rows.map(([w, width, angle, u]) => ({
      w: w * force,
      length: (width * ft) / Math.cos((angle * Math.PI) / 180),
      angle,
      u: (u * lbf) / (ft * ft),
    })),
    0,
    20,
  );
  b.mechanics.mechanics.slices.forEach((s, i) => {
    const phi = rows[i][4];
    Object.assign(s.baseMaterial, {
      frictionDegrees: phi,
      frictionRadians: (phi * Math.PI) / 180,
      tanPhi: Math.tan((phi * Math.PI) / 180),
    });
  });
  return { b, force };
}

describe("Bishop: referências independentes e equilíbrio", () => {
  it.each([-5, 0, 5])(
    "raiz analítica de uma fatia com braço próprio x=%s",
    (x) => {
      const b = manual();
      load(b, x);
      const r = evaluate(b),
        D = 50 - 1.5 * x;
      // F = (a − D sinα tanφ)/(D cosα), solução algébrica independente da iteração.
      const a = 5 * Math.sqrt(3) + (115 - 10 * Math.sqrt(3)) / Math.sqrt(3);
      const expected =
        (a - (D * 0.5) / Math.sqrt(3)) / ((D * Math.sqrt(3)) / 2);
      expect(r.status).toBe("calculated");
      expect(r.calculation!.drivingKNPerM).toBeCloseTo(D, 12);
      expect(r.factorOfSafety).toBeCloseTo(expected, 11);
      const ev = r.calculation!.evaluation!,
        row = ev.slices[0],
        input = row.input;
      expect(ev.trialFactor).toBe(r.factorOfSafety);
      expect(ev.residual).toBe(Math.abs(ev.updatedFactor! - r.factorOfSafety!));
      expect(ev.residual!).toBeLessThanOrEqual(profile.residualTolerance);
      // Equilíbrio vertical local e resistência mobilizada no próprio F retornado.
      const shear = row.resistanceKNPerM! / r.factorOfSafety!;
      expect(
        row.totalNormalKNPerM! * input.cosAlpha + shear * input.sinAlpha,
      ).toBeCloseTo(115, 10);
      expect(row.resistanceKNPerM).toBeCloseTo(row.reducedResistanceKNPerM, 11);
      expect(shear).toBeCloseTo(D, 9);
      expect(row.normalForResistanceKNPerM).toBeCloseTo(
        row.totalNormalKNPerM! - 20,
        11,
      );
    },
  );
  it("dez fatias publicadas: numerador, raiz, cinco avaliações e resíduo", () => {
    const { b, force } = reference();
    const first = evaluate(b, {
      ...profile,
      initialFactor: 1.6,
      maxIterations: 1,
    });
    expect(first.calculation!.drivingKNPerM / force).toBeCloseTo(1891280.56, 3);
    expect(first.iterations[0].numeratorKNPerM! / force).toBeCloseTo(
      3049723.278,
      3,
    );
    expect(first.status).toBe("nonconverged");
    const r = evaluate(b, {
      ...profile,
      residualTolerance: 1e-6,
      maxIterations: 20,
    });
    expect(r.status).toBe("calculated");
    expect(r.iterations).toHaveLength(5);
    expect(r.factorOfSafety).toBeCloseTo(1.613020984, 9);
    expect(r.iterations[4].residual).toBeCloseTo(5.06e-7, 9);
    expect(r.factorOfSafety).not.toBe(r.iterations[4].updatedFactor);
    expect(Math.abs(r.factorOfSafety! - 1.61)).toBeLessThan(0.005);
    expect(evaluate(b).factorOfSafety).toBeCloseTo(1.613022, 6);
    expect(
      r.calculation!.evaluation!.slices.at(-1)!.weightDrivingKNPerM,
    ).toBeLessThan(0);
  });
  it("φ=0, F exato em uma avaliação e igualdade com Fellenius quando admissível", () => {
    const b = manual(undefined, 5, 0),
      r = evaluate(b, { ...profile, initialFactor: 0.2, maxIterations: 1 });
    expect(r.status).toBe("calculated");
    expect(r.iterations).toHaveLength(1);
    expect(r.factorOfSafety).toBe(0.2);
    expect(r.factorOfSafety).toBeCloseTo(
      solveFellenius(b.input, b.mechanics, profile).factorOfSafety!,
      12,
    );
  });
  it("modo total usa ue=0 e conserva a água física", () => {
    const b = manual(),
      s = b.mechanics.mechanics.slices[0];
    s.baseMaterial.mode = "total";
    s.water.usedPressureKPa = 0;
    const r = evaluate(b),
      dry = manual([{ w: 100, length: 2, angle: 30, u: 0 }]);
    expect(r.status).toBe("calculated");
    expect(r.factorOfSafety).toBe(evaluate(dry).factorOfSafety);
    expect(
      r.calculation!.evaluation!.slices[0].input.water.prescribed.pressureKPa,
    ).toBe(10);
  });
});

describe("Bishop: trajetória, limites e falhas", () => {
  it("aceita no limite do resíduo e de K; não devolve a atualização não avaliada", () => {
    const b = manual(),
      first = evaluate(b, { ...profile, maxIterations: 1 });
    expect(first.status).toBe("nonconverged");
    expect(first.factorOfSafety).toBeNull();
    const residual = first.iterations[0].residual!;
    const r = evaluate(b, {
      ...profile,
      maxIterations: 1,
      residualTolerance: residual,
    });
    expect(r.factorOfSafety).toBe(profile.initialFactor);
    expect(r.calculation!.evaluation!.trialFactor).toBe(profile.initialFactor);
    expect(
      evaluate(b, {
        ...profile,
        maxIterations: 1,
        residualTolerance: residual - 1e-12,
      }).status,
    ).toBe("nonconverged");
    const full = evaluate(b),
      k = full.iterations.length;
    expect(evaluate(b, { ...profile, maxIterations: k }).status).toBe(
      "calculated",
    );
    expect(evaluate(b, { ...profile, maxIterations: k - 1 }).status).toBe(
      "nonconverged",
    );
  });
  it("singularidade é local à trajetória e identifica fatia/avaliação/valor", () => {
    const { b } = reference();
    const r = evaluate(b, { ...profile, initialFactor: 0.01 });
    expect(codes(r)).toContain("singular-iteration");
    expect(r.diagnostics.at(-1)).toMatchObject({
      iteration: 1,
      sliceNumber: 9,
    });
    expect(r.factorOfSafety).toBeNull();
    expect(r.iterations[0].updatedFactor).toBeNull();
    expect(evaluate(b).status).toBe("calculated");
    const m = evaluate(manual(), { ...profile, maxIterations: 1 }).iterations[0]
      .minM!;
    expect(
      codes(evaluate(manual(), { ...profile, singularityThreshold: m })),
    ).toContain("singular-iteration");
  });
  it("não rejeita tração transitória; verifica a normal na solução convergida", () => {
    const b = manual(undefined, 100, 0);
    // F0 pequeno dá N negativo. Na raiz F=4, N é positivo.
    const r = evaluate(b, { ...profile, initialFactor: 0.1 });
    expect(r.status).toBe("calculated");
    expect(r.factorOfSafety).toBeCloseTo(4, 12);
    expect(codes(r)).not.toContain("base-tension");
  });
  it("tração convergida tem limiar próprio e não depende do resultado de Fellenius", () => {
    // Em φ=0: N_B=(100−u√3−25)/cos30; Fellenius N=(100−u√3)cos30.
    const b = manual([{ w: 100, length: 2, angle: 30, u: 50 }], 5, 0);
    expect(solveFellenius(b.input, b.mechanics, profile).status).toBe(
      "calculated",
    );
    const r = evaluate(b);
    expect(codes(r)).toContain("base-tension");
    expect(r.factorOfSafety).toBeNull();
    const tolerance = -r.calculation!.evaluation!.slices[0].normalStressKPa!;
    const accepted = evaluate(b, {
      ...profile,
      tensionToleranceKPa: tolerance,
    });
    expect(accepted.status).toBe("calculated");
    expect(codes(accepted)).toContain("tolerated-tension");
    expect(accepted.calculation!.evaluation!.slices[0].normalStressKPa).toBe(
      -tolerance,
    );
    expect(
      evaluate(b, { ...profile, tensionToleranceKPa: tolerance - 1e-10 })
        .factorOfSafety,
    ).toBeNull();
  });
  it("resistência física nula não itera F=0; cancelamento não recebe esse estado", () => {
    const zero = evaluate(manual(undefined, 0, 0));
    expect(zero.status).toBe("zero-resistance");
    expect(zero.factorOfSafety).toBeNull();
    expect(zero.iterations).toEqual([]);
    const negative = evaluate(
      manual([{ w: 1, length: 2, angle: 30, u: 10 }], 0, 30),
    );
    expect(codes(negative)).toContain("nonpositive-update");
    expect(codes(negative)).not.toContain("zero-resistance");
    expect(negative.factorOfSafety).toBeNull();
  });
  it("atualização exatamente zero por cancelamento não é resistência física nula", () => {
    const b = manual(
      [{ w: 20 * Math.cos(Math.PI / 6), length: 2, angle: 30, u: 10 }],
      0,
      30,
    );
    const r = evaluate(b);
    expect(r.iterations[0].updatedFactor).toBe(0);
    expect(codes(r)).toContain("nonpositive-update");
    expect(r.status).toBe("rejected");
    expect(r.factorOfSafety).toBeNull();
  });
  it.each([
    { initialFactor: 0 },
    { initialFactor: -1 },
    { initialFactor: Infinity },
    { residualTolerance: 0 },
    { residualTolerance: NaN },
    { residualTolerance: -1 },
    { maxIterations: 0 },
    { maxIterations: 1.5 },
    { maxIterations: MAX_BISHOP_ITERATIONS + 1 },
    { maxIterations: Infinity },
    { singularityThreshold: -1 },
    { singularityThreshold: NaN },
    { drivingThresholdKNPerM: -1 },
    { tensionToleranceKPa: Infinity },
  ])("recusa perfil explícito inválido %j", (change) => {
    const r = evaluate(manual(), { ...profile, ...change });
    expect(codes(r)).toContain("invalid-profile");
    expect(r.iterations).toEqual([]);
    expect(r.factorOfSafety).toBeNull();
  });
  it("overflow, underflow e m não finito não produzem FS", () => {
    for (const r of [
      evaluate(manual(undefined, Number.MAX_VALUE, 30)),
      evaluate(
        manual(
          [{ w: 1, length: 1e-100, angle: 30, u: 0 }],
          Number.MIN_VALUE,
          30,
        ),
      ),
      evaluate(manual(), { ...profile, initialFactor: Number.MIN_VALUE }),
    ]) {
      expect(codes(r)).toContain("numerical-error");
      expect(r.factorOfSafety).toBeNull();
    }
  });
  it("D nulo, negativo, no limiar ou indistinguível de cancelamento bloqueia antes de iterar", () => {
    for (const angle of [0, -30])
      expect(
        codes(evaluate(manual([{ w: 100, length: 2, angle, u: 0 }]))),
      ).toContain("invalid-driving");
    const b = manual(),
      D = evaluate(b).calculation!.drivingKNPerM;
    expect(
      codes(evaluate(b, { ...profile, drivingThresholdKNPerM: D })),
    ).toContain("invalid-driving");
    const cancellation = manual([
      { w: 100, length: 2, angle: 30, u: 0 },
      { w: 100 - 1e-13, length: 2, angle: -30, u: 0 },
    ]);
    const r = evaluate(cancellation, { ...profile, drivingThresholdKNPerM: 0 });
    expect(codes(r)).toContain("unresolved-driving");
    expect(r.iterations).toEqual([]);
  });
  it("Bishop sozinho, revisões, modo misto, face vertical e coerência mecânica", () => {
    const p = bishopFixture();
    p.analysisCases[0].methods = ["bishop"];
    expect(run(p).status).toBe("calculated");
    const b = prepare(p);
    b.mechanics.inputRevision = "outra";
    expect(codes(evaluate(b))).toContain("stale-mechanics");
    b.mechanics.inputRevision = b.input.snapshot.revision;
    b.mechanics.mechanics.slices[0].baseMaterial.mode = "total";
    expect(codes(evaluate(b))).toContain("mixed-modes");
    const vertical = prepare();
    vertical.input.snapshot.input.geometry.terrain.splice(
      1,
      0,
      { x: 0, z: 1 },
      { x: 0, z: 0 },
    );
    expect(codes(evaluate(vertical))).toContain("vertical-face");
    const inconsistent = manual();
    load(inconsistent, -5);
    inconsistent.mechanics.mechanics.slices[0].surcharge.contributions[0].momentDrivingKNmPerM = 1;
    expect(codes(evaluate(inconsistent))).toContain("invalid-load");
    const unselected = fixture();
    unselected.analysisCases[0].methods = ["fellenius"];
    expect(codes(run(unselected))).toContain("method-unavailable");
  });
});

describe("Bishop: preparação completa", () => {
  it("refinamento e espelhamento/translação conservam a solução do caso próprio", () => {
    const p = bishopFixture(),
      values = [3, 1.5, 0.75, 0.375].map(
        (angle) => run(p, angle).factorOfSafety!,
      );
    expect(values.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
    expect(Math.abs(values[3] - values[2])).toBeLessThan(
      Math.abs(values[1] - values[0]),
    );
    expect(Math.abs(values[3] - values[0])).toBeLessThan(0.005);
    const mirrored = copy(p);
    mirrored.sections[0].terrain = mirrored.sections[0].terrain
      .map((v) => ({ x: -v.x, y: v.y }))
      .reverse();
    mirrored.analysisCases[0].direction = "right-to-left";
    expect(run(mirrored).factorOfSafety).toBeCloseTo(values[0], 10);
    for (const v of p.sections[0].terrain) {
      v.x += 10000;
      v.y += 5000;
    }
    p.sections[0].base += 5000;
    p.analysisCases[0].fixedCircle.x! += 10000;
    p.analysisCases[0].fixedCircle.y! += 5000;
    expect(run(p).factorOfSafety).toBeCloseTo(values[0], 8);
  });
  it("água reduz FS efetivo, normal total permanece rastreável; arquivo e chamador intactos", () => {
    const p = bishopFixture(),
      dry = run(p).factorOfSafety!;
    Object.assign(p.sections[0], {
      waterMode: "piezometric",
      waterUnitWeight: 10,
      water: [
        { x: -10, y: 4 },
        { x: 10, y: -6 },
      ],
    });
    const before = serializeProject(p),
      b = prepare(p),
      r = evaluate(b);
    expect(r.status).toBe("calculated");
    expect(r.factorOfSafety!).toBeLessThan(dry);
    expect(Object.isFrozen(r.iterations)).toBe(true);
    expect(Object.isFrozen(r.calculation!.evaluation!.slices)).toBe(true);
    expect(Object.isFrozen(b.mechanics)).toBe(false);
    const w = r.calculation!.evaluation!.slices[0].input.weight.weightKNPerM;
    b.mechanics.mechanics.slices[0].weight.weightKNPerM = 99;
    expect(r.calculation!.evaluation!.slices[0].input.weight.weightKNPerM).toBe(
      w,
    );
    expect(serializeProject(p)).toBe(before);
  });
});
