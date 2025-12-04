import fs from "fs/promises";
import path from "path";
import webpush from "web-push";
import schedule from "../../../data/schedule.json";

const DATA_DIR = path.join(process.cwd(), "data");
const SUB_FILE = path.join(DATA_DIR, "subscriptions.json");
const days = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"
];

// **ใช้ Vercel Env Vars**
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

// Setup VAPID
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function timeToSeconds(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60;
}

export async function GET() {
  // เวลาปัจจุบัน
  const now = new Date();
  const dayKey = days[now.getDay()];
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  
  const tasks = schedule[dayKey] || [];
  // หา tasks ที่จะเริ่มใน 1 นาที (60 วินาที)
  const upcomingTasks = tasks.filter((task) => {
    const taskStartSeconds = timeToSeconds(task.start);
    const timeDiff = taskStartSeconds - currentSeconds;
    return timeDiff >= 0 && timeDiff <= 60;
  });
  
  if (upcomingTasks.length === 0) {
    return Response.json({ success: true, info: "No upcoming tasks." });
  }
  
  // โหลด subscriptions
  let subs = [];
  try {
    const subsRaw = await fs.readFile(SUB_FILE, "utf-8");
    subs = JSON.parse(subsRaw || "[]");
  } catch (err) {
    // ไม่มีไฟล์ ก็ไม่มี subscriber
    return Response.json({ success: false, error: "No subscriptions file." }, { status: 404 });
  }
  
  let results = [];
  for (const task of upcomingTasks) {
    const payload = JSON.stringify({
      title: "🔔 ถึงเวลาเริ่มกิจวัตร!",
      body: `${task.start} - ${task.task}\n\n📝 ${task.description}`,
      data: { dayKey, task },
      timestamp: Date.now()
    });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, payload);
        results.push({ endpoint: sub.endpoint, ok: true });
      } catch (err) {
        results.push({ endpoint: sub.endpoint, ok: false, error: err.message });
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Remove unsubscribed/invalid endpoint
          subs = subs.filter((s) => s.endpoint !== sub.endpoint);
        }
      }
    }
  }
  // Persist cleaned subscriptions
  try {
    await fs.writeFile(SUB_FILE, JSON.stringify(subs, null, 2));
  } catch (err) {}
  
  return Response.json({ success: true, results, notifiedTasks: upcomingTasks.length });
}