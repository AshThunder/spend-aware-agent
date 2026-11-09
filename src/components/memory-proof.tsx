"use client";

import { useState } from "react";
import { sourceName } from "@/lib/catalog";
import { TOPIC_SHORT, short, walrusBlob, when, type AppState } from "@/lib/view";
import { ArrowOut } from "./icons";

export default function MemoryProof({ items, initial = 8 }: { items: AppState["memory"]["items"]; initial?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, initial);
  if (!items.length) return <p className="text-sm text-secondary">No memories could be read right now.</p>;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
          <caption className="sr-only">Source evaluations stored in Walrus Memory, newest first</caption>
          <thead>
            <tr className="border-y border-line text-[12px] text-muted">
              <th scope="col" className="py-2 pr-3 font-normal">Written</th>
              <th scope="col" className="py-2 pr-3 font-normal">Verdict on</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">Score</th>
              <th scope="col" className="py-2 pr-3 font-normal">Walrus blob</th>
              <th scope="col" className="py-2 font-normal">Payment on Sui</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.blobId} className="border-b border-line">
                <td className="py-2 pr-3 font-mono text-[12px] whitespace-nowrap text-secondary tabular-nums">{when(m.at)}</td>
                <th scope="row" className="py-2 pr-3 font-normal text-ink">
                  {sourceName(m.source)} <span className="text-muted">· {TOPIC_SHORT[m.topic]}</span>
                </th>
                <td className={`py-2 pr-3 text-right font-mono tabular-nums ${m.usefulness >= 0.25 ? "text-good-ink" : "text-bad"}`}>
                  {m.usefulness.toFixed(2)}
                </td>
                <td className="py-2 pr-3">
                  <a className="link font-mono text-[12px]" href={walrusBlob(m.blobId)} target="_blank" rel="noreferrer">
                    {short(m.blobId, 8, 4)} <ArrowOut className="inline size-3" />
                  </a>
                </td>
                <td className="py-2">
                  {m.txUrl ? (
                    <a className="link font-mono text-[12px]" href={m.txUrl} target="_blank" rel="noreferrer">
                      {short(m.tx!, 8, 4)} <ArrowOut className="inline size-3" />
                    </a>
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > initial && (
        <button type="button" className="btn-secondary mt-4" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </>
  );
}
