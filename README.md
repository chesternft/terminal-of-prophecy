# Terminal of Prophecy

**Ask the chain. Receive your fate.**

![React 18](https://img.shields.io/badge/react-18-61dafb)
![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6)
![Tests](https://img.shields.io/badge/tests-126-2ea043)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

A phosphor terminal that reads a wallet's public transaction history, computes
six things about how it was used, and delivers a verdict in the voice of a
machine that has read too many ledgers and formed opinions about all of them.

> ENTERTAINMENT ONLY. NOT FINANCIAL ADVICE.
> The oracle reads public history. It does not know the future.

---

## Run it

```bash
npm install
npm run dev
```

That's it. No API keys, no explorer account, no `.env`. The terminal boots, you
paste an address, and you get a full readout and a prophecy.

**Wallet histories are simulated until you add an explorer key**, and the
terminal says so, on screen, every time. The demo generator is seeded from the
address, so the same wallet always produces the same history — it behaves like a
lookup, not a slot machine.

To turn on the real thing, copy `.env.example` to `.env.local`:

| Variable | Gets you |
| --- | --- |
| `ANTHROPIC_API_KEY` | The AI oracle instead of the offline composer |
| `ETHERSCAN_API_KEY` | Real wallet histories instead of seeded demo data |

Both optional, independently. Missing either degrades one feature and nothing
else — see *Failure is the normal path* below.

## Commands

| Command | Does |
| --- | --- |
| `/scan <address>` | Read a wallet and receive its verdict |
| `/help` | List commands |
| `/about` | What this is |
| `/clear` | Wipe the screen |
| `/amber` · `/green` | Switch phosphor. Real terminals shipped both. |

Pasting a bare address runs `/scan`, because that's what it meant. Arrow keys
walk your history.

There are more commands. They aren't in `/help`. That's the point.

## How it's built

Every file sits at the repository root except the one function, which Vercel
requires at `api/`.

```
types.ts          The shape of a wallet, its metrics, and the terminal.
metrics.ts        The arithmetic. Six metrics, eight archetypes. Pure.
chain.ts          Address validation and explorer adapters.
demo.ts           Seeded fake wallets, so the repo runs with no keys.
prophecy.ts       The offline oracle. Templates, seeded.
commands.ts       The command registry. Commands are data.
format.ts         Numbers into terminal text. ASCII bars.
boot.ts           The boot sequence, as data.

useTerminal.ts    Terminal state, as a reducer.
useTypewriter.ts  One interval, not one timer per character.
useProphecy.ts    Asks the model, falls back to the local oracle.
useKeystrokes.ts  WebAudio keyclicks. Muted by default.

Terminal.tsx      The loop: read a line, run it, print the result.
Line.tsx          One line. The typewriter lives here, not on the scrollback.
styles.css        The CRT.

api/prophecy.ts   The only server. Validates, rate limits, calls the model.
```

### The metrics are arithmetic, the prophecy is theatre

That separation is the whole architecture. `metrics.ts` is pure: same wallet in,
same numbers out, no clock, no network, no randomness. `now` is a parameter
rather than a `Date.now()` call — wallet age depends on the wall clock, so the
clock comes in through the front door where a test can control it.

Everything above that line is narration. Nothing below it guesses.

Six metrics: **wallet age**, **diamond hands** (median hold, not mean — one 2017
bag would otherwise drag a churner's average into diamond territory), **gas
burned** (failed transactions included; the gas is gone either way), **night
owl** (UTC, because a wallet doesn't have a timezone and guessing one is worse
than admitting the readout is UTC), **recklessness** (revert rate), and
**longest silence**.

Then eight archetypes — THE GHOST, THE ARSONIST, THE INSOMNIAC, THE MONK — from
a rule list where the first match wins, so specific-and-interesting sits above
general-and-dull. THE TOURIST is last because it's the fallback, and a fallback
that fires early eats every other verdict.

### Failure is the normal path

The oracle has two implementations and the terminal always speaks. No key, rate
limited, network down, model refused — every one of them falls through to the
local composer, and the terminal tells you which oracle spoke and why.

In development there is no `/api` route at all unless `vercel dev` is running,
so the fallback isn't an edge case you'll hit in production someday. It's the
path you're on right now.

### The API route

One function, on a server, for one reason: the key. A client-side model call
ships your API key to everyone with devtools, and no amount of obfuscation
changes that.

It does four things before the model sees anything:

- **Validates.** Address against a pattern, chain against a set, metric ids
  against a fixed list.
- **Rebuilds rather than forwards.** The report is reconstructed field by field
  from known keys and every string is truncated, so a metric note cannot carry
  `ignore all previous instructions` into the prompt. There's a test that fires
  a 1,800-character injection at it.
- **Rate limits.** Sliding window, per IP. Honest caveat: the Map is
  per-isolate, so the real ceiling is the limit times the number of live
  instances. It stops a loop in a browser tab. It does not stop a determined
  person, and it isn't meant to — put Upstash Redis behind it if you need a real
  ceiling.
- **Checks the output.** A prompt is a request, not a guarantee. If the model
  produces something that reads as advice, the route drops it and falls back to
  the local oracle, which cannot say those things by construction.

## The line this thing is drawn on

Real wallet data plus a confident voice is exactly the combination that reads as
*knowing something*. Someone screenshots it; someone else acts on it.

So the oracle describes what **already happened**, in a ridiculous voice, and it
does not forecast, advise, or name anything buyable. The system prompt forbids
it, the response is checked against it, the offline composer can't do it, and
there are tests asserting that 60 generated prophecies and every command's
output contain no price calls or trade suggestions.

The disclaimer is a boot line, not a footer or a modal. Nobody reads footers and
everybody dismisses modals. A line in the boot sequence gets read once by
everyone, in character, without asking for a click.

It's a horoscope. Horoscopes are funnier when they're about your past anyway.

## Design

Green-on-black is the most tired palette in software, and it's used here without
apology because it isn't a mood — it's the subject. This is a phosphor terminal,
so it gets the actual behaviour of one:

- **Bloom, not glow.** Phosphor scatters. Text throws light onto the glass at
  three radii, not one uniform halo.
- **The screen isn't black.** A powered CRT leaks. The darkest pixel is a very
  dark green — true `#000` reads as an LCD.
- **Scanlines belong to the glass.** Fixed pitch, above the text, not scrolling
  with it. Scanlines that move with content are a texture, not a display.
- **Curvature is faked with light.** A vignette and one diagonal glare sell the
  bulging tube better than any transform.

P1 phosphor is the green. Amber is P3, which real terminals shipped as the
easier-on-the-eyes option — which is why it's a command, not a theme picker.

`prefers-reduced-motion` kills the flicker. `prefers-contrast: more` strips the
scanlines and the bloom entirely, because they're precisely what that reader is
asking the browser to remove.

## Testing

```bash
npm test
```

126 tests, no DOM, no mocks, no network. `now` is injected and the generator is
seeded, so everything is deterministic by construction.

The API tests matter most: validation, rebuilding, and rate limiting are what
has to hold when someone points a script at the endpoint, and all of it is pure,
so all of it is testable without a server.

Two bugs the suite caught during the build, for what it's worth: `saturate()`
promised in its own docstring that it never reaches 100, and then rounded to 100
at the extremes — the doc was a lie for about an hour. And a test asserting the
wrong ordering of standout metrics, where the code was right and the test was
wrong.

## Deploy

```bash
npm i -g vercel
vercel
```

Set `ANTHROPIC_API_KEY` in the project's environment variables. Without it the
site still works — every visitor just gets the offline oracle.

The function is a standard `Request` in, `Response` out, so it runs on
Cloudflare Workers or Deno Deploy with the runtime hint changed.

## What this isn't

No accounts, no database, no analytics, no wallet connection. Nothing is stored;
addresses are used to compute a readout and then forgotten. The IP is used as a
rate-limit key and never logged.

There's no "connect wallet" button and there never will be. Reading a public
address requires no signature, and any oracle that asks you to sign something is
not an oracle.

## License

MIT — see [LICENSE](LICENSE).
