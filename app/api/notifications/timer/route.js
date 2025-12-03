// 👇 Timer store ((simple demo, memory only, for full scale use a DB/Queue)
let timers = []; // [{ id, expiresAt, minutes, message }]

export async function POST(req) {
  const { minutes = 1, message = "" } = await req.json();
  const id = `tmr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const expiresAt = Date.now() + minutes * 60 * 1000;
  timers.push({ id, expiresAt, minutes, message });
  
  setTimeout(() => {
    // เมื่อครบกำหนดส่ง Notification ผ่าน SSE
    broadcastTimerNotification({ id, minutes, message });
    timers = timers.filter(t => t.id !== id);
  }, minutes * 60 * 1000);
  
  return Response.json({ success: true, id, minutes, message });
}

export async function DELETE(req) {
  const { id } = await req.json();
  timers = timers.filter(t => t.id !== id);
  return Response.json({ success: true });
}

// Helper broadcast (ใช้จาก subscribe/route.js หรือแยก shared helper ก็ได้)
function broadcastTimerNotification(data) {
  if (typeof global.connectedClients !== "object") return;
  for (const client of global.connectedClients) {
    try {
      client.write(`data: ${JSON.stringify({ type: "timer", ...data })}\n\n`);
    } catch (err) { /* skip */ }
  }
}