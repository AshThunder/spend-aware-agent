"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#sources", label: "Sources" },
  { href: "/console", label: "Console" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="site-header-stick">
      <header className="site-header">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-6 px-4">
          <Link href="/" className="font-display text-base font-semibold tracking-[-0.02em] text-ink">
            Spend-Aware
          </Link>
          <nav className="hidden items-center gap-5 md:flex" aria-label="Primary">
            {LINKS.map((link) => {
              const active = link.href === "/console" && pathname === "/console";
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm ${active ? "font-medium text-ink" : "text-secondary hover:text-ink"}`}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <a
              href="https://github.com/AshThunder/spend-aware-agent"
              className="text-sm text-secondary hover:text-ink"
            >
              GitHub
            </a>
            <Link
              href="/console"
              className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-white hover:bg-accent-ink"
            >
              Open console
            </Link>
          </div>
          <button
            type="button"
            className="ml-auto inline-flex h-9 items-center rounded-full border border-line px-3 text-sm md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" className="border-t border-line px-4 py-3 md:hidden" aria-label="Mobile">
            <ul className="flex flex-col">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="block py-2 text-sm" onClick={() => setOpen(false)}>
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="https://github.com/AshThunder/spend-aware-agent" className="block py-2 text-sm">
                  GitHub
                </a>
              </li>
            </ul>
          </nav>
        )}
      </header>
    </div>
  );
}
