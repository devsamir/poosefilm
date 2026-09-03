import { NavLink, Outlet } from "@remix-run/react";

import type { AuthUser } from "~/services/auth.server";
import { AccountMenu } from "~/components/AccountMenu";

export const PRIMARY_NAVIGATION = [
  ["Kasir", "/admin/cashier"],
  ["Antrian", "/admin/queue"],
  ["Riwayat", "/admin/history"],
  ["Rekap", "/admin/summary"],
] as const;

export function AppShell({ user }: { user: AuthUser }) {
  return (
    <div className="min-h-screen bg-[#f7f3ed] text-[#25231f]">
      <header className="sticky top-0 z-10 border-b border-[#e6ded2]/80 bg-[#f7f3ed]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
          <NavLink to="/admin/cashier" className="shrink-0"><p className="font-display text-2xl tracking-tight">poosefilm</p><p className="eyebrow mt-1">POS BY POOSEBOX</p></NavLink>
          <nav className="flex items-center gap-1 rounded-full border border-[#e6ded2] bg-white p-1">
            {PRIMARY_NAVIGATION.map(([label, to]) => <NavLink key={to} to={to} className={({ isActive }) => `rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4 ${isActive ? "bg-[#25231f] text-white" : "text-[#84796c] hover:text-[#25231f]"}`}>{label}</NavLink>)}
          </nav>
          <AccountMenu user={user} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10"><Outlet /></main>
    </div>
  );
}
