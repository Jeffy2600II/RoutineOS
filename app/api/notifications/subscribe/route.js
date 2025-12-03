import { NextResponse } from "next/server";
import schedule from "../../../../data/schedule.json";

// เก็บ client connections (SSE)
const connectedClients = new Set();

// Dedup map เพื่อป้องกันส่งซ้ำ (คีย์ -> true)
const notifiedTasks = new Map();

// ฟังก์ชันส่งข้อความให้ client ทุกตัว
function broadcastNotification(data) {
  connectedClients.forEach((client) => {
    try {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error("❌ Failed to send to client:", err);
      connectedClients.delete(client);
    }
  });
}

export async function GET(req) {
  console.log("🔌 Client connected to SSE");
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const client = {
        write: (data) => {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (err) {
            console.error("❌ Stream enqueue error:", err);
          }
        },
      };
      
      connectedClients.add(client);
      console.log(`✅ Total connected clients: ${connectedClients.size}`);
      
      // ส่งข้อความตอนเชื่อมต่อ
      client.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
      
      // คืนค่าฟังก์ชัน cleanup เมื่อ stream ถูกปิด
      return () => {
        connectedClients.delete(client);
        console.log(`❌ Client disconnected. Remaining: ${connectedClients.size}`);
      };
    },
    cancel(reason) {
      // เมื่อลูกค้าปิด connection
      console.log("❌ SSE stream cancelled:", reason);
    },
  });
  
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function POST(req) {
  // API สำหรับ Service Worker หรือ Polling เรียกมาเช็ค task ปัจจุบัน
  try {
    const body = await req.json();
    const { dayIndex } = body;
    
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
    
    const now = new Date();
    const currentSeconds =
      now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    // หา task ที่กำลังเกิดขึ้นหรือจะเกิดขึ้นใน 5 นาทีข้างหน้า
    const upcomingTasks = tasks.filter((task) => {
      const taskStartSeconds = timeToSeconds(task.start);
      const timeDiff = taskStartSeconds - currentSeconds;
      // 0 ถึง 5 นาที
      return timeDiff >= 0 && timeDiff <= 300;
    });
    
    // Dedup per-day to avoid re-sending same notification many times
    const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    
    upcomingTasks.forEach((task) => {
      const taskId = `${dateKey}-${dayIndex}-${task.start}-${task.task}`;
      if (!notifiedTasks.has(taskId)) {
        // Broadcast to SSE clients
        broadcastNotification({
          type: "upcoming-task",
          task: task,
          dayIndex: dayIndex,
          timestamp: new Date().toISOString(),
        });
        
        // Mark as notified and schedule TTL removal
        notifiedTasks.set(taskId, true);
        setTimeout(() => {
          notifiedTasks.delete(taskId);
        }, 10 * 60 * 1000); // 10 นาที
      }
    });
    
    return NextResponse.json({
      success: true,
      tasksNotified: upcomingTasks.length,
      clientsNotified: connectedClients.size,
    });
  } catch (err) {
    console.error("❌ Error in /api/notifications/subscribe POST:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function timeToSeconds(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60;
}