import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    // Without a NextAuth secret the middleware can't read session tokens,
    // so just continue and avoid throwing at the edge.
    return NextResponse.next();
  }

  try {
    await getToken({ req, secret });
  } catch (error) {
    console.error("Failed to read auth token in middleware:", error);
  }

  return NextResponse.next();
}
