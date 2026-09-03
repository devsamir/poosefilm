import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";

import { AppShell } from "~/components/AppShell";
import { requireUser } from "~/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return requireUser(request);
}

export default function AdminLayout() {
  const user = useLoaderData<typeof loader>();
  return <AppShell user={user} />;
}
