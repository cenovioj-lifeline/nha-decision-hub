// Vercel Edge Middleware: auth-on-entry for dh.nha-ai.com.
// Wraps the Vite/React SPA shell — any request that isn't an API endpoint,
// the OAuth callback, no-access, or a static asset must carry a valid
// dh_session cookie or it gets bounced to Okta.
//
// Adopted 2026-05-11 to replace the prior client-side-only allowed_users
// check (which left the SPA + Supabase anon key fully reachable).

import { jwtVerify } from "jose";

const STATIC_EXT = /\.(png|svg|ico|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|css|js|map|json|xml|txt|wasm)$/i;

function passThrough(path: string): boolean {
  if (path.startsWith("/api/")) return true;
  if (path === "/callback") return true;
  if (path === "/no-access" || path === "/no-access.html") return true;
  if (path.startsWith("/.well-known/")) return true;
  if (STATIC_EXT.test(path)) return true;
  return false;
}

export default async function middleware(req: Request): Promise<Response | undefined> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (passThrough(path)) return undefined;

  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith("dh_session="));
  const token = match ? match.slice("dh_session=".length) : null;

  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
      await jwtVerify(token, secret);
      return undefined; // valid session → pass through to SPA
    } catch {
      // fall through to redirect
    }
  }

  return Response.redirect(new URL("/api/auth/login", req.url), 302);
}

export const config = {
  matcher: [
    "/((?!api/|callback$|no-access(?:\\.html)?$|favicon|.*\\.(?:css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|wasm|map|json|xml|txt)$).*)",
  ],
};
