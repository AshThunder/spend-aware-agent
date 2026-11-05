import "server-only";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export type SuiNetwork = "sui:mainnet" | "sui:testnet";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const NETWORK = (process.env.SUI_NETWORK ?? "sui:mainnet") as SuiNetwork;
export const IS_MAINNET = NETWORK === "sui:mainnet";

export const USDC_COIN_TYPE = IS_MAINNET
  ? "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC"
  : "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

export const TATUM_RPC_URL = IS_MAINNET
  ? "https://sui-mainnet.gateway.tatum.io"
  : "https://sui-testnet.gateway.tatum.io";

export const FACILITATOR_URL = process.env.X402_FACILITATOR_URL ?? "https://facilitator.tentaclepay.com";

export const MEMWAL_RELAYER_URL = process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz";
export const MEMWAL_NAMESPACE = process.env.MEMWAL_NAMESPACE ?? "spend-aware-agent";

export const MAX_RUN_BUDGET_USD = Number(process.env.MAX_RUN_BUDGET_USD ?? "0.05");

export function explorerTx(digest: string) {
  return IS_MAINNET ? `https://suivision.xyz/txblock/${digest}` : `https://testnet.suivision.xyz/txblock/${digest}`;
}

export function explorerAccount(address: string) {
  return IS_MAINNET ? `https://suivision.xyz/account/${address}` : `https://testnet.suivision.xyz/account/${address}`;
}

export const tatumApiKey = () => required("TATUM_API_KEY");

export const agentKeypair = () => Ed25519Keypair.fromSecretKey(required("AGENT_SECRET_KEY"));

export function sellerAddress(): string {
  if (process.env.SELLER_ADDRESS) return process.env.SELLER_ADDRESS;
  return Ed25519Keypair.fromSecretKey(required("SELLER_SECRET_KEY")).toSuiAddress();
}

export function appUrl(request?: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}
