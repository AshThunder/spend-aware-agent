import type { Topic } from "./topics";

export type AgentEvent =
  | { type: "start"; runId: string; question: string; topic: Topic; budgetUsd: number; agent: string }
  | { type: "recall"; memories: number; evaluations: number; ms: number }
  | {
      type: "decision";
      source: string;
      name: string;
      priceUsd: number;
      action: "buy" | "skip";
      reason: string;
      history?: { tries: number; avgUsefulness: number };
    }
  | { type: "paid"; source: string; priceUsd: number; tx?: string; txUrl?: string; ms: number }
  | { type: "evaluated"; source: string; usefulness: number; newFacts: string[]; redundantWith?: string }
  | { type: "error"; source?: string; message: string }
  | { type: "answer"; text: string; facts: Record<string, unknown> }
  | { type: "remembered"; count: number; blobIds: string[]; failed: number; ms: number }
  | { type: "done"; spentUsd: number; naiveUsd: number; bought: string[]; skipped: string[] };
