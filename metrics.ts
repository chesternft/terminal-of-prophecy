/**
 * What a wallet's history says about how it was used.
 *
 * Every function here is pure: same wallet in, same numbers out, no clock, no
 * network, no randomness. `now` is a parameter rather than a `Date.now()` call
 * for exactly that reason -- a metric that depends on the wall clock cannot be
 * tested, and wallet age depends on the wall clock, so the clock comes in
 * through the front door.
 *
 * A note on what these are *not*. None of them predicts anything. They describe
 * behaviour that already happened: when you traded, how much you burned, how
 * long you sat still. The prophecy layer is theatre built on top; this layer is
 * arithmetic, and it should stay arithmetic.
 */

import type { Archetype, Metric, NormalizedWallet, Tx, WalletReport } from "./types";
import { chainInfo } from "./chain";
import { formatAmount, formatDuration, hourLabel } from "./format";

const DAY = 86_400;

/** Oldest first. Callers must not assume the explorer sorted anything. */
export function chronological(txs: Tx[]): Tx[] {
  return [...txs].sort((a, b) => a.timestamp - b.timestamp);
}

export function firstSeen(txs: Tx[]): number | null {
  if (txs.length === 0) return null;
  return chronological(txs)[0].timestamp;
}

/** Whole days between the first transaction and `now`. */
export function walletAgeDays(txs: Tx[], now: number): number {
  const first = firstSeen(txs);
  if (first === null) return 0;
  return Math.max(0, (now - first) / DAY);
}

/**
 * Total fees paid.
 *
 * Failed transactions are included, and that is the point: the gas is gone
 * either way, and a wallet that burns ETH on reverts is telling you something a
 * wallet that burns it on fills is not.
 */
export function gasBurned(txs: Tx[]): number {
  return txs.reduce((sum, tx) => sum + (Number.isFinite(tx.fee) ? tx.fee : 0), 0);
}

/** Share of transactions that reverted, 0-1. */
export function failureRate(txs: Tx[]): number {
  if (txs.length === 0) return 0;
  return txs.filter((tx) => tx.failed).length / txs.length;
}

/**
 * Share of activity in the small hours, UTC, 0-1.
 *
 * UTC rather than local time, deliberately. The wallet does not have a
 * timezone, and guessing one from an address is worse than admitting the
 * readout is UTC.
 */
export function nightOwlShare(txs: Tx[], window: [number, number] = [0, 5]): number {
  if (txs.length === 0) return 0;
  const [start, end] = window;
  const owls = txs.filter((tx) => {
    const hour = new Date(tx.timestamp * 1000).getUTCHours();
    return hour >= start && hour < end;
  });
  return owls.length / txs.length;
}

/** The UTC hour this wallet is most active in. */
export function busiestHour(txs: Tx[]): number {
  const buckets = new Array<number>(24).fill(0);
  for (const tx of txs) {
    buckets[new Date(tx.timestamp * 1000).getUTCHours()] += 1;
  }
  let best = 0;
  for (let hour = 1; hour < 24; hour += 1) {
    if (buckets[hour] > buckets[best]) best = hour;
  }
  return best;
}

/** The longest stretch, in days, with no transactions at all. */
export function longestGapDays(txs: Tx[]): number {
  const sorted = chronological(txs);
  if (sorted.length < 2) return 0;
  let longest = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    longest = Math.max(longest, sorted[i].timestamp - sorted[i - 1].timestamp);
  }
  return longest / DAY;
}

/**
 * How long this wallet tends to sit on what it receives, in days.
 *
 * Pairs each inbound transaction with the next outbound one and takes the
 * median hold. The median, not the mean: one wallet that has held since 2017
 * would otherwise drag a churning account's average into diamond territory.
 *
 * This is a proxy and it is worth being honest about that. It does not track
 * assets, only sequence. A wallet that receives and sends unrelated things
 * looks like it is holding them.
 */
export function medianHoldDays(txs: Tx[]): number {
  const sorted = chronological(txs);
  const holds: number[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].direction !== "in") continue;
    const exit = sorted.slice(i + 1).find((tx) => tx.direction === "out");
    if (exit) holds.push((exit.timestamp - sorted[i].timestamp) / DAY);
  }

  if (holds.length === 0) return 0;
  holds.sort((a, b) => a - b);
  const mid = Math.floor(holds.length / 2);
  return holds.length % 2 === 0 ? (holds[mid - 1] + holds[mid]) / 2 : holds[mid];
}

/** The address this wallet has interacted with most, if there is one. */
export function favouriteCounterparty(txs: Tx[]): string | null {
  const counts = new Map<string, number>();
  for (const tx of txs) {
    if (!tx.counterparty) continue;
    counts.set(tx.counterparty, (counts.get(tx.counterparty) ?? 0) + 1);
  }
  let best: string | null = null;
  let most = 1; // A counterparty seen once is not a favourite.
  for (const [address, count] of counts) {
    if (count > most) {
      best = address;
      most = count;
    }
  }
  return best;
}

/** The largest single outflow. Not a loss -- we have no prices -- just the biggest. */
export function largestOutflow(txs: Tx[]): number {
  return txs
    .filter((tx) => tx.direction === "out" && !tx.failed)
    .reduce((max, tx) => Math.max(max, tx.value), 0);
}

/**
 * Map an unbounded quantity onto 0-100 with diminishing returns.
 *
 * Linear scaling needs a maximum, and every candidate maximum here is a lie:
 * there is no most-gas-anyone-could-burn. A saturating curve gives a wallet at
 * `soft` a score of 50 and approaches 100 without arriving.
 *
 * The result is capped at 99 rather than left to round. The curve genuinely
 * never reaches 100, but `Math.round` does not care about asymptotes, and a
 * wallet that scores a full 100 is claiming a maximum that does not exist for
 * an unbounded quantity. 99 says "more than anyone sensible"; 100 would say
 * "the most possible", which is not a thing that can be true here.
 */
export function saturate(value: number, soft: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(99, Math.round((value / (value + soft)) * 100));
}

export function computeMetrics(wallet: NormalizedWallet, now: number): Metric[] {
  const { txs } = wallet;
  const { symbol } = chainInfo(wallet.chain);

  const age = walletAgeDays(txs, now);
  const gas = gasBurned(txs);
  const hold = medianHoldDays(txs);
  const owls = nightOwlShare(txs);
  const fails = failureRate(txs);
  const gap = longestGapDays(txs);

  return [
    {
      id: "age",
      label: "WALLET AGE",
      // A year is a long time here, so a year reads as 50.
      score: saturate(age, 365),
      display: formatDuration(age),
      note:
        age >= 1460
          ? "present before the last two winters"
          : age >= 365
            ? "has seen at least one full cycle"
            : age >= 90
              ? "arrived recently"
              : "the paint is still wet",
    },
    {
      id: "diamond",
      label: "DIAMOND HANDS",
      score: saturate(hold, 30),
      display: hold > 0 ? formatDuration(hold) : "no completed holds",
      note:
        hold >= 180
          ? "sits on things for months"
          : hold >= 14
            ? "holds for a couple of weeks"
            : hold > 0
              ? "in and out before the block is cold"
              : "nothing has left yet",
    },
    {
      id: "gas",
      label: "GAS BURNED",
      score: saturate(gas, 1),
      display: formatAmount(gas, symbol),
      note:
        gas >= 5
          ? "has personally funded several validators"
          : gas >= 0.5
            ? "pays the toll without reading it"
            : "travels light",
    },
    {
      id: "nightowl",
      label: "NIGHT OWL",
      score: Math.round(owls * 100),
      display: `${Math.round(owls * 100)}% after midnight UTC`,
      note:
        owls >= 0.4
          ? `busiest at ${hourLabel(busiestHour(txs))} UTC, which is nobody's business hours`
          : owls >= 0.15
            ? "occasionally awake when it should not be"
            : "keeps daylight hours",
    },
    {
      id: "reckless",
      label: "RECKLESSNESS",
      score: Math.round(fails * 100),
      display: `${Math.round(fails * 100)}% reverted`,
      note:
        fails >= 0.2
          ? "signs first, reads never"
          : fails >= 0.05
            ? "has met a failed transaction or two"
            : "unusually careful, or unusually lucky",
    },
    {
      id: "drought",
      label: "LONGEST SILENCE",
      score: saturate(gap, 90),
      display: gap > 0 ? formatDuration(gap) : "never quiet",
      note:
        gap >= 365
          ? "vanished for over a year and came back"
          : gap >= 90
            ? "took a season off"
            : "never really leaves",
    },
  ];
}

/**
 * The archetypes.
 *
 * Order matters: the first rule that matches wins, so the specific and
 * interesting live above the general and dull. THE TOURIST is last because it
 * is the fallback, and a fallback that fires early eats every other verdict.
 */
const ARCHETYPE_RULES: {
  id: string;
  title: string;
  summary: string;
  when: (m: Record<string, number>) => boolean;
}[] = [
  {
    id: "ghost",
    title: "THE GHOST",
    summary: "Long dormancies broken by sudden, decisive activity.",
    when: (m) => m.drought >= 60 && m.age >= 40,
  },
  {
    id: "arsonist",
    title: "THE ARSONIST",
    summary: "An unusual share of this wallet's spending was gas.",
    when: (m) => m.gas >= 55,
  },
  {
    id: "insomniac",
    title: "THE INSOMNIAC",
    summary: "Most of this wallet's decisions were made after midnight.",
    when: (m) => m.nightowl >= 40,
  },
  {
    id: "gambler",
    title: "THE GAMBLER",
    summary: "A high revert rate and a short fuse.",
    when: (m) => m.reckless >= 15 && m.diamond < 40,
  },
  {
    id: "monk",
    title: "THE MONK",
    summary: "Enters rarely, holds for a long time, leaves quietly.",
    when: (m) => m.diamond >= 60 && m.reckless < 10,
  },
  {
    id: "elder",
    title: "THE ELDER",
    summary: "Old enough to have watched this happen before.",
    when: (m) => m.age >= 70,
  },
  {
    id: "churner",
    title: "THE CHURNER",
    summary: "Constant motion, short holds, no rest.",
    when: (m) => m.diamond < 25 && m.drought < 20,
  },
  {
    id: "tourist",
    title: "THE TOURIST",
    summary: "A short history and no strong habits yet.",
    when: () => true,
  },
];

export function archetypeFor(metrics: Metric[]): Archetype {
  const scores: Record<string, number> = {};
  for (const metric of metrics) scores[metric.id] = metric.score;

  const rule = ARCHETYPE_RULES.find((candidate) => candidate.when(scores));
  // The last rule always matches, so this fallback is unreachable. It exists so
  // the function is total rather than relying on the reader to check.
  const chosen = rule ?? ARCHETYPE_RULES[ARCHETYPE_RULES.length - 1];
  return { id: chosen.id, title: chosen.title, summary: chosen.summary };
}

export function buildReport(wallet: NormalizedWallet, now: number): WalletReport {
  const metrics = computeMetrics(wallet, now);
  return {
    address: wallet.address,
    chain: wallet.chain,
    simulated: wallet.simulated,
    metrics,
    archetype: archetypeFor(metrics),
  };
}
