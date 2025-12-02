import schedule from "../data/schedule.json"; // ปรับแบบนี้สำหรับ Vercel/Next.js Server Component

export default function Home() {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayIndex = new Date().getDay();
  const today = days[todayIndex];
  
  const tasks = schedule[today] || [];
  
  return (
    <>
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
    </>
  );
}