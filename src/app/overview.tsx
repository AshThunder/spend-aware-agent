"use client";

import Link from "next/link";
import { ArrowOut } from "@/components/icons";
import MemoryProof from "@/components/memory-proof";
import SpendChart from "@/components/spend-chart";
import TrustTable from "@/components/trust-table";
import { CATALOG } from "@/lib/catalog";
import { useAppState } from "@/lib/use-app-state";
import { memoryCount, short, usd, type AppState } from "@/lib/view";

const LOOP = [
  { title: "Recall", body: "Reads every verdict it has written to Walrus Memory for this kind of question." },
  { title: "Plan", body: "Buys proven sources, tries unknown ones once, skips sources that scored under 0.25." },
  { title: "Pay", body: "Each source answers HTTP 402. The agent pays in USDC on Sui mainnet through x402." },
  { title: "Score", body: "Usefulness is the share of required facts this purchase added that cheaper ones had not." },
  { title: "Remember", body: "One verdict per purchase goes back to Walrus. The next run starts from it." },
];

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-ink pt-3">
      <dt className="text-[13px] text-secondary">{label}</dt>
      <dd className="font-mono text-[24px] leading-8 sm:text-[28px] font-medium text-ink tabular-nums">{value}</dd>
      {note && <dd className="text-[12px] leading-4 text-muted">{note}</dd>}
    </div>
  );
}

function Pending({ error }: { error: string | null }) {
  return (
    <p className={`text-sm ${error ? "text-bad" : "text-muted"}`} role="status">
      {error ? `Live data is unavailable right now: ${error}` : "Reading Walrus Memory on mainnet…"}
    </p>
  );
}

export default function Overview() {
  const { state, error } = useAppState();
  const s = state?.summary;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col px-4 sm:px-6">
      {state?.fixture && (
        <p className="mt-4 rounded-lg bg-raised px-3 py-2 text-[13px] text-secondary">
          Local preview with a saved snapshot of the mainnet memories. The live site reads Walrus directly.
        </p>
      )}

      <section className="grid items-center gap-10 py-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-20">
        <div className="flex flex-col gap-6">
          <p className="font-mono text-[12px] text-muted">Total Recall · Smart Agents for Real Life</p>
          <h1 className="font-display text-[40px] leading-[1.05] font-normal tracking-[-0.02em] text-ink sm:text-[56px]">
            An agent that stops paying for data it learned was useless
          </h1>
          <p className="max-w-[36rem] text-[18px] leading-7 text-secondary">
            It buys Sui chain data per request with x402, scores what each purchase added, and writes the verdict to
            Walrus Memory on mainnet. The next run reads those verdicts and skips the sellers that did not deliver.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/console" className="btn-primary">
              Ask it something
            </Link>
            <a href="#proof" className="btn-secondary">
              See the memories
            </a>
          </div>
        </div>

        <div className="panel p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-medium text-ink">Spend per paid run</h2>
            <p className="text-[12px] text-muted">Every bar is a real mainnet run, rebuilt from its memories</p>
          </div>
          {state ? <SpendChart runs={state.runs} /> : <Pending error={error} />}
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 pb-16 lg:grid-cols-4">
        <Figure
          label="Memories on Walrus mainnet"
          value={state ? String(memoryCount(state)) : "–"}
          note={state?.memory.stored != null ? "Counted from the Walrus Memory index" : "Readable source verdicts"}
        />
        <Figure label="Paid runs" value={s ? String(s.runs) : "–"} note="Rebuilt from stored verdicts" />
        <Figure
          label="Avg cost per answer, after learning"
          value={s?.avgLaterRunUsd != null ? usd(s.avgLaterRunUsd) : "–"}
          note={s?.avgFirstRunUsd != null ? `First run on a topic averaged ${usd(s.avgFirstRunUsd)}` : undefined}
        />
        <Figure
          label="Wasted after learning"
          value={s ? usd(s.wastedLaterRunsUsd) : "–"}
          note={s ? `vs ${usd(s.wastedFirstRunsUsd)} wasted while exploring` : undefined}
        />
      </dl>

      <section id="loop" className="scroll-mt-20 border-t border-line py-16">
        <h2 className="font-display text-[32px] leading-[1.15] font-normal text-ink">One run, five steps, and the last feeds the first</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {LOOP.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2">
              <span className="font-mono text-[12px] text-muted tabular-nums">
                {String(i + 1).padStart(2, "0")}
                {i === LOOP.length - 1 ? " → 01" : ""}
              </span>
              <h3 className="text-[16px] font-medium text-ink">{step.title}</h3>
              <p className="text-[14px] leading-[22px] text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-[44rem] text-[14px] leading-[22px] text-secondary">
          Chain data comes from Tatum&apos;s Sui gRPC gateway, which also builds the payment transactions. Payments settle
          through the Tentacle Pay x402 facilitator with gas sponsored. Scoring is deterministic, so every keep or skip can
          be traced to the facts a source returned.
        </p>
      </section>

      <section id="learned" className="scroll-mt-20 border-t border-line py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-[32px] leading-[1.15] font-normal text-ink">What it learned</h2>
          <p className="text-[13px] text-muted">Each square is one purchase, oldest first</p>
        </div>
        {state ? (
          <div className="mt-8 grid items-start gap-x-10 gap-y-10 lg:grid-cols-2">
            {state.trust.map((t) => (
              <TrustTable key={t.topic} label={t.label} rows={t.sources} />
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <Pending error={error} />
          </div>
        )}
      </section>

      <section id="proof" className="scroll-mt-20 border-t border-line py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-[32px] leading-[1.15] font-normal text-ink">Proof on mainnet</h2>
          {state && (
            <p className="text-[13px] text-muted">
              Namespace <span className="font-mono">{state.memory.namespace}</span> · {state.network}
            </p>
          )}
        </div>
        {state && <Wallets state={state} />}
        <div className="mt-8">{state ? <MemoryProof items={state.memory.items} /> : <Pending error={error} />}</div>
      </section>

      <section id="sources" className="scroll-mt-20 border-t border-line py-16">
        <h2 className="font-display text-[32px] leading-[1.15] font-normal text-ink">The sellers</h2>
        <p className="mt-2 max-w-[44rem] text-[14px] leading-[22px] text-secondary">
          Five sell live mainnet data read through Tatum. Alpha Wire claims every topic and returns nothing verifiable. It
          is there so the agent has something it should learn to refuse.
        </p>
        <ul className="mt-6 max-w-[44rem]">
          {CATALOG.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 border-b border-line py-3">
              <div className="flex items-baseline">
                <span className="text-[15px] text-ink">{c.name}</span>
                <span className="leader" aria-hidden />
                <span className="font-mono text-[14px] text-ink tabular-nums">{usd(c.priceUsd)}</span>
              </div>
              <p className="text-[13px] leading-5 text-secondary">{c.pitch}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Wallets({ state }: { state: AppState }) {
  const rows = [
    { label: "Agent wallet (pays)", addr: state.agent.address, usdc: state.agent.usdc, url: state.agent.url },
    { label: "Seller wallet (earns)", addr: state.seller.address, usdc: state.seller.usdc, url: state.seller.url },
  ];
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <li key={r.label} className="panel flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] text-muted">{r.label}</p>
            <a href={r.url} target="_blank" rel="noreferrer" className="link font-mono text-[13px]">
              {short(r.addr, 10, 6)} <ArrowOut className="inline size-3" />
            </a>
          </div>
          <p className="font-mono text-[15px] text-ink tabular-nums">{r.usdc == null ? "–" : `${r.usdc.toFixed(3)} USDC`}</p>
        </li>
      ))}
    </ul>
  );
}
