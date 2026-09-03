import { json, type ActionFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";

import { loginUser } from "~/services/auth.server";

export const meta: MetaFunction = () => [{ title: "Login - Poosefilm POS" }];

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  if (!email.trim() || !password) {
    return json({ error: "Email dan password wajib diisi." }, { status: 400 });
  }

  return loginUser(email, password);
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <main className="min-h-screen bg-[#f7f3ed] px-6 py-12 text-[#25231f]">
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
        <section className="w-full rounded-[28px] border border-[#e6ded2] bg-white p-8 shadow-[0_24px_70px_rgba(59,43,27,0.08)]">
          <p className="eyebrow">POOSEFILM POS</p>
          <h1 className="mt-3 font-display text-4xl">Selamat datang kembali.</h1>
          <p className="mt-3 text-sm leading-6 text-[#766e64]">Masuk untuk mengelola order, antrian upload, dan laporan harian.</p>
          <Form method="post" className="mt-8 space-y-5">
            <label className="field-label">
              Email
              <input className="field-input" type="email" name="email" autoComplete="username" required />
            </label>
            <label className="field-label">
              Password
              <input className="field-input" type="password" name="password" autoComplete="current-password" required />
            </label>
            {actionData?.error ? <p className="text-sm text-red-700">{actionData.error}</p> : null}
            <button className="button-primary w-full" type="submit" disabled={navigation.state === "submitting"}>
              {navigation.state === "submitting" ? "Memeriksa..." : "Masuk"}
            </button>
          </Form>
          <Link to="/" className="mt-6 block text-center text-xs text-[#968b7e] hover:text-[#25231f]">Kembali ke beranda</Link>
        </section>
      </div>
    </main>
  );
}
