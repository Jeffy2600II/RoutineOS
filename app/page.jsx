"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [day, setDay] = useState("");
  
  useEffect(() => {
    const d = new Date();
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    setDay(days[d.getDay()]);
    
    fetch("/api/schedule")
      .then(res => res.json())
      .then(data => setTasks(data[days[d.getDay()]] || []));
  }, []);
  
  return (
    <main style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>📅 กิจวัตรประจำวัน</h1>
      <h2 style={{ marginTop: "-10px", color: "#666" }}>
        วันนี้: {day.toUpperCase()}
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
    </main>
  );
}