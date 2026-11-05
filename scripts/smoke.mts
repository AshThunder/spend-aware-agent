// Checks each external dependency in isolation: Tatum RPC (JSON-RPC + gRPC), Walrus Memory, and an x402 paid call.
// Usage: pnpm tsx --env-file=.env.local scripts/smoke.mts [tatum|grpc|memory|x402] [baseUrl]
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { MemWal } from "@mysten-incubation/memwal";

const step = process.argv[2] ?? "all";
const base = process.argv[3] ?? "http://localhost:3000";
const TATUM = "https://sui-mainnet.gateway.tatum.io";
const agent = Ed25519Keypair.fromSecretKey(process.env.AGENT_SECRET_KEY!).toSuiAddress();

async function tatum() {
  const res = await fetch(TATUM, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.TATUM_API_KEY! },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getLatestCheckpointSequenceNumber", params: [] }),
  });
  console.log("tatum json-rpc:", res.status, await res.text());
}

async function grpc() {
  const client = new SuiGrpcClient({ network: "mainnet", baseUrl: TATUM, meta: { "x-api-key": process.env.TATUM_API_KEY! } });
  const { balances } = await client.listBalances({ owner: agent });
  console.log("tatum grpc balances for agent:", JSON.stringify(balances));
}

async function memory() {
  const mem = MemWal.create({
    key: process.env.MEMWAL_PRIVATE_KEY!,
    accountId: process.env.MEMWAL_ACCOUNT_ID!,
    serverUrl: "https://relayer.memory.walrus.xyz",
    namespace: "smoke-test",
  });
  console.log("health:", await mem.health());
  const t = Date.now();
  const done = await mem.rememberAndWait(`smoke test at ${new Date().toISOString()}`);
  console.log("remembered in", Date.now() - t, "ms:", done);
  const hits = await mem.recall({ query: "smoke test", limit: 3 });
  console.log("recall:", hits.results.map((r) => r.text));
}

async function x402() {
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "How healthy is the Sui network right now?", budgetUsd: 0.03 }),
  });
  console.log(await res.text());
}

const steps: Record<string, () => Promise<void>> = { tatum, grpc, memory, x402 };
for (const [name, fn] of Object.entries(steps)) {
  if (step !== "all" && step !== name) continue;
  console.log(`\n== ${name}`);
  try {
    await fn();
  } catch (err) {
    console.error(`${name} failed:`, err);
  }
}
