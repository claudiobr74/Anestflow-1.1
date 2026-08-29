/**
 * Shim mínimo de React só para `tsc -p tsconfig.lib.strict.json`.
 * O app ainda não instala @types/react: isso explode Intra/templates
 * (Fase 7A deixa intra/PDF/chart por último; strict global fica para depois).
 */
declare module "react" {
  export type ReactNode = unknown;
  export type DependencyList = readonly unknown[];
  export interface MutableRefObject<T> {
    current: T;
  }
  export type SetStateAction<S> = S | ((prev: S) => S);
  export function useState<S>(
    initial: S | (() => S)
  ): [S, (next: S | ((prev: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: DependencyList): void;
  export function useRef<T>(initial: T): MutableRefObject<T>;
  export function useCallback<T extends (...args: never[]) => unknown>(fn: T, deps: DependencyList): T;
}
