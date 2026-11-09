// Shapes returned by /api/state, plus formatting shared by the UI. No server imports.
import type { RunSummary, SourceEval, Verdict } from "./learning";
import type { Topic } from "./topics";

export type TrustRow = {
  source: string;
  name: string;
  priceUsd: number;
  tries: number;
  avgUsefulness: number | null;
  history: number[];
  lastAt: string | null;
  verdict: Verdict;
};

export type AppState = {
  fixture?: boolean;
  error?: string;
  network: string;
  agent: { address: string; usdc: number | null; url: string };
  seller: { address: string; usdc: number | null; url: string };
  memory: {
    account?: { accountId: string; delegatePublicKey: string };
    error?: string;
    namespace: string;
    stored: number | null;
    readable: number;
    items: (SourceEval & { blobId: string; createdAt?: string; txUrl?: string })[];
  };
  runs: RunSummary[];
  summary: {
    runs: number;
    spentUsd: number;
    buyEverythingUsd: number;
    savedUsd: number;
    wastedFirstRunsUsd: number;
    wastedLaterRunsUsd: number;
    avgFirstRunUsd: number | null;
    avgLaterRunUsd: number | null;
  };
  trust: { topic: Topic; label: string; sources: TrustRow[] }[];
  generatedAt: string;
};

export const usd = (n: number) => `$${n.toFixed(3)}`;
export const short = (s: string, head = 6, tail = 4) => `${s.slice(0, head)}…${s.slice(-tail)}`;
export const walrusBlob = (blobId: string) => `https://walruscan.com/mainnet/blob/${blobId}`;
export const memoryCount = (s: AppState) => s.memory.stored ?? s.memory.readable;

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});
export const when = (iso: string) => `${dateFmt.format(new Date(iso))} UTC`;

export const TOPIC_SHORT: Record<Topic, string> = {
  network: "Network",
  staking: "Staking",
  token: "Tokens",
  wallet: "Wallets",
};
