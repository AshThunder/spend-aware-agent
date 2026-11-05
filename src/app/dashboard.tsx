"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/events";
import type { Topic } from "@/lib/topics";

type CatalogItem = { id: string; name: string; priceUsd: number; topics: Topic[]; pitch: string };
type Stats = { source: string; tries: number; avgUsefulness: number; avgPaid: number; lastAt: string };
type State = {
  network: string;
  agent: { address: string; usdc: number | null; url: string };
  seller: { address: string; usdc: number | null; url: string };
  memory: {
    error?: string;
    total: number;
    recent: { text: string; blobId: string; createdAt?: string }[];
    ledger: Record<string, Stats[]>;
  };
};

const usd = (n: number) => `$${n.toFixed(3)}`;
const short = (s: string, n = 6) => `${s.slice(0, n + 2)}…${s.slice(-4)}`;
const walruscan = (blobId: string) => `https://walruscan.com/mainnet/blob/${blobId}`;

export default function Dashboard({ catalog, examples }: { catalog: CatalogItem[]; examples: string[] }) {
  const [question, setQuestion] = useState(examples[0]);
  const [budget, setBudget] = useState(0.03);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const logEnd = useRef<HTMLLIElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest" });
  }, [events]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    setEvents([]);
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
      refresh();
    }
  }

  const start = events.find((e) => e.type === "start");
  const answer = events.find((e) => e.type === "answer");
  const done = events.find((e) => e.type === "done");
  const activeTopic = start?.type === "start" ? start.topic : undefined;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Total Recall · Smart Agents</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Spend-Aware Agent</h1>
          <p className="mt-3 text-muted">
            A research agent that pays for Sui data per request with <b className="text-ink">x402</b>, judges what
            each purchase was worth, and stores the verdict in <b className="text-ink">Walrus Memory</b>. Next time it
            stops paying for sources that did not deliver.
          </p>
        </div>
        <WalletCard state={state} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section aria-labelledby="ask" className="flex flex-col gap-6">
          <form onSubmit={run} className="rounded-xl border border-line bg-panel p-5">
            <h2 id="ask" className="text-sm font-medium text-muted">
              Ask the agent
            </h2>
            <label htmlFor="question" className="sr-only">
              Question
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              required
              maxLength={300}
              className="mt-3 w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setQuestion(ex)}
                  className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink"
                >
                  {ex.length > 48 ? ex.slice(0, 46) + "…" : ex}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted">
                Budget
                <select
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="rounded-md border border-line bg-bg px-2 py-1 text-ink"
                >
                  <option value={0.01}>$0.010</option>
                  <option value={0.03}>$0.030</option>
                  <option value={0.05}>$0.050</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={running}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
              >
                {running ? "Agent is working…" : "Run agent"}
              </button>
            </div>
          </form>

          {(events.length > 0 || error) && (
            <div className="rounded-xl border border-line bg-panel p-5">
              <h2 className="text-sm font-medium text-muted">Live run</h2>
              <ol className="mt-3 flex flex-col gap-2 font-mono text-[13px]" aria-live="polite">
                {events.map((ev, i) => (
                  <EventRow key={i} ev={ev} catalog={catalog} />
                ))}
                {running && <li className="text-muted">…</li>}
                <li ref={logEnd} aria-hidden />
              </ol>
              {error && <p className="mt-3 text-sm text-bad">{error}</p>}
            </div>
          )}

          {answer?.type === "answer" && (
            <div className="rounded-xl border border-accent/40 bg-panel p-5">
              <h2 className="text-sm font-medium text-accent">Answer</h2>
              <p className="mt-2 leading-relaxed">{answer.text}</p>
              {done?.type === "done" && <SpendSummary done={done} />}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <Ledger state={state} catalog={catalog} highlight={activeTopic} />
          <Memories state={state} />
          <Catalog catalog={catalog} />
        </aside>
      </div>

      <footer className="mt-12 border-t border-line pt-6 text-xs text-muted">
        Data: Tatum Sui gRPC gateway · Payments: x402 exact scheme on {state?.network ?? "sui:mainnet"} via the Tentacle Pay
        facilitator · Memory: Walrus Memory (mainnet relayer). Every purchase is a real USDC transfer.
      </footer>
    </main>
  );
}

function WalletCard({ state }: { state: State | null }) {
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-panel p-4 text-sm">
      <div>
        <dt className="text-muted">Agent wallet</dt>
        <dd className="font-mono">
          {state ? (
            <a href={state.agent.url} target="_blank" rel="noreferrer" className="hover:text-accent">
              {state.agent.usdc === null ? "–" : `${state.agent.usdc.toFixed(4)} USDC`}
            </a>
          ) : (
            "…"
          )}
        </dd>
      </div>
      <div>
        <dt className="text-muted">Data sellers earned</dt>
        <dd className="font-mono">
          {state ? (
            <a href={state.seller.url} target="_blank" rel="noreferrer" className="hover:text-accent">
              {state.seller.usdc === null ? "–" : `${state.seller.usdc.toFixed(4)} USDC`}
            </a>
          ) : (
            "…"
          )}
        </dd>
      </div>
      <div className="col-span-2">
        <dt className="text-muted">Memories on Walrus</dt>
        <dd className="font-mono">{state ? state.memory.total : "…"}</dd>
      </div>
    </dl>
  );
}

function EventRow({ ev, catalog }: { ev: AgentEvent; catalog: CatalogItem[] }) {
  const name = (id: string) => catalog.find((c) => c.id === id)?.name ?? id;
  switch (ev.type) {
    case "start":
      return (
        <li className="text-muted">
          run {ev.runId} · topic <span className="text-ink">{ev.topic}</span> · budget {usd(ev.budgetUsd)}
        </li>
      );
    case "recall":
      return (
        <li>
          <span className="text-accent">recall</span> {ev.evaluations} past evaluations from Walrus Memory ({ev.ms} ms)
        </li>
      );
    case "decision":
      return (
        <li>
          <span className={ev.action === "buy" ? "text-accent" : "text-warn"}>{ev.action === "buy" ? "buy " : "skip"}</span>{" "}
          <span className="text-ink">{ev.name}</span> <span className="text-muted">{usd(ev.priceUsd)}</span>
          <div className="pl-10 text-muted">{ev.reason}</div>
        </li>
      );
    case "paid":
      return (
        <li className="pl-10 text-muted">
          paid {usd(ev.priceUsd)} via x402 ·{" "}
          {ev.txUrl ? (
            <a href={ev.txUrl} target="_blank" rel="noreferrer" className="text-ink underline decoration-line hover:text-accent">
              tx {short(ev.tx!)}
            </a>
          ) : (
            "settled"
          )}{" "}
          · {ev.ms} ms
        </li>
      );
    case "evaluated":
      return (
        <li className="pl-10">
          <span className={ev.usefulness >= 0.25 ? "text-accent" : "text-bad"}>usefulness {ev.usefulness.toFixed(2)}</span>
          <span className="text-muted">
            {ev.newFacts.length ? ` · new: ${ev.newFacts.join(", ")}` : " · nothing new"}
            {ev.redundantWith ? ` · overlaps ${name(ev.redundantWith)}` : ""}
          </span>
        </li>
      );
    case "remembered":
      return (
        <li>
          <span className="text-accent">remember</span> {ev.count} evaluation{ev.count === 1 ? "" : "s"} written to Walrus
          {ev.failed ? `, ${ev.failed} failed` : ""} ({ev.ms} ms)
        </li>
      );
    case "error":
      return <li className="text-bad">{ev.source ? `${name(ev.source)}: ` : ""}{ev.message}</li>;
    case "answer":
    case "done":
      return null;
  }
}

function SpendSummary({ done }: { done: Extract<AgentEvent, { type: "done" }> }) {
  const saved = done.naiveUsd > 0 ? 1 - done.spentUsd / done.naiveUsd : 0;
  return (
    <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
      <div>
        <dt className="text-muted">Spent</dt>
        <dd className="font-mono text-lg">{usd(done.spentUsd)}</dd>
      </div>
      <div>
        <dt className="text-muted">Buy-everything cost</dt>
        <dd className="font-mono text-lg">{usd(done.naiveUsd)}</dd>
      </div>
      <div>
        <dt className="text-muted">Saved by memory</dt>
        <dd className="font-mono text-lg text-accent">{Math.round(saved * 100)}%</dd>
      </div>
    </dl>
  );
}

function Ledger({ state, catalog, highlight }: { state: State | null; catalog: CatalogItem[]; highlight?: Topic }) {
  const topics = Object.keys(state?.memory.ledger ?? {});
  return (
    <section className="rounded-xl border border-line bg-panel p-5" aria-labelledby="ledger">
      <h2 id="ledger" className="text-sm font-medium text-muted">
        What the agent has learned
      </h2>
      {state?.memory.error && <p className="mt-2 text-sm text-bad">{state.memory.error}</p>}
      {state && topics.length === 0 && !state.memory.error && (
        <p className="mt-2 text-sm text-muted">No memories yet. The first run explores every source once.</p>
      )}
      <div className="mt-3 flex flex-col gap-4">
        {topics.map((topic) => (
          <div key={topic} className={highlight === topic ? "" : "opacity-80"}>
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted">{topic}</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {state!.memory.ledger[topic]
                .sort((a, b) => b.avgUsefulness - a.avgUsefulness)
                .map((s) => (
                  <li key={s.source} className="grid grid-cols-[1fr_5rem_3.5rem] items-center gap-2 text-sm">
                    <span>{catalog.find((c) => c.id === s.source)?.name ?? s.source}</span>
                    <span className="h-1.5 overflow-hidden rounded bg-line" aria-hidden>
                      <span
                        className={`block h-full ${s.avgUsefulness >= 0.25 ? "bg-accent" : "bg-bad"}`}
                        style={{ width: `${Math.max(4, s.avgUsefulness * 100)}%` }}
                      />
                    </span>
                    <span className={`text-right font-mono text-xs ${s.avgUsefulness >= 0.25 ? "text-accent" : "text-bad"}`}>
                      {s.avgUsefulness >= 0.25 ? "keep" : "skip"} ×{s.tries}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Memories({ state }: { state: State | null }) {
  if (!state?.memory.recent.length) return null;
  return (
    <section className="rounded-xl border border-line bg-panel p-5" aria-labelledby="memories">
      <h2 id="memories" className="text-sm font-medium text-muted">
        Latest memories (Walrus mainnet)
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {state.memory.recent.slice(0, 6).map((m) => (
          <li key={m.blobId} className="font-mono text-[11px] leading-snug text-muted">
            <span className="text-ink">{m.text.replace("[source-eval] ", "").split(" tx=")[0]}</span>
            <br />
            <a href={walruscan(m.blobId)} target="_blank" rel="noreferrer" className="hover:text-accent">
              blob {short(m.blobId, 8)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Catalog({ catalog }: { catalog: CatalogItem[] }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5" aria-labelledby="catalog">
      <h2 id="catalog" className="text-sm font-medium text-muted">
        Paid data sources (x402)
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {catalog.map((c) => (
          <li key={c.id} className="flex items-baseline justify-between gap-3">
            <span>
              {c.name} <span className="text-xs text-muted">· {c.topics.join(", ")}</span>
            </span>
            <span className="font-mono text-muted">{usd(c.priceUsd)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
