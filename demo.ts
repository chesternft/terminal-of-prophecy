/**
 * A deterministic fake wallet, derived from an address.
 *
 * This exists so the repository runs. Clone it, `npm run dev`, and you get a
 * working terminal with no API keys, no explorer account, and no network. A
 * project whose demo is a blank screen until you have registered for two
 * services is a project nobody evaluates.
 *
 * It is seeded from the address, so the same address always produces the same
 * history. That makes the offline mode feel like a real lookup rather than a
 * slot machine, and it makes the tests deterministic without mocking anything.
 */

import type { ChainId, NormalizedWallet, Tx } from "./types";

const DAY = 86_400;

/** FNV-1a. Small, fast, and good enough to spread addresses across seeds. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Mulberry32: a tiny seeded PRNG.
 *
 * `Math.random()` cannot be seeded, which would make the demo wallet different
 * on every render and the tests unwritable.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoOptions {
  chain?: ChainId;
  /** Unix seconds. Injected so generated histories are stable in tests. */
  now?: number;
}

/**
 * Build a plausible history for an address.
 *
 * The shape of the wallet -- how old, how busy, how nocturnal -- is drawn from
 * the seed, so different addresses produce genuinely different archetypes
 * rather than the same wallet with different numbers.
 */
export function demoWallet(address: string, options: DemoOptions = {}): NormalizedWallet {
  const chain = options.chain ?? (address.startsWith("0x") ? "ethereum" : "solana");
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const rand = mulberry32(hashSeed(address));

  const ageDays = Math.floor(20 + rand() * 1600);
  const txCount = Math.floor(8 + rand() * 120);
  const nocturnal = rand();
  const clumsiness = rand() * 0.3;
  const restless = rand();

  const start = now - ageDays * DAY;
  const txs: Tx[] = [];

  for (let i = 0; i < txCount; i += 1) {
    // Bias timestamps toward the recent end for restless wallets, and spread
    // them evenly for patient ones.
    const skew = restless > 0.5 ? Math.pow(rand(), 0.5) : rand();
    const timestamp = Math.floor(start + skew * (now - start));

    const hour = rand() < nocturnal ? Math.floor(rand() * 5) : 6 + Math.floor(rand() * 18);
    const dated = new Date(timestamp * 1000);
    dated.setUTCHours(hour, Math.floor(rand() * 60), 0, 0);

    const outgoing = rand() > 0.45;
    txs.push({
      hash: `0x${(hashSeed(address + i) >>> 0).toString(16).padStart(8, "0")}${i.toString(16).padStart(4, "0")}`,
      timestamp: Math.floor(dated.getTime() / 1000),
      direction: outgoing ? "out" : "in",
      value: Number((rand() * rand() * 12).toFixed(6)),
      fee: outgoing ? Number((0.0008 + rand() * rand() * 0.06).toFixed(6)) : 0,
      counterparty: `0x${(hashSeed(address + (i % 5)) >>> 0).toString(16).padStart(40, "0").slice(0, 40)}`,
      failed: rand() < clumsiness,
    });
  }

  txs.sort((a, b) => b.timestamp - a.timestamp);

  return {
    address,
    chain,
    balance: Number((rand() * 40).toFixed(4)),
    txs,
    simulated: true,
  };
}
