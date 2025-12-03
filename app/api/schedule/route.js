import { NextResponse } from "next/server";
import schedule from "../../../data/schedule.json";

// Endpoint นี้ตอบข้อมูล task ที่เกี่ยวข้องในช่วงเวลาปัจจุบัน (สำหรับ UI/ServiceWorker)
export async function GET() {
  try {
    const now = new Date();
    const dayIndex = now.getDay();
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayKey = days[dayIndex];
    const tasks = schedule[dayKey] || [];
    
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    // เตรียมรายการ task ที่เกี่ยวข้อง (จาก -5 นาที ถึง +1 ชั่วโมง)
    const relevant = tasks
      .map((task) => {
        const startSeconds = timeToSeconds(task.start);
        const diff = startSeconds - currentSeconds;
        return {
          ...task,
          timeDiff: diff,
          isUpcoming: diff > 0 && diff <= 300,
          isCurrent: diff <= 0 && timeToSeconds(task.end) > currentSeconds,
        };
      })
      .filter((t) => t.timeDiff >= -300 && t.timeDiff <= 3600)
      .sort((a, b) => a.timeDiff - b.timeDiff);
    
    return NextResponse.json({
      success: true,
      now: now.toISOString(),
      dayIndex,
      tasks: relevant.slice(0, 5),
    });
  } catch (err) {
    console.error("❌ Scheduler GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
};

function timeToSeconds(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60;
}