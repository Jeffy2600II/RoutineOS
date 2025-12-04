import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import webpush from "web-push";

const DATA_DIR = path.join(process.cwd(), "data");
const SUB_FILE = path.join(DATA_DIR, "subscriptions.json");

function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured in environment variables");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}

async function readSubscriptions() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(SUB_FILE, "utf-8").catch(() => "[]");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("❌ readSubscriptions error:", err);
    return [];
  }
}

async function writeSubscriptions(list) {
  try {
    await fs.writeFile(SUB_FILE, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error("❌ writeSubscriptions error:", err);
  }
}

export async function POST(req) {
  /**
   * Expected body examples:
   * { "title": "🔔 ถึงเวลา!", "body": "กิจวัตรเริ่มแล้ว", "filter": { "endpointContains": "..." } }
   * If "filter" omitted, send to all saved subscribers.
   */
  try {
    const payload = await req.json();
    const title = payload.title || "🔔 RoutineOS";
    const bodyText = payload.body || "";
    const extra = payload.data || {};
    
    const webpushInstance = initWebPush();
    const subs = await readSubscriptions();
    
    let targets = subs;
    if (payload.filter && payload.filter.endpointContains) {
      targets = subs.filter((s) => s.endpoint && s.endpoint.includes(payload.filter.endpointContains));
    }
    
    const results = [];
    for (let i = targets.length - 1; i >= 0; i--) {
      const sub = targets[i];
      try {
        const pushPayload = JSON.stringify({
          title,
          body: bodyText,
          data: extra,
          timestamp: Date.now(),
        });
        await webpushInstance.sendNotification(sub, pushPayload);
        results.push({ endpoint: sub.endpoint, ok: true });
      } catch (err) {
        console.error("❌ Failed to send to", sub.endpoint, err);
        results.push({ endpoint: sub.endpoint, ok: false, error: err.message || String(err) });
        // Remove unsubscribed/invalid endpoints automatically
        if (err.statusCode === 410 || err.statusCode === 404) {
          // remove from storage
          const idx = subs.findIndex((s) => s.endpoint === sub.endpoint);
          if (idx >= 0) subs.splice(idx, 1);
        }
      }
    }
    
    // Persist cleaned subscriptions
    await writeSubscriptions(subs);
    
    return NextResponse.json({ success: true, attempted: targets.length, results });
  } catch (err) {
    console.error("❌ /api/notify error:", err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}