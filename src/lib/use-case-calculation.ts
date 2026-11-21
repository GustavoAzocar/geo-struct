import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CircularSearchResult,
  SearchProgress,
} from "../core/circular-search";
import type { CaseCalculationReadiness } from "./case-calculation";
import {
  createCaseExecution,
  type CaseExecution,
  type CaseExecutionState,
} from "./case-execution";

export type SearchRunState =
  | { status: "idle" }
  | { status: "running" | "cancelled"; progress: SearchProgress }
  | { status: "failed"; message: string }
  | {
      status: "completed";
      result: Extract<CircularSearchResult, { status: "completed" }>;
    };
export type SearchExecutionControls = {
  state: SearchRunState;
  start: () => void;
  cancel: () => void;
  reset: () => void;
};
const idle = { status: "idle" } as const;

/** Estado de sessão compartilhado pela Ribbon e pelas inspeções do caso. */
export function useCaseCalculation(readiness: CaseCalculationReadiness) {
  const [stored, setStored] = useState<CaseExecutionState>(idle);
  const executor = useRef<CaseExecution | null>(null);
  const current = useRef(readiness);
  const identity = readiness.status === "ready" ? readiness.identityKey : null;
  const currentKey = useRef(identity);
  // O guard fica atualizado já no render, antes de callbacks de Workers antigos.
  current.current = readiness;
  currentKey.current = identity;
  useEffect(() => {
    const task = createCaseExecution({
      onChange: setStored,
      currentKey: () => currentKey.current,
    });
    executor.current = task;
    return () => {
      task.dispose();
      if (executor.current === task) executor.current = null;
    };
  }, []);
  useEffect(() => {
    executor.current?.reset();
  }, [identity]);

  const start = useCallback(() => {
    const ready = current.current;
    if (ready.status === "ready") executor.current?.start(ready);
  }, []);
  const cancel = useCallback(() => executor.current?.cancel(), []);
  const reset = useCallback(() => executor.current?.reset(), []);
  // Nunca publicar dados de outra revisão enquanto o efeito de reset é agendado.
  const state =
    stored.status !== "idle" && stored.identityKey === identity ? stored : idle;
  const search = useMemo<SearchRunState>(() => {
    if (state.status === "idle" || state.mode !== "search") return idle;
    if (state.status === "completed")
      return { status: "completed", result: state.search };
    if (state.status === "failed")
      return { status: "failed", message: state.message };
    return { status: state.status, progress: state.progress };
  }, [state]);
  const searchExecution = useMemo<SearchExecutionControls>(
    () => ({ state: search, start, cancel, reset }),
    [search, start, cancel, reset],
  );
  const fixed =
    state.status === "completed" && state.mode === "fixed" ? state.fixed : null;
  return { state, fixed, start, cancel, reset, searchExecution };
}
