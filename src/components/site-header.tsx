"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/#loop", label: "How it works" },
  { href: "/#learned", label: "What it learned" },
  { href: "/#proof", label: "Proof" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-8 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold text-ink">
          <span className="grid size-6 place-items-center rounded-[4px] bg-ink font-mono text-[12px] text-paper" aria-hidden>
            $
          </span>
          Spend-Aware
        </Link>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-secondary transition-colors hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-5 md:flex">
          <a href="https://github.com/AshThunder/spend-aware-agent" className="text-sm text-secondary transition-colors hover:text-ink">
            GitHub
          </a>
          <Link
            href="/console"
            aria-current={pathname === "/console" ? "page" : undefined}
            className="inline-flex h-9 items-center rounded-lg bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-[#3a332b]"
          >
            Open console
          </Link>
        </div>
        <button
          type="button"
          className="ml-auto inline-flex h-10 items-center rounded-lg border border-line px-3 text-sm md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="border-t border-line px-4 py-2 md:hidden" aria-label="Mobile">
          <ul className="flex flex-col">
            {[...LINKS, { href: "/console", label: "Console" }].map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block py-3 text-[15px]" onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a href="https://github.com/AshThunder/spend-aware-agent" className="block py-3 text-[15px]">
                GitHub
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
