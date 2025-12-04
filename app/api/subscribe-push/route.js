import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SUB_FILE = path.join(DATA_DIR, "subscriptions.json");

// Utility: ensure data dir and file exist
async function ensureFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(SUB_FILE);
    } catch (err) {
      await fs.writeFile(SUB_FILE, JSON.stringify([]));
    }
  } catch (err) {
    console.error("❌ ensureFile error:", err);
  }
}

export async function GET() {
  // For debug: return current saved subscriptions (only for dev/testing)
  try {
    await ensureFile();
    const raw = await fs.readFile(SUB_FILE, "utf-8");
    const subs = JSON.parse(raw || "[]");
    return NextResponse.json({ success: true, count: subs.length, subscriptions: subs });
  } catch (err) {
    console.error("❌ GET /api/subscribe-push error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  // Save subscription posted from client
  try {
    const sub = await req.json();
    if (!sub || !sub.endpoint) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }
    
    await ensureFile();
    const raw = await fs.readFile(SUB_FILE, "utf-8");
    const list = JSON.parse(raw || "[]");
    
    // dedupe by endpoint
    const exists = list.find((s) => s.endpoint === sub.endpoint);
    if (!exists) {
      list.push(sub);
      await fs.writeFile(SUB_FILE, JSON.stringify(list, null, 2));
      console.log("✅ Saved subscription. Total:", list.length);
    } else {
      console.log("ℹ️ Subscription already exists");
    }
    
    return NextResponse.json({ success: true, total: list.length });
  } catch (err) {
    console.error("❌ POST /api/subscribe-push error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}