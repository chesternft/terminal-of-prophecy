/**
 * Asking the oracle.
 *
 * Tries the serverless model first and falls back to the local composer on any
 * failure -- no key, rate limited, network down, model offline. The terminal
 * always says something. It just tells you which oracle spoke.
 */

import { useCallback, useState } from "react";

import { composeProphecy } from "./prophecy";
import type { WalletReport } from "./types";

export type ProphecySource = "model" | "local";

export interface ProphecyResult {
  text: string;
  source: ProphecySource;
  /** Set when the model was tried and declined. */
  reason?: string;
}

export function useProphecy() {
  const [pending, setPending] = useState(false);

  const ask = useCallback(async (report: WalletReport): Promise<ProphecyResult> => {
    setPending(true);
    const local = () => ({ text: composeProphecy(report), source: "local" as const });

    try {
      const response = await fetch("/api/prophecy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        return { ...local(), reason: body.error ?? `HTTP ${response.status}` };
      }

      const body = (await response.json()) as { prophecy?: string };
      if (!body.prophecy) return { ...local(), reason: "empty response" };
      return { text: body.prophecy, source: "model" };
    } catch {
      // In dev there is no /api route at all unless `vercel dev` is running,
      // so this path is the normal one, not the exceptional one.
      return { ...local(), reason: "no endpoint" };
    } finally {
      setPending(false);
    }
  }, []);

  return { ask, pending };
}
