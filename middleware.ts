import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/** Protect dashboard pages when PASSWORD is set. API routes handle their own auth. */
export function middleware(req: NextRequest) {
  if (!process.env.PASSWORD && !process.env.DASHBOARD_PASSWORD) return NextResponse.next();
  if (req.nextUrl.pathname === "/login") return NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)?.value === "ok") return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
