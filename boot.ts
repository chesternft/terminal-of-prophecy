/**
 * The boot sequence.
 *
 * Data, not markup, so the terminal renders it through the same path as
 * everything else and the whole thing is one list to edit.
 *
 * The disclaimer is a boot line rather than a footer or a modal. Nobody reads
 * footers and everybody dismisses modals, but a line in the boot sequence gets
 * read once by everyone, in character, without asking for a click. It is the
 * only honest place to put it.
 */

import type { LineKind } from "./types";

export interface BootLine {
  kind: LineKind;
  text: string;
  /** Milliseconds to wait before printing this line. */
  delay: number;
}

export const BOOT_SEQUENCE: BootLine[] = [
  { kind: "dim", text: "PROPHECY BIOS v2.6.1", delay: 120 },
  { kind: "dim", text: "Copyright (c) 07.2026 PROPHECY TEAM", delay: 40 },
  { kind: "dim", text: "", delay: 30 },
  { kind: "dim", text: "Memory test .......... 65536 KB OK", delay: 200 },
  { kind: "dim", text: "Detecting oracle ..... FOUND", delay: 180 },
  { kind: "dim", text: "Chain interface ...... READY", delay: 140 },
  { kind: "dim", text: "Fate module .......... UNSTABLE", delay: 160 },
  { kind: "dim", text: "", delay: 80 },
  { kind: "system", text: "  ╔══════════════════════════════════════════╗", delay: 60 },
  { kind: "system", text: "  ║      T E R M I N A L   O F              ║", delay: 20 },
  { kind: "system", text: "  ║              P R O P H E C Y            ║", delay: 20 },
  { kind: "system", text: "  ╚══════════════════════════════════════════╝", delay: 20 },
  { kind: "dim", text: "", delay: 60 },
  { kind: "output", text: "  Ask the chain. Receive your fate.", delay: 200 },
  { kind: "dim", text: "", delay: 40 },
  {
    kind: "error",
    text: "  ENTERTAINMENT ONLY. NOT FINANCIAL ADVICE.",
    delay: 260,
  },
  {
    kind: "dim",
    text: "  The oracle reads public history. It does not know the future.",
    delay: 60,
  },
  { kind: "dim", text: "", delay: 60 },
  { kind: "output", text: "  Type /help for commands, or paste a wallet address.", delay: 220 },
  { kind: "dim", text: "", delay: 40 },
];
