import { previewPlan } from "@/lib/agent";

export const dynamic = "force-dynamic";

// Free dry run: shows what the agent would buy with and without its Walrus Memory. No payment is made.
export async function POST(request: Request) {
  const { question } = (await request.json().catch(() => ({}))) as { question?: string };
  if (!question?.trim()) return Response.json({ error: "question is required" }, { status: 400 });
  try {
    return Response.json(await previewPlan(question.trim().slice(0, 300)));
  } catch (err) {
    return Response.json({ error: `Walrus Memory could not be read: ${(err as Error).message}` }, { status: 503 });
  }
}
