import { NextResponse } from "next/server";
import schedule from "../../../../data/schedule.json";

// ✨ Store clients ที่เชื่อมต่ออยู่
const connectedClients = new Set();

// ฟังก์ชัน: ส่ง notification ให้ทุก client ที่เชื่อมต่ออยู่
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
  // ✅ SSE Connection
  console.log("🔌 Client connected to SSE");
  
  const encoder = new TextEncoder();
  
  // สร้าง Response stream
  const stream = new ReadableStream({
    start(controller) {
      // ✅ เพิ่มลงใน connected clients
      const client = {
        write: (data) => {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (err) {
            console.error("❌ Stream error:", err);
          }
        },
      };
      
      connectedClients.add(client);
      console.log(`✅ Total connected clients: ${connectedClients.size}`);
      
      // ส่ง message ตอน connect
      client.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
      
      // ✅ Clean up เมื่อ disconnect
      return () => {
        connectedClients.delete(client);
        console.log(
          `❌ Client disconnected.  Remaining: ${connectedClients.size}`
        );
      };
    },
  });
  
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function POST(req) {
  // API สำหรับ Service Worker เช็ค task ปัจจุบัน
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
    
    // ✅ Broadcast ให้ทุก client
    upcomingTasks.forEach((task) => {
      broadcastNotification({
        type: "upcoming-task",
        task: task,
        dayIndex: dayIndex,
        timestamp: new Date().toISOString(),
      });
    });
    
    return NextResponse.json({
      success: true,
      tasksNotified: upcomingTasks.length,
      clientsNotified: connectedClients.size,
    });
  } catch (err) {
    console.error("❌ Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function timeToSeconds(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60;
}