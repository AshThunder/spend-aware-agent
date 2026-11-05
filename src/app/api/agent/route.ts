import { runAgent } from "@/lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RUNS_PER_HOUR = Number(process.env.RUNS_PER_HOUR ?? "30");
const recentRuns: number[] = [];
let running = false;

export async function POST(request: Request) {
  const { question, budgetUsd } = (await request.json().catch(() => ({}))) as { question?: string; budgetUsd?: number };
  if (!question?.trim()) return Response.json({ error: "question is required" }, { status: 400 });

  const now = Date.now();
  while (recentRuns.length && now - recentRuns[0] > 3600_000) recentRuns.shift();
  if (running) return Response.json({ error: "The agent is busy with another run. Try again in a moment." }, { status: 429 });
  if (recentRuns.length >= RUNS_PER_HOUR) {
    return Response.json({ error: "Hourly run limit reached for this demo wallet." }, { status: 429 });
  }
  running = true;
  recentRuns.push(now);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runAgent(question.trim().slice(0, 300), Number(budgetUsd ?? 0.03), request)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: (err as Error).message }) + "\n"));
      } finally {
        running = false;
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
