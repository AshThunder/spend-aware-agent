// Checks each external dependency in isolation: Tatum Sui gRPC, Walrus Memory, and a full paid agent run.
// Usage: pnpm tsx --env-file=.env.local scripts/smoke.mts [tatum|memory|agent] [baseUrl]
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { MemWal } from "@mysten-incubation/memwal";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { ChannelCredentials } from "@grpc/grpc-js";

const step = process.argv[2] ?? "all";
const base = process.argv[3] ?? "http://localhost:3000";
const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const agent = Ed25519Keypair.fromSecretKey(process.env.AGENT_SECRET_KEY!).toSuiAddress();

async function tatum() {
  const client = new SuiGrpcClient({
    network: "mainnet",
    transport: new GrpcTransport({
      host: "sui-mainnet-grpc.gateway.tatum.io:443",
      channelCredentials: ChannelCredentials.createSsl(),
      meta: { "x-api-key": process.env.TATUM_API_KEY! },
    }),
  });
  const { referenceGasPrice } = await client.getReferenceGasPrice();
  const { balance } = await client.getBalance({ owner: agent, coinType: USDC });
  console.log(`reference gas price ${referenceGasPrice}; agent ${agent} holds ${Number(balance.balance) / 1e6} USDC`);
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

async function agentRun() {
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: process.argv[4] ?? "How healthy is the Sui network right now?", budgetUsd: 0.03 }),
  });
  console.log(await res.text());
}

const steps: Record<string, () => Promise<void>> = { tatum, memory, agent: agentRun };
for (const [name, fn] of Object.entries(steps)) {
  if (step !== "all" && step !== name) continue;
  console.log(`\n== ${name}`);
  try {
    await fn();
  } catch (err) {
    console.error(`${name} failed:`, err);
  }
}
process.exit(0);
