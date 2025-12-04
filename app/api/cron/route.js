import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import webpush from "web-push";
import schedule from "../../../../data/schedule.json"; // ⚠️ path เป็น ../../../data/schedule.json เพราะอยู่ใน app/api/cron/

const DATA_DIR = path.join(process.cwd(), "data");
const SUB_FILE = path.join(DATA_DIR, "subscriptions.json");
const days = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"
];

// ดึงค่าจาก Vercel env
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

// ตั้งค่า VAPID ให้ webpush
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function timeToSeconds(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60;
}

export async function GET(req) {
  // ** ตรวจสอบ CRON_SECRET **
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  
  // เวลาปัจจุบัน
  const now = new Date();
  const dayKey = days[now.getDay()];
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  
  const tasks = schedule[dayKey] || [];
  // งานที่จะเกิดขึ้นใน 1 นาที
  const upcomingTasks = tasks.filter((task) => {
    const taskStartSeconds = timeToSeconds(task.start);
    const timeDiff = taskStartSeconds - currentSeconds;
    return timeDiff >= 0 && timeDiff <= 60;
  });
  
  if (upcomingTasks.length === 0) {
    return NextResponse.json({ success: true, info: "No upcoming tasks." });
  }
  
  // โหลด subscription
  let subs = [];
  try {
    const subsRaw = await fs.readFile(SUB_FILE, "utf-8");
    subs = JSON.parse(subsRaw || "[]");
  } catch (err) {
    return NextResponse.json({ success: false, error: "No subscriptions file." }, { status: 404 });
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
          subs = subs.filter((s) => s.endpoint !== sub.endpoint);
        }
      }
    }
  }
  // บันทึก subscriptions ที่ลบ (ถ้ามี)
  try {
    await fs.writeFile(SUB_FILE, JSON.stringify(subs, null, 2));
  } catch (err) {}
  
  return NextResponse.json({ success: true, results, notifiedTasks: upcomingTasks.length });
}