import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";

import { requireSuperadmin } from "~/services/auth.server";
import { createUser, listUsers, setUserActive, updateUser } from "~/services/users.server";
import { UserForm } from "~/components/UserForm";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperadmin(request);
  return json({ users: await listUsers() });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperadmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  try {
    if (intent === "toggle") {
      await setUserActive(Number(formData.get("id")), String(formData.get("active")) === "true");
    } else {
      const input = { name: String(formData.get("name") || ""), email: String(formData.get("email") || ""), password: String(formData.get("password") || "") || undefined, role: String(formData.get("role") || "STAFF") as "STAFF" | "SUPERADMIN" };
      if (intent === "update") await updateUser(Number(formData.get("id")), input);
      else await createUser(input);
    }
    return json({ success: "User berhasil disimpan." });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Gagal menyimpan user." }, { status: 400 });
  }
}

export default function UsersPage() {
  const { users } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const error = actionData && "error" in actionData ? actionData.error : null;
  const success = actionData && "success" in actionData ? actionData.success : null;
  return <div className="space-y-6"><div><p className="eyebrow">SUPERADMIN</p><h1 className="page-title">Users</h1><p className="page-subtitle">Kelola akses staff dan superadmin Poosefilm.</p></div>{error ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}{success ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{success}</p> : null}<UserForm /><div className="grid gap-4 md:grid-cols-2">{users.map((user) => <section key={user.id} className="rounded-2xl border border-[#e6ded2] bg-white p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{user.name}</h2><p className="mt-1 text-sm text-[#84796c]">{user.email}</p><p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#a09587]">{user.role} - {user.isActive ? "Aktif" : "Nonaktif"}</p></div><Form method="post"><input type="hidden" name="intent" value="toggle" /><input type="hidden" name="id" value={user.id} /><input type="hidden" name="active" value={String(!user.isActive)} /><button className="button-secondary text-xs" type="submit">{user.isActive ? "Nonaktifkan" : "Aktifkan"}</button></Form></div><details className="mt-5"><summary className="cursor-pointer text-xs font-semibold text-[#84796c]">Edit user</summary><div className="mt-4"><UserForm user={user} /></div></details></section>)}</div></div>;
}
