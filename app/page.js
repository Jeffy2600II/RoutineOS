import fs from "fs";
import path from "path";

export default async function Home() {
  // หาวันปัจจุบัน
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayIndex = new Date().getDay();
  const today = days[todayIndex];
  
  // โหลด JSON จากไฟล์
  const filePath = path.join(process.cwd(), "data", "schedule.json");
  const jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
  
  const tasks = jsonData[today] || [];
  
  return (
    <html lang="th">
      <head>
        <title>RoutineOS</title>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body style={{ fontFamily: "sans-serif", padding: "20px" }}>
        <h1>📅 กิจวัตรประจำวัน</h1>
        <h2 style={{ marginTop: "-10px", color: "#666" }}>
          วันนี้: {today.toUpperCase()}
        </h2>

        <div style={{ marginTop: "20px" }}>
          {tasks.map((t, i) => (
            <div
              key={i}
              style={{
                padding: "12px 16px",
                marginBottom: "10px",
                background: "#f3f3f3",
                borderRadius: "10px"
              }}
            >
              <strong>{t.start} – {t.end}</strong>
              <p style={{ margin: 0 }}>{t.task}</p>
            </div>
          ))}
        </div>
      </body>
    </html>
  );
}