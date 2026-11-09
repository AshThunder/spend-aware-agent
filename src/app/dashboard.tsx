"use client";

import { useMemo, useState } from "react";
import { ArrowOut, Check } from "@/components/icons";
import SpendChart from "@/components/spend-chart";
import TrustTable from "@/components/trust-table";
import { sourceName } from "@/lib/catalog";
import type { AgentEvent } from "@/lib/events";
import { TOPICS, parseQuestion } from "@/lib/topics";
import { useAppState } from "@/lib/use-app-state";
import { TOPIC_SHORT, memoryCount, short, usd, walrusBlob, type AppState } from "@/lib/view";

type PlanLine = { id: string; name: string; priceUsd: number; reason: string };
type PlanSide = { buy: PlanLine[]; skip: PlanLine[]; costUsd: number };
type Plan = { topic: keyof typeof TOPICS; memories: number; evaluations: number; withMemory: PlanSide; withoutMemory: PlanSide };

const BUDGETS = [0.01, 0.03, 0.05];

export default function Dashboard({ examples }: { examples: string[] }) {
  const { state, error: stateError, refresh } = useAppState();
  const [question, setQuestion] = useState(examples[0]);
  const [budget, setBudget] = useState(0.03);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());

  const topic = parseQuestion(question).topic;
  const busy = running || planning;

  async function preview() {
    setPlanning(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPlan(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPlanning(false);
    }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const before = state;
    setRunning(true);
    setError(null);
    setEvents([]);
    setPlan(null);
    setChanged(new Set());
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, budgetUsd: budget }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        const parsed = lines.filter(Boolean).map((l) => JSON.parse(l) as AgentEvent);
        if (parsed.length) setEvents((prev) => [...prev, ...parsed]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
      const after = await refresh(true);
      if (before && after) setChanged(diffTrust(before, after, topic));
    }
  }

  const trust = state?.trust.find((t) => t.topic === topic);
  const runId = events.find((e) => e.type === "start")?.type === "start" ? (events[0] as { runId: string }).runId : undefined;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] items-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-[36px] leading-[1.1] font-normal text-ink">Console</h1>
          <p className="max-w-[40rem] text-[14px] leading-[22px] text-secondary">
            A run pays real USDC on Sui mainnet, from the demo agent wallet to the demo seller wallet, never more than the
            budget. The plan preview reads memory and spends nothing.
          </p>
        </header>

        <form onSubmit={run} className="panel flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="question" className="text-[13px] font-medium text-ink">
              Question about Sui
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              required
              maxLength={300}
              className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-[15px] leading-6 text-ink"
            />
            <p className="text-[12px] text-muted">
              Reads as a <span className="text-ink">{TOPICS[topic].label.toLowerCase()}</span> question
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-medium text-ink">Or pick one</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {examples.map((ex) => (
                <Choice key={ex} selected={question === ex} onSelect={() => setQuestion(ex)} name="example">
                  <span className="line-clamp-2 [overflow-wrap:anywhere]">{ex}</span>
                </Choice>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-medium text-ink">Budget for this run</legend>
            <div className="grid grid-cols-3 gap-2 sm:max-w-[360px]">
              {BUDGETS.map((b) => (
                <Choice key={b} selected={budget === b} onSelect={() => setBudget(b)} name="budget" mono>
                  {usd(b)}
                </Choice>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-3 border-t border-line pt-5">
            <button type="submit" disabled={busy} className="btn-primary">
              {running ? "Running on mainnet…" : "Run on mainnet"}
            </button>
            <button type="button" disabled={busy} onClick={preview} className="btn-secondary">
              {planning ? "Reading memory…" : "Preview the plan, free"}
            </button>
          </div>
          {error && (
            <p className="text-[14px] text-bad" role="alert">
              {friendly(error)}
            </p>
          )}
        </form>

        {plan && <PlanCompare plan={plan} />}
        {(events.length > 0 || running) && <Receipt events={events} running={running} />}
      </div>

      <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24" aria-label="Agent memory">
        <div className="panel grid grid-cols-2 gap-4 p-5">
          <div>
            <p className="text-[12px] text-muted">Memories on Walrus</p>
            <p className="font-mono text-[28px] leading-8 text-ink tabular-nums">{state ? memoryCount(state) : "–"}</p>
          </div>
          <div>
            <p className="text-[12px] text-muted">Agent wallet</p>
            <p className="font-mono text-[28px] leading-8 text-ink tabular-nums">
              {state?.agent.usdc == null ? "–" : `$${state.agent.usdc.toFixed(2)}`}
            </p>
          </div>
          {state?.fixture && <p className="col-span-2 text-[12px] text-muted">Local preview with saved snapshot data</p>}
          {stateError && <p className="col-span-2 text-[13px] text-bad">Live data is unavailable: {stateError}</p>}
        </div>

        <div className="panel p-5">
          {trust ? (
            <TrustTable
              label={`What it knows about ${TOPIC_SHORT[topic].toLowerCase()} sources`}
              rows={trust.sources}
              changed={changed}
            />
          ) : (
            <p className="text-sm text-muted">Reading Walrus Memory…</p>
          )}
        </div>

        {state && state.runs.length > 0 && (
          <div className="panel p-5">
            <h2 className="mb-4 text-[15px] font-medium text-ink">Spend per paid run</h2>
            <SpendChart runs={state.runs} highlight={runId} />
          </div>
        )}
      </aside>
    </div>
  );
}

function diffTrust(before: AppState, after: AppState, topic: string) {
  const prev = new Map(before.trust.find((t) => t.topic === topic)?.sources.map((s) => [s.source, s.tries]));
  return new Set(
    (after.trust.find((t) => t.topic === topic)?.sources ?? []).filter((s) => s.tries !== prev.get(s.source)).map((s) => s.source),
  );
}

function friendly(message: string) {
  if (/busy/i.test(message)) return "The agent is finishing another visitor's run. Try again in a few seconds.";
  if (/limit/i.test(message)) return "This demo wallet has hit its hourly run limit. The plan preview still works.";
  return message;
}

function Choice({
  selected,
  onSelect,
  children,
  name,
  mono,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  name: string;
  mono?: boolean;
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] leading-5 transition-colors ${
        selected ? "border-ink bg-ink text-paper" : "border-line bg-paper text-secondary hover:bg-raised hover:text-ink"
      } ${mono ? "justify-center font-mono tabular-nums" : ""}`}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      {selected && <Check className="size-4 shrink-0" />}
      {children}
    </label>
  );
}

function Line({ name, price, muted, struck }: { name: React.ReactNode; price: number; muted?: boolean; struck?: boolean }) {
  return (
    <div className={`flex items-baseline text-[14px] ${muted ? "text-muted" : "text-ink"}`}>
      <span className={struck ? "line-through decoration-1" : ""}>{name}</span>
      <span className="leader" aria-hidden />
      <span className={`font-mono tabular-nums ${struck ? "line-through decoration-1" : ""}`}>{usd(price)}</span>
    </div>
  );
}

function PlanCompare({ plan }: { plan: Plan }) {
  const side = (title: string, note: string, p: PlanSide) => (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-[15px] font-medium text-ink">{title}</h3>
        <p className="text-[12px] text-muted">{note}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {p.buy.map((l) => (
          <li key={l.id}>
            <Line name={l.name} price={l.priceUsd} />
          </li>
        ))}
        {p.skip.map((l) => (
          <li key={l.id} title={l.reason}>
            <Line name={`${l.name}, skipped`} price={l.priceUsd} muted struck />
          </li>
        ))}
      </ul>
      <div className="flex items-baseline border-t border-ink pt-2 text-[15px] font-medium">
        <span>Up to</span>
        <span className="leader" aria-hidden />
        <span className="font-mono tabular-nums">{usd(p.costUsd)}</span>
      </div>
    </div>
  );
  return (
    <section className="panel rise p-5" aria-labelledby="plan-title">
      <h2 id="plan-title" className="text-[13px] text-secondary">
        Plan preview · {TOPICS[plan.topic].label} · read {plan.evaluations} verdicts, spent nothing
      </h2>
      <div className="mt-4 grid gap-8 sm:grid-cols-2">
        {side("With its memory", "What this agent will buy", plan.withMemory)}
        {side("Without memory", "What a fresh agent would buy", plan.withoutMemory)}
      </div>
    </section>
  );
}

function Receipt({ events, running }: { events: AgentEvent[]; running: boolean }) {
  const view = useMemo(() => buildReceipt(events), [events]);
  return (
    <section className="panel rise p-5" aria-labelledby="receipt-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-dashed border-ink/30 pb-3">
        <h2 id="receipt-title" className="text-[15px] font-medium text-ink">
          Receipt{view.start ? ` · ${TOPICS[view.start.topic].label}` : ""}
        </h2>
        {view.start && (
          <p className="font-mono text-[12px] text-muted">
            run {view.start.runId} · budget {usd(view.start.budgetUsd)}
          </p>
        )}
      </div>

      <ol className="flex flex-col" aria-live="polite">
        {view.recall && (
          <li className="border-b border-line py-3 text-[14px] text-secondary">
            Recalled <span className="font-mono text-ink">{view.recall.evaluations}</span> verdicts from Walrus Memory in{" "}
            {(view.recall.ms / 1000).toFixed(1)} s
          </li>
        )}
        {view.lines.map((l) => (
          <li key={l.source} className="flex flex-col gap-1 border-b border-line py-3">
            <div className="flex items-baseline gap-2 text-[14px]">
              <span
                className={`inline-flex h-5 shrink-0 items-center rounded-[4px] px-1.5 font-mono text-[11px] ${
                  l.action === "buy" ? "bg-ink text-paper" : "border border-line text-muted"
                }`}
              >
                {l.action === "buy" ? (l.paid ? "paid" : l.failed ? "failed" : "buying") : "skip"}
              </span>
              <span className={l.action === "buy" ? "text-ink" : "text-muted"}>{l.name}</span>
              <span className="leader" aria-hidden />
              <span className={`font-mono tabular-nums ${l.action === "buy" ? "text-ink" : "text-muted line-through"}`}>
                {usd(l.priceUsd)}
              </span>
            </div>
            <p className="text-[13px] leading-5 text-secondary">{l.reason}</p>
            {l.score && (
              <p className="font-mono text-[12px] leading-5 text-secondary">
                score{" "}
                <span className={l.score.usefulness >= 0.25 ? "text-good-ink" : "text-bad"}>{l.score.usefulness.toFixed(2)}</span>
                {l.score.newFacts.length ? ` · new: ${l.score.newFacts.join(", ")}` : " · nothing new"}
                {l.score.redundantWith ? ` · repeats ${sourceName(l.score.redundantWith)}` : ""}
                {l.paid?.txUrl && (
                  <>
                    {" · "}
                    <a href={l.paid.txUrl} target="_blank" rel="noreferrer" className="link">
                      tx {short(l.paid.tx!, 6, 4)}
                    </a>
                  </>
                )}
              </p>
            )}
            {l.failed && <p className="text-[13px] text-bad">{l.failed}</p>}
          </li>
        ))}
        {view.errors.map((m, i) => (
          <li key={i} className="border-b border-line py-3 text-[14px] text-bad">
            {m}
          </li>
        ))}
        {running && (
          <li className="py-3 font-mono text-[12px] text-muted" role="status">
            {view.answer ? "Writing verdicts to Walrus…" : "Waiting on Sui mainnet…"}
          </li>
        )}
      </ol>

      {view.done && (
        <div className="mt-3 flex flex-col gap-1 border-t border-ink pt-3">
          <Line name={<span className="font-medium">Spent</span>} price={view.done.spentUsd} />
          <Line name="Buying every source" price={view.done.naiveUsd} muted />
          {view.done.naiveUsd > 0 && (
            <p className="text-[13px] text-good-ink">
              Kept {Math.round((1 - view.done.spentUsd / view.done.naiveUsd) * 100)}% of the cost of buying everything
            </p>
          )}
        </div>
      )}

      {view.remembered && (
        <div className="mt-4 rounded-lg bg-raised p-3 text-[13px] leading-5 text-secondary">
          Wrote <span className="text-ink">{view.remembered.count}</span> verdict{view.remembered.count === 1 ? "" : "s"} to
          Walrus Memory{view.remembered.failed ? `, ${view.remembered.failed} failed` : ""}.{" "}
          {view.remembered.blobIds.map((id) => (
            <a key={id} href={walrusBlob(id)} target="_blank" rel="noreferrer" className="link mr-2 font-mono text-[12px]">
              {short(id, 8, 4)} <ArrowOut className="inline size-3" />
            </a>
          ))}
        </div>
      )}

      {view.answer && (
        <div className="mt-4">
          <h3 className="text-[13px] text-muted">Answer</h3>
          <p className="mt-1 text-[15px] leading-6 text-ink">{view.answer}</p>
        </div>
      )}
    </section>
  );
}

type ReceiptLine = {
  source: string;
  name: string;
  priceUsd: number;
  action: "buy" | "skip";
  reason: string;
  paid?: { tx?: string; txUrl?: string };
  score?: { usefulness: number; newFacts: string[]; redundantWith?: string };
  failed?: string;
};

function buildReceipt(events: AgentEvent[]) {
  const lines = new Map<string, ReceiptLine>();
  const errors: string[] = [];
  let start: Extract<AgentEvent, { type: "start" }> | undefined;
  let recall: Extract<AgentEvent, { type: "recall" }> | undefined;
  let done: Extract<AgentEvent, { type: "done" }> | undefined;
  let remembered: Extract<AgentEvent, { type: "remembered" }> | undefined;
  let answer: string | undefined;
  for (const ev of events) {
    switch (ev.type) {
      case "start":
        start = ev;
        break;
      case "recall":
        recall = ev;
        break;
      case "decision":
        lines.set(ev.source, { source: ev.source, name: ev.name, priceUsd: ev.priceUsd, action: ev.action, reason: ev.reason });
        break;
      case "paid": {
        const l = lines.get(ev.source);
        if (l) l.paid = { tx: ev.tx, txUrl: ev.txUrl };
        break;
      }
      case "evaluated": {
        const l = lines.get(ev.source);
        if (l) l.score = { usefulness: ev.usefulness, newFacts: ev.newFacts, redundantWith: ev.redundantWith };
        break;
      }
      case "error": {
        const l = ev.source ? lines.get(ev.source) : undefined;
        if (l) l.failed = ev.message;
        else errors.push(ev.message);
        break;
      }
      case "answer":
        answer = ev.text;
        break;
      case "remembered":
        remembered = ev;
        break;
      case "done":
        done = ev;
        break;
    }
  }
  return { start, recall, lines: [...lines.values()], errors, done, remembered, answer };
}
