import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const path = req.nextUrl.pathname

  const isPublic =
    path.startsWith("/login") || path.startsWith("/api/auth")

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (path.startsWith("/admin") && req.auth?.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url))
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
