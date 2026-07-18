/**
 * The offline oracle.
 *
 * When there is no API key, the terminal still has to say something, and that
 * something should be good enough that the demo sells the idea. So: templates,
 * seeded by the wallet, assembled from the archetype and the two metrics that
 * stood out most.
 *
 * The same rule governs this file as governs the system prompt in the API
 * route: it describes what a wallet *did*, in a portentous voice, and it never
 * predicts a price, names a token, or suggests a trade. The joke is the tone,
 * not the tip.
 */

import { mulberry32, hashSeed } from "./demo";
import type { Metric, WalletReport } from "./types";

const OPENINGS = [
  "The chain remembers.",
  "The ledger has been consulted.",
  "Your history has been read aloud to no one.",
  "The blocks were counted. They counted back.",
  "Something looked at your transactions for a long time.",
  "The record is unambiguous, which is the problem.",
];

const CLOSINGS = [
  "The chain has no advice. Only receipts.",
  "This is not counsel. It is commentary.",
  "Nothing here is a prediction. Everything here already happened.",
  "The oracle knows your past. Your future remains, regrettably, your own.",
  "Go in peace. Or don't. The ledger is indifferent.",
];

/** The two metrics furthest from the middle -- the wallet's loudest traits. */
export function standoutMetrics(metrics: Metric[], count = 2): Metric[] {
  return [...metrics]
    .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
    .slice(0, count);
}

/** Deterministic pick from a list, seeded by a string. */
export function pick<T>(items: T[], seed: string): T {
  const rand = mulberry32(hashSeed(seed));
  return items[Math.floor(rand() * items.length)];
}

/**
 * Compose a prophecy locally.
 *
 * Deterministic for a given address, so the offline mode reads as a lookup
 * rather than a random generator -- ask twice, get the same fate.
 */
export function composeProphecy(report: WalletReport): string {
  const seed = report.address;
  const standouts = standoutMetrics(report.metrics);

  const opening = pick(OPENINGS, seed + "open");
  const closing = pick(CLOSINGS, seed + "close");

  const observations = standouts
    .map((metric) => `It notes that this wallet ${metric.note}.`)
    .join(" ");

  return [
    opening,
    `You are ${report.archetype.title}. ${report.archetype.summary}`,
    observations,
    closing,
  ].join(" ");
}
