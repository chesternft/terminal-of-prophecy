/**
 * The command registry.
 *
 * A command is data: a name, some help text, and a function from arguments to
 * lines. The terminal component knows how to run one and nothing about what any
 * of them do, which is why adding `/rug` took one entry and no component edits.
 *
 * Everything here is synchronous and pure except `scan`, which the terminal
 * handles itself because it needs the network and a spinner. Keeping the rest
 * pure means the whole command surface is testable without React.
 */

import { detectChain } from "./chain";
import type { LineKind } from "./types";

export interface CommandOutput {
  kind: LineKind;
  text: string;
  typed?: boolean;
}

export interface CommandContext {
  /** Set when a wallet has been scanned this session. */
  address: string | null;
  /** Terminal colour scheme, so /amber can report what it did. */
  phosphor: "green" | "amber";
}

export interface CommandResult {
  lines: CommandOutput[];
  /** Side effects the terminal performs. Commands never touch state directly. */
  effect?: "clear" | "scan" | "amber" | "green" | "reboot";
  /** Argument for the effect, e.g. the address to scan. */
  payload?: string;
}

export interface Command {
  name: string;
  args?: string;
  description: string;
  /** Hidden commands do not appear in /help. Finding them is the point. */
  hidden?: boolean;
  run: (args: string[], ctx: CommandContext) => CommandResult;
}

const out = (text: string, kind: LineKind = "output"): CommandOutput => ({ kind, text });

export const COMMANDS: Command[] = [
  {
    name: "help",
    description: "list commands",
    run: () => ({
      lines: [
        out(""),
        out("AVAILABLE INCANTATIONS", "system"),
        ...COMMANDS.filter((c) => !c.hidden).map((c) =>
          out(`  /${c.name}${c.args ? " " + c.args : ""}`.padEnd(28) + c.description),
        ),
        out(""),
        out("  Some commands are not listed. The oracle rewards curiosity.", "dim"),
        out(""),
      ],
    }),
  },
  {
    name: "scan",
    args: "<address>",
    description: "read a wallet and receive its verdict",
    run: (args) => {
      const address = args[0];
      if (!address) {
        return { lines: [out("Usage: /scan <address>", "error")] };
      }
      if (!detectChain(address)) {
        return {
          lines: [
            out(`That is not an address the oracle recognises.`, "error"),
            out("  Ethereum: 0x + 40 hex characters", "dim"),
            out("  Solana:   32-44 base58 characters", "dim"),
          ],
        };
      }
      return { lines: [], effect: "scan", payload: address };
    },
  },
  {
    name: "about",
    description: "what this is",
    run: () => ({
      lines: [
        out(""),
        out("TERMINAL OF PROPHECY", "system"),
        out("  Reads public transaction history. Says something about it."),
        out("  The metrics are arithmetic. The prophecy is theatre."),
        out("  Neither is advice, and neither knows the future.", "dim"),
        out(""),
      ],
    }),
  },
  {
    name: "clear",
    description: "wipe the screen",
    run: () => ({ lines: [], effect: "clear" }),
  },
  {
    name: "amber",
    description: "switch to amber phosphor",
    run: (_args, ctx) => ({
      lines: [out(ctx.phosphor === "amber" ? "Already amber." : "Phosphor: amber.", "dim")],
      effect: "amber",
    }),
  },
  {
    name: "green",
    description: "switch to green phosphor",
    run: (_args, ctx) => ({
      lines: [out(ctx.phosphor === "green" ? "Already green." : "Phosphor: green.", "dim")],
      effect: "green",
    }),
  },

  // ---- Below here: the ones that are not in /help.

  {
    name: "moon",
    hidden: true,
    description: "ask about the moon",
    run: () => ({
      lines: [
        out(""),
        out("        .  *  .        ", "dim"),
        out("     *    ___    .     ", "dim"),
        out("   .     /   \\     *   ", "dim"),
        out("        |  •  |        ", "dim"),
        out("   *     \\___/    .    ", "dim"),
        out("     .   *    .        ", "dim"),
        out(""),
        out("The moon is 384,400 km away and has never once been reached", "prophecy"),
        out("by a wallet. It is, however, still there. That is more than", "prophecy"),
        out("can be said for most things you have believed in.", "prophecy"),
        out(""),
      ],
    }),
  },
  {
    name: "ngmi",
    hidden: true,
    description: "self-assessment",
    run: () => ({
      lines: [
        out(""),
        out("ASSESSMENT REQUESTED.", "system"),
        out("The oracle declines to confirm.", "prophecy"),
        out("Not out of kindness. Out of insufficient evidence — you are, at", "prophecy"),
        out("time of writing, still here, which is the only metric that has", "prophecy"),
        out("ever correlated with anything.", "prophecy"),
        out(""),
      ],
    }),
  },
  {
    name: "wagmi",
    hidden: true,
    description: "optimism",
    run: () => ({
      lines: [
        out(""),
        out("The oracle has reviewed the claim that we are all going to", "prophecy"),
        out("make it. It notes that 'we' is doing a great deal of work in", "prophecy"),
        out("that sentence, and that 'it' has never been defined.", "prophecy"),
        out(""),
      ],
    }),
  },
  {
    name: "gm",
    hidden: true,
    description: "greeting",
    run: () => ({
      lines: [out("gm. The chain has been awake for some time.", "prophecy")],
    }),
  },
  {
    name: "rug",
    hidden: true,
    description: "ask about rugs",
    run: () => ({
      lines: [
        out(""),
        out("SEARCHING FOR RUGS...", "system"),
        out("  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%", "dim"),
        out(""),
        out("Result: the rug is a floor covering. It has been beneath you", "prophecy"),
        out("this entire time. The oracle cannot determine who is pulling.", "prophecy"),
        out(""),
      ],
    }),
  },
  {
    name: "sudo",
    hidden: true,
    description: "elevate",
    run: (args) => ({
      lines: [
        out(
          args.length > 0
            ? `The oracle is not a machine you have permissions on.`
            : "sudo: what",
          "error",
        ),
        out("This incident has not been reported. Nobody is listening.", "dim"),
      ],
    }),
  },
  {
    name: "whoami",
    hidden: true,
    description: "identity",
    run: (_args, ctx) => ({
      lines: [
        out(
          ctx.address
            ? `You are the wallet ${ctx.address}. The oracle knows nothing else about you, and wants nothing else.`
            : "You have not identified yourself. The oracle finds this sensible.",
          "prophecy",
        ),
      ],
    }),
  },
  {
    name: "reboot",
    hidden: true,
    description: "restart the terminal",
    run: () => ({ lines: [], effect: "reboot" }),
  },
  {
    name: "exit",
    hidden: true,
    description: "leave",
    run: () => ({
      lines: [out("There is no exit. There is only the tab you opened this in.", "prophecy")],
    }),
  },
];

export function findCommand(name: string): Command | undefined {
  return COMMANDS.find((command) => command.name === name.toLowerCase());
}

/**
 * Split a typed line into a command and its arguments.
 *
 * A bare address is treated as `/scan <address>`, because that is what someone
 * pasting an address into a terminal that asks for a wallet meant.
 */
export function parseInput(input: string): { name: string; args: string[] } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith("/")) {
    if (detectChain(trimmed)) return { name: "scan", args: [trimmed] };
    return { name: trimmed.split(/\s+/)[0].toLowerCase(), args: trimmed.split(/\s+/).slice(1) };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  return { name: parts[0].toLowerCase(), args: parts.slice(1) };
}
