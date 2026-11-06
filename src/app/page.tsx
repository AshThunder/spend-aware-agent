import Link from "next/link";
import { SOURCES } from "@/lib/sources";

const STEPS = [
  {
    title: "Recall",
    body: "Before spending, the agent reads its Walrus Memory for this topic and what each source was worth last time.",
  },
  {
    title: "Pay",
    body: "Unknown or proven sources are bought with x402 on Sui mainnet. Tatum’s gRPC gateway supplies the chain data. Gas is sponsored.",
  },
  {
    title: "Remember",
    body: "Each purchase is scored by how many new facts it added. The verdict is written back to Walrus, so the next run can skip it.",
  },
];

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-14 px-4 py-10">
      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <div>
          <h1 className="max-w-[16ch] text-[40px] leading-[1.05] font-medium tracking-[-0.03em] text-ink md:text-5xl">
            Pay for chain data once. Remember what was worth it.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-6 text-secondary">
            Spend-Aware Agent buys Sui data per request, scores what each purchase added, and stores the verdict in
            Walrus Memory. The next similar question skips the sources that did not deliver.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/console"
              className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-white hover:bg-accent-ink"
            >
              Open the console
            </Link>
            <a
              href="https://github.com/AshThunder/spend-aware-agent"
              className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm font-medium text-ink hover:bg-raised"
            >
              View the code
            </a>
          </div>
        </div>
        <aside className="rounded-2xl border border-line bg-white p-4 shadow-[0_12px_32px_rgb(20_24_28/0.06)]">
          <p className="text-[12px] text-muted">A real mainnet run, second time on the same topic</p>
          <p className="mt-2 font-display text-lg leading-6 font-medium">How healthy is the Sui network right now?</p>
          <ul className="mt-3 divide-y divide-line text-sm">
            <li className="flex justify-between py-2">
              <span>Staking Scope</span>
              <span className="text-muted">skipped</span>
            </li>
            <li className="flex justify-between py-2">
              <span>Alpha Wire</span>
              <span className="text-muted">skipped</span>
            </li>
            <li className="flex justify-between py-2">
              <span>Chain Pulse Pro</span>
              <span className="text-muted">skipped</span>
            </li>
            <li className="flex justify-between py-2">
              <span>Chain Pulse</span>
              <span className="font-medium text-accent-ink">bought {usd(0.002)}</span>
            </li>
          </ul>
          <p className="mt-3 border-t border-line pt-3 font-mono text-sm tabular-nums">
            Spent {usd(0.002)} <span className="text-muted">instead of {usd(0.024)}</span>
          </p>
        </aside>
      </section>

      <section id="how" className="scroll-mt-20">
        <h2 className="text-2xl font-medium tracking-[-0.02em]">How a run works</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-line p-4">
              <p className="font-mono text-[12px] text-accent-ink tabular-nums">0{i + 1}</p>
              <h3 className="mt-2 text-base font-medium">{step.title}</h3>
              <p className="mt-1 text-sm leading-5 text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="sources" className="scroll-mt-20">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-medium tracking-[-0.02em]">Paid sources</h2>
          <p className="text-[13px] text-muted">x402 on Sui mainnet, USDC</p>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-raised text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">What it sells</th>
                <th className="px-4 py-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((source) => (
                <tr key={source.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium">{source.name}</td>
                  <td className="hidden px-4 py-2.5 text-secondary sm:table-cell">{source.pitch}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{usd(source.priceUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
