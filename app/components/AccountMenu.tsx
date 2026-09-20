import { Form, Link } from "@remix-run/react";

import type { AuthUser } from "~/services/auth.server";

export function AccountMenu({ user }: { user: AuthUser }) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full border border-[#e6ded2] bg-white px-3 py-2 text-left shadow-sm">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#24231f] text-xs font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="hidden sm:block"><span className="block text-xs font-semibold">{user.name}</span><span className="block text-[10px] uppercase tracking-[0.14em] text-[#a09587]">{user.role}</span></span>
      </summary>
      <div className="absolute right-0 top-14 z-20 w-48 rounded-2xl border border-[#e6ded2] bg-white p-2 shadow-xl">
        {user.role === "SUPERADMIN" ? <>
          <Link className="menu-link" to="/admin/products">Produk</Link>
          <Link className="menu-link" to="/admin/settings">Settings</Link>
          <Link className="menu-link" to="/admin/users">Users</Link>
        </> : null}
        <Form method="post" action="/logout"><button className="menu-link w-full text-left" type="submit">Keluar</button></Form>
      </div>
    </details>
  );
}
