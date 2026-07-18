/**
 * Tests for the arithmetic.
 *
 * `now` is injected everywhere so nothing here depends on when it runs, and the
 * demo generator is seeded, so "random" wallets are reproducible. Between them,
 * every test in this file is deterministic without a single mock.
 */

import { describe, expect, it } from "vitest";

import { CHAINS, chainInfo, detectChain, fromEtherscan, isValidAddress } from "./chain";
import { demoWallet, hashSeed, mulberry32 } from "./demo";
import { bar, formatAmount, formatDuration, metricRow, pad, shortAddress } from "./format";
import {
  archetypeFor,
  buildReport,
  busiestHour,
  chronological,
  computeMetrics,
  failureRate,
  favouriteCounterparty,
  firstSeen,
  gasBurned,
  largestOutflow,
  longestGapDays,
  medianHoldDays,
  nightOwlShare,
  saturate,
  walletAgeDays,
} from "./metrics";
import { composeProphecy, standoutMetrics } from "./prophecy";
import type { Tx } from "./types";

const DAY = 86_400;
const NOW = 1_800_000_000;

function tx(over: Partial<Tx> = {}): Tx {
  return {
    hash: "0xabc",
    timestamp: NOW - DAY,
    direction: "out",
    value: 1,
    fee: 0.01,
    counterparty: "0xdead",
    failed: false,
    ...over,
  };
}

/** A timestamp at a given UTC hour, `daysAgo` before NOW. */
function atHour(hour: number, daysAgo = 1): number {
  const date = new Date((NOW - daysAgo * DAY) * 1000);
  date.setUTCHours(hour, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

describe("chain", () => {
  it("recognises an ethereum address", () => {
    expect(detectChain("0x" + "a".repeat(40))).toBe("ethereum");
  });

  it("recognises a solana address", () => {
    expect(detectChain("DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK")).toBe("solana");
  });

  it("rejects rubbish", () => {
    expect(detectChain("hello")).toBeNull();
    expect(detectChain("0x123")).toBeNull();
    expect(detectChain("")).toBeNull();
  });

  it("rejects an ethereum address one character short", () => {
    expect(detectChain("0x" + "a".repeat(39))).toBeNull();
  });

  it("rejects base58 containing the characters base58 excludes", () => {
    // '0', 'O', 'I' and 'l' are not in the alphabet -- that is the whole point
    // of base58, and a naive [A-Za-z0-9]{32,44} would wave this through.
    expect(detectChain("0".repeat(40))).toBeNull();
    expect(detectChain("O".repeat(40))).toBeNull();
    expect(detectChain("I".repeat(40))).toBeNull();
  });

  it("tolerates surrounding whitespace, as a paste will have", () => {
    expect(detectChain("  0x" + "a".repeat(40) + "  ")).toBe("ethereum");
  });

  it("validates via the same path", () => {
    expect(isValidAddress("0x" + "1".repeat(40))).toBe(true);
    expect(isValidAddress("nope")).toBe(false);
  });

  it("knows every declared chain", () => {
    for (const chain of CHAINS) {
      expect(chainInfo(chain.id).symbol).toBeTruthy();
    }
  });

  it("throws on an unknown chain rather than returning undefined", () => {
    // @ts-expect-error deliberately wrong, to prove the guard exists
    expect(() => chainInfo("dogecoin")).toThrow();
  });
});

describe("fromEtherscan", () => {
  const owner = "0x" + "a".repeat(40);
  const other = "0x" + "b".repeat(40);

  const row = (over: Record<string, string> = {}) => ({
    hash: "0x1",
    timeStamp: String(NOW - DAY),
    from: owner,
    to: other,
    value: "1000000000000000000",
    gasUsed: "21000",
    gasPrice: "20000000000",
    isError: "0",
    ...over,
  });

  it("converts wei to ether", () => {
    const [parsed] = fromEtherscan(owner, [row()]);
    expect(parsed.value).toBeCloseTo(1);
  });

  it("infers direction from the sender", () => {
    const [outgoing] = fromEtherscan(owner, [row()]);
    const [incoming] = fromEtherscan(owner, [row({ from: other, to: owner })]);
    expect(outgoing.direction).toBe("out");
    expect(incoming.direction).toBe("in");
  });

  it("matches the address case-insensitively", () => {
    // Etherscan returns lowercase; a user pastes a checksummed address.
    const [parsed] = fromEtherscan(owner.toUpperCase(), [row()]);
    expect(parsed.direction).toBe("out");
  });

  it("only charges gas to the sender", () => {
    const [outgoing] = fromEtherscan(owner, [row()]);
    const [incoming] = fromEtherscan(owner, [row({ from: other, to: owner })]);
    expect(outgoing.fee).toBeGreaterThan(0);
    expect(incoming.fee).toBe(0);
  });

  it("reads both failure fields", () => {
    expect(fromEtherscan(owner, [row({ isError: "1" })])[0].failed).toBe(true);
    expect(fromEtherscan(owner, [row({ txreceipt_status: "0" })])[0].failed).toBe(true);
    expect(fromEtherscan(owner, [row()])[0].failed).toBe(false);
  });

  it("skips malformed rows instead of throwing", () => {
    const rows = [row(), null, { nope: true }, row({ timeStamp: "0" })];
    expect(fromEtherscan(owner, rows)).toHaveLength(1);
  });

  it("returns nothing for an empty list", () => {
    expect(fromEtherscan(owner, [])).toEqual([]);
  });
});

describe("metrics: basics", () => {
  it("sorts defensively rather than trusting the explorer", () => {
    const txs = [tx({ timestamp: 300 }), tx({ timestamp: 100 }), tx({ timestamp: 200 })];
    expect(chronological(txs).map((t) => t.timestamp)).toEqual([100, 200, 300]);
  });

  it("does not mutate the array it is given", () => {
    const txs = [tx({ timestamp: 300 }), tx({ timestamp: 100 })];
    chronological(txs);
    expect(txs[0].timestamp).toBe(300);
  });

  it("finds the first transaction", () => {
    expect(firstSeen([tx({ timestamp: 300 }), tx({ timestamp: 100 })])).toBe(100);
    expect(firstSeen([])).toBeNull();
  });

  it("measures wallet age in days", () => {
    expect(walletAgeDays([tx({ timestamp: NOW - 10 * DAY })], NOW)).toBeCloseTo(10);
  });

  it("gives an empty wallet an age of zero, not NaN", () => {
    expect(walletAgeDays([], NOW)).toBe(0);
  });

  it("sums gas including failed transactions", () => {
    const txs = [tx({ fee: 0.01 }), tx({ fee: 0.02, failed: true })];
    expect(gasBurned(txs)).toBeCloseTo(0.03);
  });

  it("survives a non-finite fee", () => {
    expect(gasBurned([tx({ fee: NaN }), tx({ fee: 0.01 })])).toBeCloseTo(0.01);
  });

  it("computes a failure rate", () => {
    expect(failureRate([tx(), tx({ failed: true })])).toBe(0.5);
    expect(failureRate([])).toBe(0);
  });

  it("finds the largest completed outflow, ignoring failures and inflows", () => {
    const txs = [
      tx({ direction: "out", value: 3 }),
      tx({ direction: "out", value: 99, failed: true }),
      tx({ direction: "in", value: 50 }),
    ];
    expect(largestOutflow(txs)).toBe(3);
  });
});

describe("metrics: time of day", () => {
  it("counts activity in the small hours", () => {
    const txs = [
      tx({ timestamp: atHour(2) }),
      tx({ timestamp: atHour(3) }),
      tx({ timestamp: atHour(14) }),
      tx({ timestamp: atHour(15) }),
    ];
    expect(nightOwlShare(txs)).toBe(0.5);
  });

  it("treats the window as half-open, so 05:00 is morning", () => {
    expect(nightOwlShare([tx({ timestamp: atHour(5) })])).toBe(0);
    expect(nightOwlShare([tx({ timestamp: atHour(4) })])).toBe(1);
  });

  it("returns zero for an empty wallet", () => {
    expect(nightOwlShare([])).toBe(0);
  });

  it("finds the busiest hour", () => {
    const txs = [
      tx({ timestamp: atHour(3, 1) }),
      tx({ timestamp: atHour(3, 2) }),
      tx({ timestamp: atHour(3, 3) }),
      tx({ timestamp: atHour(14, 1) }),
    ];
    expect(busiestHour(txs)).toBe(3);
  });
});

describe("metrics: holding", () => {
  it("measures the gap from an inflow to the next outflow", () => {
    const txs = [
      tx({ direction: "in", timestamp: NOW - 30 * DAY }),
      tx({ direction: "out", timestamp: NOW - 20 * DAY }),
    ];
    expect(medianHoldDays(txs)).toBeCloseTo(10);
  });

  it("takes the median, not the mean", () => {
    // Two quick flips and one four-year hold. A mean would call this diamond
    // hands; the median correctly calls it churn.
    const txs = [
      tx({ direction: "in", timestamp: NOW - 1500 * DAY }),
      tx({ direction: "out", timestamp: NOW - 100 * DAY }),
      tx({ direction: "in", timestamp: NOW - 90 * DAY }),
      tx({ direction: "out", timestamp: NOW - 89 * DAY }),
      tx({ direction: "in", timestamp: NOW - 50 * DAY }),
      tx({ direction: "out", timestamp: NOW - 49 * DAY }),
    ];
    expect(medianHoldDays(txs)).toBeLessThan(60);
  });

  it("returns zero when nothing has ever left", () => {
    expect(medianHoldDays([tx({ direction: "in" }), tx({ direction: "in" })])).toBe(0);
  });

  it("returns zero for an empty wallet", () => {
    expect(medianHoldDays([])).toBe(0);
  });
});

describe("metrics: silence", () => {
  it("finds the longest gap", () => {
    const txs = [
      tx({ timestamp: NOW - 400 * DAY }),
      tx({ timestamp: NOW - 100 * DAY }),
      tx({ timestamp: NOW - 95 * DAY }),
    ];
    expect(longestGapDays(txs)).toBeCloseTo(300);
  });

  it("is zero when there is nothing to gap between", () => {
    expect(longestGapDays([tx()])).toBe(0);
    expect(longestGapDays([])).toBe(0);
  });
});

describe("metrics: counterparties", () => {
  it("finds a repeated counterparty", () => {
    const txs = [
      tx({ counterparty: "0xaaa" }),
      tx({ counterparty: "0xaaa" }),
      tx({ counterparty: "0xbbb" }),
    ];
    expect(favouriteCounterparty(txs)).toBe("0xaaa");
  });

  it("has no favourite when everyone appears once", () => {
    const txs = [tx({ counterparty: "0xaaa" }), tx({ counterparty: "0xbbb" })];
    expect(favouriteCounterparty(txs)).toBeNull();
  });

  it("ignores empty counterparties", () => {
    expect(favouriteCounterparty([tx({ counterparty: "" })])).toBeNull();
  });
});

describe("saturate", () => {
  it("maps the soft point to 50", () => {
    expect(saturate(365, 365)).toBe(50);
  });

  it("never reaches 100, however large the input", () => {
    // An unbounded quantity has no maximum, so no score may claim one.
    expect(saturate(1e9, 1)).toBeLessThan(100);
    expect(saturate(Number.MAX_SAFE_INTEGER, 1)).toBeLessThan(100);
  });

  it("is zero at zero and below", () => {
    expect(saturate(0, 10)).toBe(0);
    expect(saturate(-5, 10)).toBe(0);
  });

  it("survives NaN", () => {
    expect(saturate(NaN, 10)).toBe(0);
  });

  it("is monotonic", () => {
    let last = -1;
    for (const value of [0, 1, 10, 100, 1000, 10000]) {
      const score = saturate(value, 100);
      expect(score).toBeGreaterThanOrEqual(last);
      last = score;
    }
  });
});

describe("computeMetrics", () => {
  const wallet = demoWallet("0x" + "1".repeat(40), { now: NOW });

  it("returns every metric", () => {
    const ids = computeMetrics(wallet, NOW).map((m) => m.id);
    expect(ids).toEqual(["age", "diamond", "gas", "nightowl", "reckless", "drought"]);
  });

  it("keeps every score inside 0-100", () => {
    for (const metric of computeMetrics(wallet, NOW)) {
      expect(metric.score).toBeGreaterThanOrEqual(0);
      expect(metric.score).toBeLessThanOrEqual(100);
    }
  });

  it("gives every metric something to display and a note", () => {
    for (const metric of computeMetrics(wallet, NOW)) {
      expect(metric.display).toBeTruthy();
      expect(metric.note).toBeTruthy();
      expect(metric.label).toBeTruthy();
    }
  });

  it("handles a wallet with no transactions at all", () => {
    const empty = { address: "0x1", chain: "ethereum" as const, balance: 0, txs: [], simulated: true };
    const metrics = computeMetrics(empty, NOW);
    expect(metrics).toHaveLength(6);
    for (const metric of metrics) expect(Number.isFinite(metric.score)).toBe(true);
  });
});

describe("archetypeFor", () => {
  const metrics = (scores: Record<string, number>) =>
    Object.entries(scores).map(([id, score]) => ({
      id,
      label: id.toUpperCase(),
      score,
      display: "",
      note: "",
    }));

  it("always returns an archetype, even for nothing", () => {
    expect(archetypeFor([]).title).toBeTruthy();
  });

  it("falls back to the tourist", () => {
    expect(archetypeFor(metrics({ age: 0, diamond: 30, gas: 0, nightowl: 0, reckless: 0, drought: 30 })).id).toBe("tourist");
  });

  it("names the arsonist for heavy gas", () => {
    expect(archetypeFor(metrics({ age: 20, diamond: 30, gas: 80, nightowl: 0, reckless: 0, drought: 0 })).id).toBe("arsonist");
  });

  it("names the insomniac for nocturnal activity", () => {
    expect(archetypeFor(metrics({ age: 20, diamond: 30, gas: 10, nightowl: 60, reckless: 0, drought: 0 })).id).toBe("insomniac");
  });

  it("names the ghost for long dormancy", () => {
    expect(archetypeFor(metrics({ age: 60, diamond: 30, gas: 10, nightowl: 0, reckless: 0, drought: 80 })).id).toBe("ghost");
  });

  it("names the monk for patient, careful wallets", () => {
    expect(archetypeFor(metrics({ age: 50, diamond: 70, gas: 10, nightowl: 0, reckless: 2, drought: 10 })).id).toBe("monk");
  });

  it("gives every archetype a title and a summary", () => {
    for (let gas = 0; gas <= 100; gas += 10) {
      for (let diamond = 0; diamond <= 100; diamond += 25) {
        const result = archetypeFor(metrics({ age: 50, diamond, gas, nightowl: 20, reckless: 5, drought: 30 }));
        expect(result.title).toMatch(/^THE /);
        expect(result.summary.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("demo wallet", () => {
  it("is deterministic for an address", () => {
    const a = demoWallet("0x" + "c".repeat(40), { now: NOW });
    const b = demoWallet("0x" + "c".repeat(40), { now: NOW });
    expect(a.txs).toEqual(b.txs);
    expect(a.balance).toBe(b.balance);
  });

  it("differs between addresses", () => {
    const a = demoWallet("0x" + "c".repeat(40), { now: NOW });
    const b = demoWallet("0x" + "d".repeat(40), { now: NOW });
    expect(a.txs.length === b.txs.length && a.balance === b.balance).toBe(false);
  });

  it("marks itself simulated, so the UI cannot pretend otherwise", () => {
    expect(demoWallet("0x" + "1".repeat(40), { now: NOW }).simulated).toBe(true);
  });

  it("never generates a transaction in the future", () => {
    const wallet = demoWallet("0x" + "e".repeat(40), { now: NOW });
    for (const t of wallet.txs) expect(t.timestamp).toBeLessThanOrEqual(NOW);
  });

  it("infers the chain from the address shape", () => {
    expect(demoWallet("0x" + "1".repeat(40), { now: NOW }).chain).toBe("ethereum");
    expect(demoWallet("DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK", { now: NOW }).chain).toBe("solana");
  });

  it("produces varied archetypes across addresses", () => {
    // If every demo wallet were the same archetype the demo would be pointless.
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const address = "0x" + i.toString(16).padStart(40, "0");
      seen.add(buildReport(demoWallet(address, { now: NOW }), NOW).archetype.id);
    }
    expect(seen.size).toBeGreaterThan(2);
  });
});

describe("prng", () => {
  it("hashes deterministically", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });

  it("stays inside [0, 1)", () => {
    const rand = mulberry32(42);
    for (let i = 0; i < 500; i += 1) {
      const value = rand();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("repeats for a seed", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("format", () => {
  it("scales precision to magnitude", () => {
    expect(formatAmount(0, "ETH")).toBe("0 ETH");
    expect(formatAmount(0.00001, "ETH")).toBe("<0.0001 ETH");
    expect(formatAmount(0.5, "ETH")).toBe("0.5000 ETH");
    expect(formatAmount(12.3456, "ETH")).toBe("12.346 ETH");
  });

  it("does not print NaN at a person", () => {
    expect(formatAmount(NaN, "ETH")).toContain("??");
  });

  it("reads durations in the right unit", () => {
    expect(formatDuration(0.5)).toBe("less than a day");
    expect(formatDuration(10)).toBe("10 days");
    expect(formatDuration(200)).toContain("months");
    expect(formatDuration(1000)).toContain("years");
  });

  it("shortens addresses and leaves short ones alone", () => {
    expect(shortAddress("0x1234567890abcdef1234")).toBe("0x1234…1234");
    expect(shortAddress("0x12")).toBe("0x12");
  });

  it("draws a bar of fixed width", () => {
    expect(bar(50, 10)).toHaveLength(10);
    expect(bar(0, 10)).toBe("░".repeat(10));
    expect(bar(100, 10)).toBe("█".repeat(10));
  });

  it("clamps a bar rather than overrunning it", () => {
    expect(bar(9999, 10)).toHaveLength(10);
    expect(bar(-50, 10)).toHaveLength(10);
    expect(bar(NaN, 10)).toHaveLength(10);
  });

  it("pads and truncates to an exact width", () => {
    expect(pad("ab", 5)).toBe("ab   ");
    expect(pad("abcdefgh", 3)).toBe("abc");
  });

  it("builds rows that line up", () => {
    const a = metricRow("SHORT", 50, "x");
    const b = metricRow("MUCH LONGER LABEL", 50, "x");
    expect(a.indexOf("█")).toBe(b.indexOf("█"));
  });
});

describe("offline prophecy", () => {
  const report = buildReport(demoWallet("0x" + "9".repeat(40), { now: NOW }), NOW);

  it("says something", () => {
    expect(composeProphecy(report).length).toBeGreaterThan(60);
  });

  it("is deterministic, so a wallet has one fate", () => {
    expect(composeProphecy(report)).toBe(composeProphecy(report));
  });

  it("names the archetype", () => {
    expect(composeProphecy(report)).toContain(report.archetype.title);
  });

  it("picks the metrics furthest from the middle", () => {
    const metrics = [
      { id: "a", label: "A", score: 50, display: "", note: "" },
      { id: "b", label: "B", score: 95, display: "", note: "" },
      { id: "c", label: "C", score: 48, display: "", note: "" },
      { id: "d", label: "D", score: 2, display: "", note: "" },
    ];
    // 'd' leads 'b': |2-50| = 48 is further from the middle than |95-50| = 45.
    expect(standoutMetrics(metrics).map((m) => m.id)).toEqual(["d", "b"]);
  });

  // The line the whole design is drawn on.
  it("never predicts a price or suggests a trade", () => {
    const forbidden = /\b(buy|sell|moon|pump|dump|10x|100x|price target|guaranteed)\b/i;
    for (let i = 0; i < 60; i += 1) {
      const address = "0x" + i.toString(16).padStart(40, "0");
      const text = composeProphecy(buildReport(demoWallet(address, { now: NOW }), NOW));
      expect(text).not.toMatch(forbidden);
    }
  });
});
