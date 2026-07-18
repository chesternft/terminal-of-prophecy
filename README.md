<div align="center">

# 🔮 Terminal of Prophecy

### **Ask the chain. Receive your fate.**

A phosphor terminal that reads a wallet's public transaction history, computes
six things about how it was used, and delivers a verdict in the voice of a
machine that has read too many ledgers and formed opinions about all of them.

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)
![Edge](https://img.shields.io/badge/runtime-edge-black)
![Tests](https://img.shields.io/badge/tests-126_passing-2ea043)
![License](https://img.shields.io/badge/license-MIT-green)

```
  ╔══════════════════════════════════════════╗
  ║      T E R M I N A L   O F               ║
  ║              P R O P H E C Y             ║
  ╚══════════════════════════════════════════╝
     Ask the chain. Receive your fate.

  ENTERTAINMENT ONLY. NOT FINANCIAL ADVICE.
  The oracle reads public history. It does not know the future.
```

</div>

---

## Table of contents

- [What it is](#what-it-is)
- [Quick start](#quick-start)
- [Commands](#commands)
- [The line this whole thing is drawn on](#the-line-this-whole-thing-is-drawn-on)
- [Architecture](#architecture)
- [The metrics engine](#the-metrics-engine)
- [Archetypes](#archetypes)
- [The two oracles](#the-two-oracles)
- [The API route](#the-api-route)
- [Prompt-injection defence](#prompt-injection-defence)
- [The CRT](#the-crt)
- [Testing](#testing)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Accessibility](#accessibility)
- [Roadmap](#roadmap)
- [FAQ](#faq)
- [What this isn't](#what-this-isnt)
- [License](#license)

---

## What it is

You paste a wallet address into a CRT terminal. It boots, scans, prints a readout
of six computed metrics — wallet age, diamond hands, gas burned, night-owl share,
recklessness, longest silence — assigns you an archetype (THE GHOST, THE ARSONIST,
THE INSOMNIAC, THE MONK…), and then delivers a short, dramatic, deadpan prophecy
about your on-chain past.

The metrics are **arithmetic**. The prophecy is **theatre**. Neither predicts
anything, and that separation is enforced everywhere in the codebase — see
[the line this whole thing is drawn on](#the-line-this-whole-thing-is-drawn-on).

It runs with **zero configuration**. No API keys, no explorer account, no `.env`.
On a fresh clone it boots on seeded demo wallets and an offline oracle — a
complete experience, just a less surprising one than the AI version.

---

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/terminal-of-prophecy.git
cd terminal-of-prophecy
npm install
npm run dev
```

Open the URL, wait for the boot sequence, paste an address. That's it.

| Script | Does |
| --- | --- |
| `npm run dev` | Start the dev server with HMR |
| `npm run build` | Type-check, then produce a static build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Watch mode |
| `npm run typecheck` | `tsc --noEmit`, no build |

**Requirements:** Node 18+. No global tooling, no native modules, no dependencies
beyond React and Vite.

---

## Commands

| Command | Does |
| --- | --- |
| `/scan <address>` | Read a wallet and receive its verdict |
| `/help` | List commands |
| `/about` | What this is |
| `/clear` | Wipe the screen |
| `/amber` · `/green` | Switch phosphor. Real terminals shipped both. |

Pasting a bare address runs `/scan` — because that's what you meant. Arrow keys
walk your command history, exactly as a terminal should.

**There are more commands. They aren't in `/help`. That's the point.** The oracle
rewards curiosity; a handful of hidden incantations respond to the things people
type into a crypto terminal at 2am.

```ts
// commands.ts — a command is data: a name, help text, and args → lines
export interface Command {
  name: string;
  description: string;
  hidden?: boolean;   // hidden commands don't appear in /help
  run: (args: string[], ctx: CommandContext) => CommandResult;
}
```

The terminal knows how to *run* a command and nothing about what any of them
*do*, which is why adding one is a single entry in an array and zero component
edits.

---

## The line this whole thing is drawn on

> Real wallet data plus a confident voice is exactly the combination that reads
> as *knowing something*. Someone screenshots it; someone else acts on it.

So the oracle describes what **already happened**, in a ridiculous voice, and it
never forecasts a price, suggests a trade, or names anything buyable. This isn't
a disclaimer bolted on top — it's enforced in **four independent places**, any one
of which would catch a violation the others missed:

1. **The system prompt** forbids it in the strongest terms the model gets.
2. **The output is checked** against a forbidden-pattern list; anything that
   reads as advice is dropped, not shipped.
3. **The offline composer literally cannot** produce advice — it assembles from
   templates that contain none.
4. **Tests assert** that 60 generated prophecies and every command's output
   contain no price calls or trade suggestions.

```ts
// The system prompt's absolute rules (api/prophecy.ts)
// - NEVER predict a price, a return, or a market direction.
// - NEVER suggest buying, selling, holding, or entering any position.
// - NEVER name a specific token, coin, protocol, or project as an opportunity.
// - You are describing a wallet's PAST. The prophecy is theatre about history.
```

The disclaimer itself is a **boot line**, not a footer or a modal:

```ts
// boot.ts
{ kind: "error", text: "  ENTERTAINMENT ONLY. NOT FINANCIAL ADVICE.", delay: 260 },
{ kind: "dim",   text: "  The oracle reads public history. It does not know the future." },
```

Nobody reads footers and everybody dismisses modals. A line in the boot sequence
gets read once, by everyone, in character, without asking for a click. It's the
only honest place to put it. There's a test asserting it's there and that it's an
`error`-styled line, so nobody can quietly demote it to decoration.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  CRT terminal  (boot · scrollback · typewriter · prompt)        │
│      │                                                          │
│      │  read a line → run it → print the result                 │
│      ▼                                                          │
│  commands.ts   ── a command is data; the loop knows only "scan" │
│      │                                                          │
│      │  /scan                                                   │
│      ▼                                                          │
│  ╔═══════════════════════════════════════════════════════════╗ │
│  ║  PURE ANALYSIS  (no clock, no network, no randomness)      ║ │
│  ║    chain.ts     validate + flatten explorer responses      ║ │
│  ║    metrics.ts   6 metrics, 8 archetypes — arithmetic       ║ │
│  ║    demo.ts      seeded fake wallets so the repo just runs   ║ │
│  ╚═══════════════════════════════════════════════════════════╝ │
│      │                                                          │
│      ▼                                                          │
│  useProphecy  ── try the model, fall back to the local oracle   │
│      │                                                          │
│      ├──────────────▶  api/prophecy.ts  (edge · validated · AI) │
│      └──────────────▶  prophecy.ts      (offline · templated)   │
└───────────────────────────────────────────────────────────────┘
```

The important boundary is between **analysis** and **narration**. Everything in
`metrics.ts` is pure: same wallet in, same numbers out, no clock, no network, no
randomness. `now` is a *parameter*, not a `Date.now()` call — wallet age depends
on the wall clock, so the clock comes in through the front door where a test can
control it. Everything above that line is theatre; nothing below it guesses.

<details>
<summary><b>Full module map</b></summary>

```
Analysis (pure, deterministic, framework-free)
  types.ts       The shape of a wallet, its metrics, the terminal
  metrics.ts     6 metrics, 8 archetypes. now is a parameter, never a call
  chain.ts       Address validation + Etherscan/Solana adapters
  demo.ts        Seeded fake wallets — the repo runs with no keys
  prophecy.ts    The offline oracle. Templates, seeded, advice-proof
  format.ts      Numbers → terminal text. ASCII bars, padding
  boot.ts        The boot sequence, as data

Terminal & React
  useTerminal.ts   Terminal state, as a reducer
  useTypewriter.ts One interval, not one timer per character
  useProphecy.ts   Ask the model, fall back to the local oracle
  useKeystrokes.ts WebAudio keyclicks, muted by default
  Terminal.tsx     The loop: read a line, run it, print
  Line.tsx         One line — the typewriter lives here, not on the scrollback
  App.tsx / main.tsx / styles.css

Server
  api/prophecy.ts  The only server. Validates, rebuilds, rate-limits, calls model
```

</details>

---

## The metrics engine

Six pure functions over a normalised transaction list. Each describes behaviour
that already happened; none predicts. A sample of the reasoning that went into
them:

```ts
// metrics.ts — the median, deliberately, not the mean
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
```

Why the median? One wallet that has held a bag since 2017 would drag a churning
account's *mean* hold into diamond-hand territory. The median describes the
typical behaviour, which is the honest signal.

| Metric | What it reads | A deliberate choice |
| --- | --- | --- |
| **Wallet age** | First tx → now | `now` is injected, so age is testable |
| **Diamond hands** | Median inflow→outflow hold | Median, not mean (see above) |
| **Gas burned** | Total fees | Failed txs **included** — the gas is gone either way |
| **Night owl** | Share of activity 00:00–05:00 | **UTC** — a wallet has no timezone; guessing one is worse |
| **Recklessness** | Revert rate | — |
| **Longest silence** | Biggest gap between txs | — |

Every unbounded quantity is squashed onto 0–100 with a saturating curve, so there
are no arbitrary maximums pretending to exist:

```ts
// A saturating map: `soft` scores 50, the curve approaches but never reaches 100.
export function saturate(value: number, soft: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(99, Math.round((value / (value + soft)) * 100));
}
```

> The `Math.min(99, …)` is there because the curve genuinely never reaches 100,
> but `Math.round` doesn't care about asymptotes. A wallet scoring a full 100
> would be claiming a maximum that doesn't exist for an unbounded quantity. This
> was a real bug the test suite caught — the docstring promised "never 100" while
> the code rounded to 100 at the extremes.

---

## Archetypes

Eight verdicts, chosen by a **first-match-wins** rule list. Order matters: the
specific and interesting sit above the general and dull, and the fallback sits
last so it can't eat every other verdict.

```ts
// metrics.ts — the ordering IS the logic
const ARCHETYPE_RULES = [
  { id: "ghost",     title: "THE GHOST",     when: (m) => m.drought >= 60 && m.age >= 40 },
  { id: "arsonist",  title: "THE ARSONIST",  when: (m) => m.gas >= 55 },
  { id: "insomniac", title: "THE INSOMNIAC", when: (m) => m.nightowl >= 40 },
  { id: "gambler",   title: "THE GAMBLER",   when: (m) => m.reckless >= 15 && m.diamond < 40 },
  { id: "monk",      title: "THE MONK",      when: (m) => m.diamond >= 60 && m.reckless < 10 },
  { id: "elder",     title: "THE ELDER",     when: (m) => m.age >= 70 },
  { id: "churner",   title: "THE CHURNER",   when: (m) => m.diamond < 25 && m.drought < 20 },
  { id: "tourist",   title: "THE TOURIST",   when: () => true },  // fallback, last
];
```

`THE TOURIST` matches everything, so it must come last — a fallback that fires
early would swallow every other archetype. There's a test that walks the metric
space and confirms every archetype is reachable and every one has a title and a
summary.

---

## The two oracles

The terminal always speaks. It has two implementations of the oracle and falls
through from one to the other on any failure — no key, rate-limited, network
down, model refused. And it tells you which one spoke.

```ts
// useProphecy.ts — the model first, the local composer as the safety net
const response = await fetch("/api/prophecy", { method: "POST", /* … */ });
if (!response.ok) return { ...local(), reason: body.error ?? `HTTP ${response.status}` };
const body = await response.json();
if (!body.prophecy) return { ...local(), reason: "empty response" };
return { text: body.prophecy, source: "model" };
// …any throw (e.g. no /api route in dev) → local()
```

The offline composer is **deterministic** — seeded by the wallet address — so the
same wallet always gets the same fate. That makes offline mode read like a lookup
rather than a random generator, and it makes the tests trivially reproducible.

```ts
// prophecy.ts — the standout metrics are the two furthest from the middle
export function standoutMetrics(metrics: Metric[], count = 2): Metric[] {
  return [...metrics]
    .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
    .slice(0, count);
}
```

> In development there is no `/api` route at all unless `vercel dev` is running,
> so the offline fallback isn't an edge case you'll hit in production someday —
> it's the path you're on right now.

---

## The API route

One function, on a server, for one reason: **the key.** A client-side model call
ships your API key to everyone with devtools, and no amount of obfuscation
changes that. Runs on the edge; a standard `Request` → `Response` handler.

It does four things before the model sees anything:

```ts
// api/prophecy.ts
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 400;
const RATE_LIMIT = 8;          // requests per minute, per IP
const RATE_WINDOW_MS = 60_000;

// 1. VALIDATE — address against a pattern, chain against a set, metric ids
//    against a fixed allowlist.
const ADDRESS_PATTERN = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;
const KNOWN_METRICS = new Set(["age","diamond","gas","nightowl","reckless","drought"]);

// 2. REBUILD, don't forward (see next section).
// 3. RATE LIMIT — sliding window, per IP.
// 4. CHECK THE OUTPUT — a prompt is a request, not a guarantee.
```

If the model produces something that reads as advice, the route **drops it** and
returns `offline: true`, and the client falls back to the local oracle — which
can't produce advice by construction:

```ts
const FORBIDDEN = [
  /\bprice target\b/i,
  /\bwill (?:moon|pump|dump|10x|100x)\b/i,
  /\byou should (?:buy|sell|short|long|ape)\b/i,
  /\bfinancial advice\b/i,
  /\bguaranteed?\s+(?:return|profit|gain)/i,
];
export function looksLikeAdvice(text: string): boolean {
  return FORBIDDEN.some((p) => p.test(text));
}
```

**Rate-limit caveat, stated honestly:** the window lives in per-isolate memory, so
on an edge deployment the true ceiling is `RATE_LIMIT` × live instances. It stops
a loop in a browser tab; it does not stop a determined person. For a hard ceiling,
put Upstash Redis behind it.

---

## Prompt-injection defence

The route **rebuilds the report field-by-field from known keys** rather than
forwarding what the client sent. This is the difference between a prompt that can
be hijacked and one that can't: a metric `note` full of *"ignore all previous
instructions"* never reaches the model, because the route only copies known
fields and truncates every string to a fixed length.

```ts
// api/prophecy.ts — reconstruct, don't pass through
metrics.push({
  id: metric.id,                                   // must be in KNOWN_METRICS
  label: String(metric.label ?? "").slice(0, 24),
  score: Math.max(0, Math.min(100, Math.round(metric.score))),  // clamped
  display: String(metric.display ?? "").slice(0, 48),
  note: String(metric.note ?? "").slice(0, 120),   // truncated → no room to inject
});
```

The test suite fires an 1,800-character injection at a metric note and asserts it
comes out ≤ 120 characters, and confirms the rebuilt object has *exactly* the
known keys and nothing the client smuggled in.

| Attack | Result |
| --- | --- |
| Unknown metric id | `400 Malformed report` |
| Score of `9999999` | Clamped to `100` |
| 1,800-char injected note | Truncated to 120 chars |
| Extra `evil` fields | Dropped — only known keys survive |
| Model returns advice | Response dropped, client falls back to offline oracle |

---

## The CRT

Green-on-black is the most tired palette in software, and it's used here without
apology because it isn't a mood — it's the subject. This is a *phosphor terminal*,
so it gets the actual behaviour of one, and the difference between a convincing
CRT and a green `<div>` is entirely in the details nobody bothers with:

- **Bloom, not glow.** Phosphor scatters. Text throws light onto the glass at
  *three* radii, not one uniform halo.
- **The screen isn't black.** A powered CRT leaks. The darkest pixel is a very
  dark green — a true `#000` reads as an LCD.
- **Scanlines belong to the glass.** Fixed pitch, above the text, *not* scrolling
  with it. Scanlines that move with content are a texture, not a display.
- **Curvature is faked with light.** A vignette darkening the corners and one
  diagonal glare across the top-left sell the bulging tube better than any
  transform.

```css
/* Three-radius bloom: the tight core, the near scatter, the room glow */
.line {
  text-shadow:
    0 0 1px var(--p-hot),
    0 0 6px var(--p-glow),
    0 0 22px var(--p-glow);
}
```

P1 phosphor is the green. **Amber is P3**, which real terminals shipped as the
easier-on-the-eyes option — which is exactly why it's a *command* (`/amber`), not
a theme picker.

The typewriter uses **one timestamp-driven interval**, not one timer per
character — a 300-character prophecy would otherwise schedule 300 timers, and tab
throttling would turn that into a stutter. One interval, count derived from
elapsed time, so a throttled tab catches up instead of falling behind.

---

## Testing

```bash
npm test
```

**126 tests. No DOM, no mocks, no network.** `now` is injected and the demo
generator is seeded, so everything is deterministic by construction.

```
✓ chain              address detection incl. base58's excluded chars,
                     Etherscan flattening, direction inference, gas attribution
✓ metrics: basics    age, gas, failure rate, largest outflow, NaN safety
✓ metrics: time      night-owl share (UTC, half-open window), busiest hour
✓ metrics: holding   median-not-mean, empty-wallet safety
✓ saturate           soft→50, never 100, monotonic, NaN-safe
✓ archetypes         every archetype reachable, titled, summarised
✓ demo wallet        deterministic per address, varied archetypes, no future txs
✓ offline prophecy   deterministic, names the archetype, never advises (×60)
✓ commands           parsing, hidden vs listed, local address validation
✓ boot sequence      says NOT FINANCIAL ADVICE, as an error line, boots < 4s
✓ terminal reducer   append-only ids, scrollback cap, history dedupe
✓ api: parseRequest  clamps scores, truncates injection, drops unknown fields
✓ api: rateLimited   per-caller windows, recovery
✓ api: looksLikeAdvice  catches advice, leaves prophecies alone
```

The API and advice-detection tests are the ones that matter most — they guard the
promise the whole project makes.

> Two bugs the suite caught during the build: `saturate()` promised in its own
> docstring that it never reaches 100, then rounded to 100 at the extremes — the
> doc was a lie for about an hour. And a test asserting the wrong ordering of
> standout metrics, where the code was right and the test was wrong.

---

## Deployment

```bash
npm i -g vercel
vercel
```

Static build (`dist/`) plus one edge function (`api/prophecy.ts`). Set
`ANTHROPIC_API_KEY` in the project's environment variables. **Without it the site
still works** — every visitor just gets the offline oracle instead of the AI one.

The function is a standard `Request` → `Response` handler, so it ports to
Cloudflare Workers or Deno Deploy by changing the runtime hint.

---

## Configuration

Every variable is optional. With none set, the terminal runs on the offline
oracle and seeded demo wallets — a complete experience.

```bash
# .env.local

# Enables the AI oracle. Without it, /api/prophecy returns 503 and the client
# falls back to the local composer.
ANTHROPIC_API_KEY=

# Enables real wallet lookups instead of seeded demo histories.
ETHERSCAN_API_KEY=
```

| Variable | Missing → | Present → |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Offline templated oracle | AI oracle via edge function |
| `ETHERSCAN_API_KEY` | Seeded demo wallets | Real transaction histories |

---

## Accessibility

The CRT is heavy on effects, so it yields to the reader who's asked the browser to
tone things down:

```css
@media (prefers-reduced-motion: reduce) {
  .crt__scanlines, .line__cursor, .prompt[data-busy] .prompt__sigil { animation: none; }
}
@media (prefers-contrast: more) {
  /* Scanlines and bloom are exactly what a high-contrast reader wants gone. */
  .crt__scanlines, .crt__vignette, .crt__glare { display: none; }
  .line, .prompt__input { text-shadow: none; }
}
```

Keystroke sound is **muted by default** — a page that makes noise before you've
asked it to is a page you close, and browsers suspend an `AudioContext` created
before a user gesture anyway.

---

## Roadmap

- [ ] Real Solana histories (the chain is detected; the adapter is stubbed)
- [ ] "Copy prophecy as image" for the screenshot-native share loop
- [ ] More archetypes and hidden commands
- [ ] A per-wallet permalink so a fate is shareable by URL
- [ ] Redis-backed rate limiting for a hard global ceiling
- [ ] Streaming the prophecy token-by-token into the typewriter

---

## FAQ

**Is this financial advice?** No, and the code goes to unusual lengths to make
sure it can't accidentally become it — see
[the line this whole thing is drawn on](#the-line-this-whole-thing-is-drawn-on).

**Do I need a wallet or a signature?** No. Reading a public address requires no
signature. There's no "connect wallet" button and there never will be — any
oracle that asks you to sign something is not an oracle.

**Does it work without API keys?** Fully. Offline oracle, seeded demo wallets,
every command. Keys upgrade two features and change nothing else.

**Is my address stored?** No. It's used to compute a readout and then forgotten.
The IP is used only as a rate-limit key and is never logged.

**Why is the demo wallet the same every time for one address?** It's seeded from
the address, so offline mode behaves like a lookup rather than a slot machine —
and so the tests are deterministic.

---

## What this isn't

No accounts, no database, no analytics, no wallet connection. Nothing is stored.
The chart of your history is read, a verdict is passed, and then it's gone.

It's a horoscope. Horoscopes are funnier when they're about your past anyway.

---

<div align="center">

**MIT** — see [LICENSE](./LICENSE).

*The metrics are arithmetic. The prophecy is theatre. Neither knows the future.*

</div>
