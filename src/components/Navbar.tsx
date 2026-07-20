"use client";

import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { href: "/#packages", label: "Packages" },
    { href: "/#how-it-works", label: "How it works" },
  ];

  return (
    <nav className="bg-slate-950/95 backdrop-blur-xl sticky top-0 z-50 border-b border-white/10">
      <div className="container max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 h-[64px] flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3" aria-label="Enokay69 home">
          <div className="w-10 h-10 bg-teal-400 rounded-xl flex items-center justify-center text-slate-950 font-black text-sm shadow-lg shadow-teal-500/20">69</div>
          <span className="text-xl font-black text-white tracking-[-0.04em]">Enokay<span className="text-teal-400">69</span></span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => <Link key={link.href} href={link.href} className="text-slate-300 hover:text-white transition text-sm font-semibold">{link.label}</Link>)}
          <a href="#packages" className="rounded-full bg-teal-400 text-slate-950 px-5 py-2.5 text-sm font-extrabold hover:bg-teal-300 transition">View packages</a>
        </div>

        <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-white h-10 w-10 rounded-xl hover:bg-white/10 transition" aria-expanded={mobileOpen} aria-label="Toggle navigation">
          <i className={`fas ${mobileOpen ? "fa-times" : "fa-bars"}`} />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-4 py-4 bg-slate-950 flex flex-col gap-1">
          {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="text-slate-200 rounded-xl px-3 py-3 text-sm font-semibold hover:bg-white/5">{link.label}</Link>)}
        </div>
      )}
    </nav>
  );
}
