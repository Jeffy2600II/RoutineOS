import { NextResponse } from "next/server";

/**
 * Simple endpoint to expose VAPID public key to clients.
 * Ensure VAPID_PUBLIC_KEY is set in environment (Vercel Environment Variables).
 */
export async function GET() {
  const pub = process.env.VAPID_PUBLIC_KEY || "";
  if (!pub) {
    return NextResponse.json({ error: "VAPID_PUBLIC_KEY not configured" }, { status: 500 });
  }
  return NextResponse.json({ publicKey: pub });
}