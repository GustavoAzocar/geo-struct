import type { Immutable } from "./input";

/** Congela somente objetos construídos pelo núcleo, nunca o projeto do editor. */
export function freeze<T>(value: T): Immutable<T> {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value as Immutable<T>;
}
