import { createCookieSessionStorage, redirect } from "@remix-run/node";

const sessionSecret = process.env.SESSION_SECRET || "poosefilm-local-development-secret";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "poosefilm_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;

export async function getUserId(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  return session.get("userId") as number | undefined;
}

export async function requireUserId(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    throw redirect("/login");
  }
  return userId;
}

export async function createUserSession(userId: number, redirectTo = "/admin/cashier") {
  const session = await getSession();
  session.set("userId", userId);

  return redirect(redirectTo, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export async function destroyUserSession(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/login", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}
