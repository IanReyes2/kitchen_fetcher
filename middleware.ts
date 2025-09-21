import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "fallback-secret")

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value

  if (!token) return NextResponse.redirect(new URL("/login", req.url))

  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch (err) {
    return NextResponse.redirect(new URL("/login", req.url))
  }
}

export const config = {
  matcher: ["/protected/:path*"], // Only run on protected routes
}
