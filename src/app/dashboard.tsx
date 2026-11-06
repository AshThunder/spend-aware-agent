"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AgentEvent } from "@/lib/events";
import { TOPICS, type Topic } from "@/lib/topics";

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

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 3, maximumFractionDigits: 3 });
const short = (s: string, n = 6) => `${s.slice(0, n + 2)}…${s.slice(-4)}`;
const walruscan = (blobId: string) => `https://walruscan.com/mainnet/blob/${blobId}`;

function sourceName(catalog: CatalogItem[], id: string) {
  return catalog.find((c) => c.id === id)?.name ?? id;
}

function parseMemory(text: string) {
  const body = text.replace("[source-eval] ", "");
  const get = (key: string) => body.match(new RegExp(`${key}=(\\S+)`))?.[1] ?? "";
  return {
    source: get("source"),
    topic: get("topic"),
    paid: Number(get("paid_usd")),
    usefulness: Number(get("usefulness")),
  };
}

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
  const log = events.filter((ev) => ev.type !== "answer" && ev.type !== "done");

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-medium leading-6">Console</h1>
        <WalletStrip state={state} />
      </div>

      <form onSubmit={run} className="rounded-lg border border-line bg-panel p-3" aria-labelledby="ask">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <label id="ask" htmlFor="question" className="text-[12px] text-secondary">
              Question
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              required
              maxLength={300}
              className="mt-1 w-full resize-none rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm leading-5 text-ink"
            />
          </div>
          <div className="flex items-center gap-2 sm:w-40 sm:flex-col sm:items-stretch sm:pt-5">
            <label className="flex items-center gap-2 text-[12px] text-secondary sm:flex-col sm:items-stretch">
              Budget
              <select
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="h-8 flex-1 rounded-md border border-line bg-bg px-2 text-[13px] text-ink tabular-nums"
              >
                <option value={0.01}>$0.010</option>
                <option value={0.03}>$0.030</option>
                <option value={0.05}>$0.050</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={running}
              className="h-8 rounded-full bg-accent px-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-ink active:scale-[0.98] disabled:opacity-50 sm:h-9"
            >
              {running ? "Working" : "Run"}
            </button>
          </div>
        </div>
        <div className="mt-2 grid gap-1 md:grid-cols-2">
          {examples.map((ex) => {
            const selected = question === ex;
            return (
              <button
                key={ex}
                type="button"
                onClick={() => setQuestion(ex)}
                aria-pressed={selected}
                className={`rounded-md px-2 py-1 text-left text-[13px] leading-5 transition-colors duration-150 ${
                  selected ? "bg-soft text-ink" : "text-secondary hover:bg-raised hover:text-ink"
                }`}
              >
                {ex}
              </button>
            );
          })}
        </div>
      </form>

      {(log.length > 0 || error || running) && (
        <section className="rounded-lg border border-line bg-panel p-3">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="text-[12px] text-secondary">Run</h2>
            {start?.type === "start" && (
              <p className="font-mono text-[12px] text-muted tabular-nums">
                {start.topic} · {usd(start.budgetUsd)}
              </p>
            )}
          </div>
          <ol aria-live="polite">
            {log.map((ev, i) => (
              <EventRow key={i} ev={ev} catalog={catalog} />
            ))}
            {running && (
              <li className="grid h-7 grid-cols-[4.5rem_1fr] items-center gap-3 text-[13px] text-muted">
                <span className="font-mono text-[12px]">…</span>
                <span>Waiting on the chain</span>
              </li>
            )}
            <li ref={logEnd} aria-hidden />
          </ol>
          {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
        </section>
      )}

      {answer?.type === "answer" && (
        <section className="rounded-lg border border-line bg-raised px-3 py-2.5">
          <h2 className="text-[12px] text-secondary">Answer</h2>
          <p className="mt-1 text-sm leading-5">{answer.text}</p>
          {done?.type === "done" && <SpendSummary done={done} />}
        </section>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <Ledger state={state} catalog={catalog} highlight={activeTopic} />
        <div className="grid gap-3">
          <Memories state={state} catalog={catalog} />
          <Catalog catalog={catalog} />
        </div>
      </div>

    </div>
  );
}

function WalletStrip({ state }: { state: State | null }) {
  const money = (n: number | null | undefined) => (n === null || n === undefined ? "–" : usd(n));
  return (
    <dl className="grid shrink-0 grid-cols-3 gap-4">
      <Stat
        label="Agent wallet"
        value={state ? money(state.agent.usdc) : "…"}
        href={state?.agent.url}
      />
      <Stat
        label="Sellers earned"
        value={state ? money(state.seller.usdc) : "…"}
        href={state?.seller.url}
      />
      <Stat label="Memories" value={state ? String(state.memory.total) : "…"} />
    </dl>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const figure = (
    <dd className="font-mono text-sm tabular-nums text-ink">{value}</dd>
  );
  return (
    <div>
      <dt className="text-[11px] leading-4 text-secondary">{label}</dt>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="hover:text-secondary">
          {figure}
        </a>
      ) : (
        figure
      )}
    </div>
  );
}

function EventRow({ ev, catalog }: { ev: AgentEvent; catalog: CatalogItem[] }) {
  const row = (mark: string, body: ReactNode, tone: "ink" | "muted" = "muted") => (
    <li className="grid min-h-8 grid-cols-[4.5rem_1fr] items-start gap-3 py-1 text-[13px] leading-5">
      <span className={`pt-0.5 font-mono text-xs ${tone === "ink" ? "text-ink" : "text-muted"}`}>{mark}</span>
      <span className="text-secondary">{body}</span>
    </li>
  );

  switch (ev.type) {
    case "start":
      return row("run", <>{ev.runId}</>);
    case "recall":
      return row(
        "recall",
        <>
          {ev.evaluations} past evaluations · {ev.ms.toLocaleString("en-US")} ms
        </>,
      );
    case "decision":
      return row(
        ev.action,
        <>
          <span className="text-ink">{ev.name}</span>{" "}
          <span className="font-mono tabular-nums text-muted">{usd(ev.priceUsd)}</span>
          <span className="mt-0.5 block text-muted">{ev.reason}</span>
        </>,
        ev.action === "buy" ? "ink" : "muted",
      );
    case "paid":
      return row(
        "paid",
        <>
          {usd(ev.priceUsd)}
          {ev.txUrl ? (
            <>
              {" · "}
              <a href={ev.txUrl} target="_blank" rel="noreferrer" className="text-ink underline decoration-line underline-offset-2">
                tx {short(ev.tx!)}
              </a>
            </>
          ) : null}{" "}
          · {ev.ms.toLocaleString("en-US")} ms
        </>,
      );
    case "evaluated":
      return row(
        "score",
        <>
          <span className="font-mono tabular-nums text-ink">{ev.usefulness.toFixed(2)}</span>
          {ev.newFacts.length ? ` · new ${ev.newFacts.join(", ")}` : " · nothing new"}
          {ev.redundantWith ? ` · overlaps ${sourceName(catalog, ev.redundantWith)}` : ""}
        </>,
      );
    case "remembered":
      return row(
        "wrote",
        <>
          {ev.count} evaluation{ev.count === 1 ? "" : "s"} on Walrus
          {ev.failed ? `, ${ev.failed} failed` : ""} · {ev.ms.toLocaleString("en-US")} ms
        </>,
      );
    case "error":
      return (
        <li className="py-1 text-sm text-bad">
          {ev.source ? `${sourceName(catalog, ev.source)}: ` : ""}
          {ev.message}
        </li>
      );
    case "answer":
    case "done":
      return null;
  }
}

function SpendSummary({ done }: { done: Extract<AgentEvent, { type: "done" }> }) {
  const saved = done.naiveUsd > 0 ? Math.round((1 - done.spentUsd / done.naiveUsd) * 100) : 0;
  return (
    <p className="mt-2 border-t border-line pt-2 font-mono text-[13px] tabular-nums text-secondary">
      Spent {usd(done.spentUsd)}
      <span className="px-2 text-muted">·</span>
      Buying all {usd(done.naiveUsd)}
      <span className="px-2 text-muted">·</span>
      <span className="text-accent">Kept {saved}%</span>
    </p>
  );
}

function Ledger({ state, catalog, highlight }: { state: State | null; catalog: CatalogItem[]; highlight?: Topic }) {
  const topics = Object.keys(state?.memory.ledger ?? {});
  return (
    <section className="rounded-lg border border-line bg-panel p-3" aria-labelledby="ledger">
      <h2 id="ledger" className="mb-2 border-b border-line pb-2 text-[12px] text-secondary">
        Learned
      </h2>
      {state?.memory.error && <p className="mt-3 text-sm text-bad">{state.memory.error}</p>}
      {state && topics.length === 0 && !state.memory.error && (
        <p className="mt-3 text-sm text-secondary">No memories yet. The first run buys each source once.</p>
      )}
      <div className="flex flex-col gap-3">
        {topics.map((topic) => (
          <div key={topic} className={highlight && highlight !== topic ? "opacity-60" : ""}>
            <h3 className="text-[13px] text-ink">{TOPICS[topic as Topic]?.label ?? topic}</h3>
            <ul className="mt-2">
              {state!.memory.ledger[topic]
                .slice()
                .sort((a, b) => b.avgUsefulness - a.avgUsefulness)
                .map((s) => {
                  const keep = s.avgUsefulness >= 0.25;
                  return (
                    <li key={s.source} className="grid h-7 grid-cols-[1fr_4rem_4.25rem] items-center gap-2 text-[13px]">
                      <span className="truncate">{sourceName(catalog, s.source)}</span>
                      <span className="h-1 overflow-hidden rounded-sm bg-raised" aria-hidden>
                        <span
                          className={`block h-full ${keep ? "bg-accent" : ""}`}
                          style={{ width: keep ? `${Math.round(s.avgUsefulness * 100)}%` : "0%" }}
                        />
                      </span>
                      <span className={`text-right font-mono text-xs tabular-nums ${keep ? "text-ink" : "text-muted"}`}>
                        {keep ? "keep" : "skip"} {s.tries}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Memories({ state, catalog }: { state: State | null; catalog: CatalogItem[] }) {
  if (!state?.memory.recent.length) return null;
  return (
    <section className="rounded-lg border border-line bg-panel p-3" aria-labelledby="memories">
      <h2 id="memories" className="mb-2 border-b border-line pb-2 text-[12px] text-secondary">
        Latest memories
      </h2>
      <ul>
        {state.memory.recent.slice(0, 6).map((m) => {
          const parsed = parseMemory(m.text);
          return (
            <li key={m.blobId} className="grid h-7 grid-cols-[1fr_auto] items-center gap-3 text-[13px]">
              <span className="truncate">
                {sourceName(catalog, parsed.source)}
                <span className="text-muted"> · {parsed.topic}</span>
              </span>
              <a
                href={walruscan(m.blobId)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs tabular-nums text-secondary underline decoration-line underline-offset-2 hover:text-ink"
              >
                {parsed.usefulness.toFixed(2)}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Catalog({ catalog }: { catalog: CatalogItem[] }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-3" aria-labelledby="catalog">
      <h2 id="catalog" className="mb-2 border-b border-line pb-2 text-[12px] text-secondary">
        Sources
      </h2>
      <ul>
        {catalog.map((c) => (
          <li key={c.id} title={c.pitch} className="grid h-7 grid-cols-[1fr_4.5rem] items-center gap-3 text-[13px]">
            <span className="truncate">
              {c.name} <span className="text-muted">{c.topics.join(", ")}</span>
            </span>
            <span className="text-right font-mono tabular-nums text-secondary">{usd(c.priceUsd)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
