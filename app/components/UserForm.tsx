import { Form } from "@remix-run/react";

type UserFormProps = { user?: { id: number; name: string; email: string; role: string } };

export function UserForm({ user }: UserFormProps) {
  return (
    <Form method="post" className="grid gap-4 rounded-2xl border border-[#e6ded2] bg-white p-5 md:grid-cols-5">
      <input type="hidden" name="intent" value={user ? "update" : "create"} />
      {user ? <input type="hidden" name="id" value={user.id} /> : null}
      <label className="field-label">Nama<input className="field-input" name="name" defaultValue={user?.name} required /></label>
      <label className="field-label">Email<input className="field-input" type="email" name="email" defaultValue={user?.email} required /></label>
      <label className="field-label">Password{user ? <span className="ml-1 font-normal text-[#a09587]">(opsional)</span> : null}<input className="field-input" type="password" name="password" minLength={6} required={!user} /></label>
      <label className="field-label">Role<select className="field-input" name="role" defaultValue={user?.role || "STAFF"}><option value="STAFF">Staff</option><option value="SUPERADMIN">Superadmin</option></select></label>
      <button className="button-primary self-end" type="submit">{user ? "Simpan perubahan" : "Tambah user"}</button>
    </Form>
  );
}
