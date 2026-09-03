import { redirect } from "@remix-run/node";

export async function loader() { return redirect("/admin/cashier"); }

export default function AdminIndex() { return null; }
