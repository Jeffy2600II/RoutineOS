import { NextResponse } from "next/server";
import schedule from "../../../data/schedule.json";

// ✨ Map เพื่อจัดการการเชื่อมต่อของไคลเอนต์
const activeClients = new Map();
let clientId = 0;

// 🕐 ฟังก์ชัน: แปลงเวลา HH:MM เป็นวินาที
function timeToSeconds(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60;
}

// 🎯 ฟังก์ชัน: ตรวจสอบว่างานไหนจะเริ่มในอีก X วินาที
function getUpcomingTasks(seconds = 60) {
  const now = new Date();
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const todayIndex = now.getDay();
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayKey = days[todayIndex];
  
  const todayTasks = schedule[todayKey] || [];
  const upcoming = [];
  
  todayTasks.forEach((task) => {
    const taskStartSeconds = timeToSeconds(task.start);
    const timeUntil = taskStartSeconds - currentSeconds;
    
    // ถ้างานจะเริ่มในอีกไม่กี่วินาที
    if (timeUntil > 0 && timeUntil <= seconds) {
      upcoming.push({
        task,
        timeUntil,
        startAt: task.start,
        title: task.task,
        description: task.description,
      });
    }
  });
  
  return upcoming;
}

// 🌊 ฟังก์ชัน: สตรีม SSE
async function* streamEvents() {
  // ส่งการเชื่อมต่อสำเร็จ
  yield `: Connected to real-time task monitor\n\n`;
  
  // ตรวจสอบและส่งแจ้งเตือนแบบ real-time
  while (true) {
    const upcomingTasks = getUpcomingTasks(120); // ตรวจสอบ 2 นาทีข้างหน้า
    
    if (upcomingTasks.length > 0) {
      for (const item of upcomingTasks) {
        yield `data: ${JSON.stringify({
          type: "task-alert",
          timeUntil: item.timeUntil,
          task: item.task,
          startAt: item.startAt,
          title: item.title,
          description: item.description,
          timestamp: new Date(). toISOString(),
        })}\n\n`;
      }
    }
    
    // ตรวจสอบทีละ 1 วินาที
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// 📡 GET handler สำหรับ SSE
export async function GET() {
  // ตรวจสอบ browser support
  const encoder = new TextEncoder();
  
  // สร้าง readable stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamEvents()) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        console.error("Stream error:", error);
        controller.close();
      }
    },
  });
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}