/**
 * The terminal.
 *
 * Owns the loop: read a line, run it, print the result. Commands themselves are
 * data in `commands.ts`; the only one this file knows by name is `scan`,
 * because it is the only one that needs the network, a spinner, and the oracle.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { BOOT_SEQUENCE } from "./boot";
import { chainInfo, detectChain } from "./chain";
import { findCommand, parseInput } from "./commands";
import { demoWallet } from "./demo";
import { formatAmount, metricRow, shortAddress } from "./format";
import { buildReport } from "./metrics";
import { Line } from "./Line";
import { useKeystrokes } from "./useKeystrokes";
import { useProphecy } from "./useProphecy";
import { useTerminal } from "./useTerminal";
import type { LineKind } from "./types";

export function Terminal() {
  const { state, dispatch, print, printLine } = useTerminal();
  const { ask, pending } = useProphecy();
  const keys = useKeystrokes();

  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [booted, setBooted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ---- Boot.
  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    let elapsed = 0;

    for (const line of BOOT_SEQUENCE) {
      elapsed += line.delay;
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) print([{ kind: line.kind, text: line.text }]);
        }, elapsed),
      );
    }
    timers.push(
      window.setTimeout(() => {
        if (!cancelled) setBooted(true);
      }, elapsed + 100),
    );

    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [print]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [state.lines]);

  // ---- The scan pipeline: fetch, measure, narrate.
  const runScan = useCallback(
    async (address: string) => {
      const chain = detectChain(address);
      if (!chain) return;
      const info = chainInfo(chain);

      dispatch({ type: "busy", value: true });
      dispatch({ type: "address", value: address });

      print([
        { kind: "system", text: `SCANNING ${shortAddress(address, 10, 6)} ON ${info.label}…` },
      ]);

      // No explorer key ships with the repo, so the demo generator stands in.
      // It is seeded by the address, so this is a lookup, not a dice roll.
      await new Promise((resolve) => setTimeout(resolve, 420));
      const wallet = demoWallet(address, { chain });
      const report = buildReport(wallet, Math.floor(Date.now() / 1000));

      const rows = report.metrics.map((metric) => ({
        kind: "output" as LineKind,
        text: metricRow(metric.label, metric.score, metric.display),
      }));

      print([
        { kind: "dim", text: `  ${wallet.txs.length} transactions · balance ${formatAmount(wallet.balance, info.symbol)}` },
        ...(wallet.simulated
          ? [{ kind: "error" as LineKind, text: "  SIMULATED HISTORY — no explorer key configured." }]
          : []),
        { kind: "dim", text: "" },
        ...rows,
        { kind: "dim", text: "" },
        { kind: "system", text: `VERDICT: ${report.archetype.title}` },
        { kind: "dim", text: "" },
      ]);

      const result = await ask(report);
      print([
        { kind: "prophecy", text: result.text, typed: true },
        { kind: "dim", text: "" },
        {
          kind: "dim",
          text:
            result.source === "model"
              ? "  — the oracle speaks"
              : `  — offline oracle${result.reason ? ` (${result.reason})` : ""}`,
        },
        { kind: "dim", text: "" },
      ]);

      dispatch({ type: "busy", value: false });
    },
    [ask, dispatch, print],
  );

  // ---- The loop.
  const submit = useCallback(() => {
    const raw = input;
    setInput("");
    setHistoryIndex(null);
    if (!raw.trim()) return;

    printLine(`> ${raw}`, "user");
    dispatch({ type: "remember", input: raw });

    const parsed = parseInput(raw);
    if (!parsed) return;

    const command = findCommand(parsed.name);
    if (!command) {
      print([
        { kind: "error", text: `Unknown incantation: ${parsed.name}` },
        { kind: "dim", text: "Type /help." },
      ]);
      return;
    }

    const result = command.run(parsed.args, {
      address: state.address,
      phosphor: state.phosphor,
    });
    if (result.lines.length) print(result.lines);

    switch (result.effect) {
      case "clear":
        dispatch({ type: "clear" });
        break;
      case "amber":
        dispatch({ type: "phosphor", value: "amber" });
        break;
      case "green":
        dispatch({ type: "phosphor", value: "green" });
        break;
      case "reboot":
        dispatch({ type: "clear" });
        window.location.reload();
        break;
      case "scan":
        if (result.payload) void runScan(result.payload);
        break;
      default:
        break;
    }
  }, [dispatch, input, print, printLine, runScan, state.address, state.phosphor]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        keys.click(0.8);
        submit();
        return;
      }
      // Up/down walk the command history, as a terminal must.
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const { history } = state;
        if (history.length === 0) return;
        const current = historyIndex ?? history.length;
        const next =
          event.key === "ArrowUp"
            ? Math.max(0, current - 1)
            : Math.min(history.length, current + 1);
        setHistoryIndex(next);
        setInput(next === history.length ? "" : history[next]);
        return;
      }
      if (event.key.length === 1) keys.click(0.9 + Math.random() * 0.3);
    },
    [historyIndex, keys, state, submit],
  );

  const busy = state.busy || pending;

  return (
    <div
      className="crt"
      data-phosphor={state.phosphor}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="crt__screen">
        <div className="crt__scroll">
          {state.lines.map((line) => (
            <Line key={line.id} line={line} />
          ))}

          {booted && (
            <div className="prompt" data-busy={busy || undefined}>
              <span className="prompt__sigil">{busy ? "…" : ">"}</span>
              <input
                ref={inputRef}
                className="prompt__input"
                value={input}
                disabled={busy}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                aria-label="Terminal input"
                placeholder={busy ? "" : "paste a wallet address, or /help"}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="crt__scanlines" aria-hidden />
        <div className="crt__vignette" aria-hidden />
        <div className="crt__glare" aria-hidden />
      </div>

      <div className="crt__bezel">
        <span className="crt__brand">PROPHECY&nbsp;CRT-2600</span>
        <button
          className="crt__knob"
          onClick={(event) => {
            event.stopPropagation();
            keys.toggle();
          }}
          aria-pressed={keys.enabled}
          title={keys.enabled ? "Mute keystrokes" : "Enable keystrokes"}
        >
          SOUND {keys.enabled ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
