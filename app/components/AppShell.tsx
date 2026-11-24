import { NavLink, Outlet } from "@remix-run/react";

import type { AuthUser } from "~/services/auth.server";
import { AccountMenu } from "~/components/AccountMenu";
import { UploadManagerProvider } from "~/components/UploadManager";

export const PRIMARY_NAVIGATION = [
  ["Kasir", "/admin/cashier"],
  ["Antrian", "/admin/queue"],
  ["Riwayat", "/admin/history"],
  ["Rekap", "/admin/summary"],
] as const;

export function AppShell({ user }: { user: AuthUser }) {
  return <UploadManagerProvider>
    <div className="min-h-screen bg-[#f7f3ed] text-[#25231f]">
      <header className="sticky top-0 z-10 border-b border-[#e6ded2]/80 bg-[#f7f3ed]/95 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-2.5 md:flex md:justify-between md:gap-6 md:py-5 lg:px-10">
          <NavLink to="/admin/cashier" className="shrink-0 justify-self-start">
            <p className="font-display text-2xl tracking-tight">poosefilm</p>
            <p className="eyebrow mt-1">POS BY POOSEBOX</p>
          </NavLink>
          <nav aria-label="Navigasi utama" className="col-span-full row-start-2 grid grid-cols-4 items-center gap-1 rounded-full border border-[#e6ded2] bg-white p-1 md:flex">
            {PRIMARY_NAVIGATION.map(([label, to]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `flex min-h-11 items-center justify-center rounded-full px-1 py-2 text-xs font-semibold transition md:min-h-0 md:px-4 ${isActive ? "bg-[#25231f] text-white" : "text-[#84796c] hover:text-[#25231f]"}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="col-start-2 row-start-1 justify-self-end">
            <AccountMenu user={user} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10"><Outlet /></main>
    </div>
  </UploadManagerProvider>;
}
