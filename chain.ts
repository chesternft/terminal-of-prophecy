/**
 * Chains, addresses, and the adapters that flatten explorer responses.
 *
 * Validation lives here rather than in the API route because the terminal
 * should reject a malformed address instantly and locally -- a round trip to
 * tell someone they typed 39 hex characters is a round trip wasted, and it is
 * also free rate-limit budget for anyone fuzzing the endpoint.
 */

import type { ChainId, ChainInfo, NormalizedWallet, Tx } from "./types";

export const CHAINS: ChainInfo[] = [
  {
    id: "ethereum",
    label: "ETHEREUM",
    symbol: "ETH",
    pattern: /^0x[a-fA-F0-9]{40}$/,
  },
  {
    id: "solana",
    label: "SOLANA",
    symbol: "SOL",
    // Base58: no 0, O, I, or l, which is exactly why it is not just [A-Za-z0-9].
    pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  },
];

export function chainInfo(id: ChainId): ChainInfo {
  const found = CHAINS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown chain: ${id}`);
  return found;
}

/** Which chain, if any, an address belongs to. */
export function detectChain(address: string): ChainId | null {
  const trimmed = address.trim();
  for (const chain of CHAINS) {
    if (chain.pattern.test(trimmed)) return chain.id;
  }
  return null;
}

export function isValidAddress(address: string): boolean {
  return detectChain(address) !== null;
}

/**
 * Etherscan's account txlist, flattened.
 *
 * Everything arrives as a decimal string, including the numbers, and value is
 * in wei. Direction is not a field -- you infer it by comparing `from` against
 * the address you asked about, case-insensitively, because Etherscan and the
 * user will not agree on checksum casing.
 */
export function fromEtherscan(
  address: string,
  rows: unknown[],
): Tx[] {
  const owner = address.toLowerCase();
  const txs: Tx[] = [];

  for (const raw of rows) {
    const row = raw as Record<string, string>;
    if (!row || typeof row.hash !== "string") continue;

    const wei = Number(row.value ?? 0);
    const gasUsed = Number(row.gasUsed ?? 0);
    const gasPrice = Number(row.gasPrice ?? 0);
    const timestamp = Number(row.timeStamp ?? 0);
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue;

    const from = (row.from ?? "").toLowerCase();
    const to = (row.to ?? "").toLowerCase();
    const outgoing = from === owner;

    txs.push({
      hash: row.hash,
      timestamp,
      direction: outgoing ? "out" : "in",
      value: wei / 1e18,
      // Only the sender pays gas. Crediting the recipient with it would make
      // every airdrop look like an arson.
      fee: outgoing ? (gasUsed * gasPrice) / 1e18 : 0,
      counterparty: outgoing ? to : from,
      failed: row.isError === "1" || row.txreceipt_status === "0",
    });
  }
  return txs;
}

/** Build the explorer URL. Kept here so no key ever reaches the client. */
export function etherscanUrl(address: string, apiKey: string): string {
  const params = new URLSearchParams({
    module: "account",
    action: "txlist",
    address,
    startblock: "0",
    endblock: "99999999",
    page: "1",
    offset: "1000",
    sort: "desc",
    apikey: apiKey,
  });
  return `https://api.etherscan.io/api?${params.toString()}`;
}

export function emptyWallet(address: string, chain: ChainId): NormalizedWallet {
  return { address, chain, balance: 0, txs: [], simulated: false };
}
