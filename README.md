# Spend-Aware Agent

**A research agent that pays for data per request with x402 on Sui, judges what every purchase was worth, and remembers the verdict in Walrus Memory, so it stops paying for sources that don't deliver.**

Built for [Total Recall · Tatum × Walrus Memory Hackathon](https://tatum.io/hackathon/total-recall), track **Smart Agents for Real Life**.

- Live demo: _see submission_
- Blog post: _see submission_
- Demo video: _see submission_

## The problem

Agents are starting to buy things on their own: API calls, data feeds, model inference. Pay-per-request protocols like x402 make that easy. What they don't do is make the agent *careful*. A stateless agent pays for the same redundant or worthless source every single time, because it has no memory of having been burned before.

## What it does

You ask a question about Sui (network health, validators, a token, a wallet). The agent:

1. **Recalls** its past evaluations of every paid data source for that kind of question from Walrus Memory.
2. **Plans** purchases: sources with a good track record first, unknown sources once to learn their value, and sources with a bad track record skipped with an explanation.
3. **Pays** for each purchase with a real USDC micropayment on Sui mainnet through x402 (HTTP `402 Payment Required` → signed payment → settled transaction).
4. **Evaluates** each response: which required facts did it provide that cheaper purchases had not already covered? That marginal usefulness (0–1) is the source's score for this run.
5. **Remembers** one structured evaluation per purchase in Walrus Memory on mainnet, then answers the question.

On the first run of a topic it buys everything relevant (exploration). From the second run on, memory changes its behavior: it buys only what has proven useful and the cost per answer drops by up to ~90%. The ledger in the UI shows what it has learned, and every memory links to its Walrus blob.

### Example: "How healthy is the Sui network right now?"

| Run | Bought | Skipped (from memory) | Spent |
| --- | --- | --- | --- |
| 1 (no memory) | Chain Pulse, Staking Scope, Alpha Wire, Chain Pulse Pro | none | $0.024 |
| 2+ | Chain Pulse | Staking Scope (nothing new), Alpha Wire (no verifiable data), Chain Pulse Pro (duplicates Chain Pulse at 4.5× the price) | $0.002 |

## How it uses Tatum, Walrus and x402

| Piece | Used for |
| --- | --- |
| **Tatum Sui RPC** (`sui-mainnet.gateway.tatum.io`) | All on-chain data sold by the sources (checkpoints, gas price, system state, balances, coin metadata, transactions), the wallet balances shown in the UI, and the gRPC client the agent uses to build its x402 payment transactions. |
| **Walrus Memory** (`@mysten-incubation/memwal`, mainnet relayer) | Long-term memory of source evaluations. `recall` before every run, `rememberBulk` + `waitForRememberJobs` after every run. Memories are stored on Walrus and owned by a Sui account. |
| **x402 on Sui** (`@tentaclepay/sui-x402`, `@x402/next`, `@x402/fetch`) | Each data source is a paywalled Next.js route (`withX402`, settles only after a successful response). The agent pays with `wrapFetchWithPayment`. Settlement goes through the Tentacle Pay facilitator, gas-sponsored, in USDC. |

## Data sources

All sources serve real data from Tatum's Sui RPC except Alpha Wire, which is a deliberately low-signal seller that claims every topic and returns no verifiable data. It exists to prove the agent learns to stop paying for it.

| Source | Price | Topics |
| --- | --- | --- |
| Chain Pulse | $0.002 | network |
| Token Intel | $0.003 | token |
| Wallet X-Ray | $0.004 | wallet |
| Staking Scope | $0.005 | staking, network |
| Alpha Wire | $0.008 | all (decoy) |
| Chain Pulse Pro | $0.009 | network, staking (same data as Chain Pulse plus commentary) |

## Architecture

```
Browser ──POST /api/agent──▶ Agent (src/lib/agent.ts)
                               │  recall ───────────────▶ Walrus Memory relayer ─▶ Walrus + Sui
                               │  pay + GET /api/sources/:id  (x402)
                               │        └─▶ withX402 ─▶ Tentacle Pay facilitator ─▶ Sui mainnet (USDC)
                               │                 └─▶ Tatum Sui RPC (data)
                               │  evaluate marginal usefulness
                               └─ rememberBulk ─────────▶ Walrus Memory
```

- `src/lib/agent.ts`: planning, purchasing, evaluation, memory writes (streams NDJSON events to the UI)
- `src/lib/sources.ts`: the paid data sources (Tatum Sui RPC)
- `src/lib/memory.ts`: Walrus Memory client, evaluation encoding/decoding, aggregation
- `src/app/api/sources/[id]/route.ts`: x402 paywall per source
- `src/lib/x402-client.ts`: the agent's paying fetch (Tatum gRPC for transaction building)

## Run it locally

```bash
pnpm install
pnpm tsx scripts/gen-keys.mts            # creates AGENT_SECRET_KEY and SELLER_SECRET_KEY in .env.local
```

Add to `.env.local`:

```
TATUM_API_KEY=...          # dashboard.tatum.io
MEMWAL_PRIVATE_KEY=...     # delegate key from memory.walrus.xyz
MEMWAL_ACCOUNT_ID=...      # account id from memory.walrus.xyz
```

Fund the agent address with a little USDC on Sui mainnet (no SUI needed; payments are gas-sponsored), then:

```bash
pnpm dev
pnpm tsx --env-file=.env.local scripts/smoke.mts   # checks Tatum, Walrus Memory and a full paid run
```

Optional: `SUI_NETWORK=sui:testnet`, `MAX_RUN_BUDGET_USD` (default 0.05), `RUNS_PER_HOUR` (default 30).

## Limits and honest notes

- Usefulness scoring is deterministic (required facts per topic, marginal over cheaper purchases), not an LLM judge. This keeps the learning loop transparent and reproducible.
- The agent and the sellers are both run by this demo, so the USDC moves between two demo wallets. The payments are nonetheless real mainnet x402 settlements.
- With the default relayer, Walrus Memory's relayer sees memory plaintext. Evaluations contain no personal data.
- The public demo is rate-limited and budget-capped per run.

## License

MIT
