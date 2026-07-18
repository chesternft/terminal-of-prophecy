/**
 * The terminal's state, as a reducer.
 *
 * Lines are append-only and carry their own ids, so React never has to key on
 * an index and a typewriter mid-animation never gets re-keyed onto a different
 * line. `busy` gates input during a scan -- a terminal that queues commands
 * while it is thinking will run them in an order nobody predicted.
 */

import { useCallback, useReducer } from "react";

import type { Line, LineKind } from "./types";

export interface TerminalState {
  lines: Line[];
  busy: boolean;
  /** Previously entered commands, newest last. */
  history: string[];
  phosphor: "green" | "amber";
  address: string | null;
}

export type TerminalAction =
  | { type: "print"; lines: { kind: LineKind; text: string; typed?: boolean }[] }
  | { type: "clear" }
  | { type: "busy"; value: boolean }
  | { type: "remember"; input: string }
  | { type: "phosphor"; value: "green" | "amber" }
  | { type: "address"; value: string | null };

/** Ids must be unique for the life of the page, not the life of the array. */
let nextId = 0;
export const resetLineIds = () => {
  nextId = 0;
};

export const initialTerminal: TerminalState = {
  lines: [],
  busy: false,
  history: [],
  phosphor: "green",
  address: null,
};

/** Beyond this, the DOM gets heavy and nobody is scrolling up there anyway. */
const MAX_LINES = 400;

export function terminalReducer(
  state: TerminalState,
  action: TerminalAction,
): TerminalState {
  switch (action.type) {
    case "print": {
      const printed = action.lines.map((line) => ({ ...line, id: nextId++ }));
      const lines = [...state.lines, ...printed];
      return { ...state, lines: lines.slice(-MAX_LINES) };
    }
    case "clear":
      return { ...state, lines: [] };
    case "busy":
      return { ...state, busy: action.value };
    case "remember": {
      // Do not stack duplicates: holding up-arrow through ten identical
      // commands is nobody's idea of history.
      if (state.history[state.history.length - 1] === action.input) return state;
      return { ...state, history: [...state.history, action.input].slice(-50) };
    }
    case "phosphor":
      return { ...state, phosphor: action.value };
    case "address":
      return { ...state, address: action.value };
    default:
      return state;
  }
}

export function useTerminal() {
  const [state, dispatch] = useReducer(terminalReducer, initialTerminal);

  const print = useCallback(
    (lines: { kind: LineKind; text: string; typed?: boolean }[]) =>
      dispatch({ type: "print", lines }),
    [],
  );

  const printLine = useCallback(
    (text: string, kind: LineKind = "output", typed = false) =>
      dispatch({ type: "print", lines: [{ kind, text, typed }] }),
    [],
  );

  return { state, dispatch, print, printLine };
}
