/**
 * The shape of a wallet, its metrics, and the terminal that reads them.
 *
 * Everything downstream of `NormalizedWallet` is chain-agnostic on purpose.
 * Etherscan and Solscan disagree about almost every field name, so the
 * adapters in `chain.ts` are the only code that knows either exists; the
 * metrics, the archetype, the prophecy, and the UI all speak this dialect and
 * nothing else. Adding a chain is a new adapter, not a new branch in six files.
 */

/** One transaction, flattened to the fields any chain can supply. */
export interface Tx {
  hash: string;
  /** Unix seconds. */
  timestamp: number;
  direction: "in" | "out";
  /** Native units (ETH, SOL). Always positive; `direction` carries the sign. */
  value: number;
  /** Fee in native units. */
  fee: number;
  counterparty: string;
  failed: boolean;
}

export interface NormalizedWallet {
  address: string;
  chain: ChainId;
  /** Native-unit balance. */
  balance: number;
  /** Newest first is *not* assumed; metrics sort defensively. */
  txs: Tx[];
  /** True when this came from the demo generator rather than a real explorer. */
  simulated: boolean;
}

export type ChainId = "ethereum" | "solana";

export interface ChainInfo {
  id: ChainId;
  label: string;
  symbol: string;
  /** How an address on this chain is spelled. */
  pattern: RegExp;
}

/** A single computed metric, ready to print. */
export interface Metric {
  id: string;
  /** Shown in the terminal readout, uppercase, short. */
  label: string;
  /** 0-100, for the bar chart. */
  score: number;
  /** The human-readable value, e.g. "412 days" or "0.84 ETH". */
  display: string;
  /** One line of colour for the AI to riff on. */
  note: string;
}

export interface WalletReport {
  address: string;
  chain: ChainId;
  simulated: boolean;
  metrics: Metric[];
  archetype: Archetype;
}

export interface Archetype {
  id: string;
  /** THE INSOMNIAC, THE MONK, and so on. */
  title: string;
  /** One sentence describing the pattern, not the person. */
  summary: string;
}

/** A line on screen. `kind` drives colour and whether it types out. */
export type LineKind =
  | "system"
  | "user"
  | "output"
  | "error"
  | "prophecy"
  | "dim";

export interface Line {
  id: number;
  kind: LineKind;
  text: string;
  /** When true, the line reveals character by character. */
  typed?: boolean;
}
