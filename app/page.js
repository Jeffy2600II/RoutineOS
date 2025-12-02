"use client";
import { useEffect, useState } from "react";

// ดึงข้อมูลจาก API
async function fetchSchedule() {
  const res = await fetch("/api/schedule");
  return res.json();
}

export default function Home() {
  const [schedule, setSchedule] = useState({});
  const days = [
    { key: "sunday", label: "อาทิตย์" },
    { key: "monday", label: "จันทร์" },
    { key: "tuesday", label: "อังคาร" },
    { key: "wednesday", label: "พุธ" },
    { key: "thursday", label: "พฤหัส" },
    { key: "friday", label: "ศุกร์" },
    { key: "saturday", label: "เสาร์" },
  ];
  const todayIndex = new Date().getDay();
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex);
  
  // ดึงข้อมูลกิจวัตรล่าสุด (auto sync)
  useEffect(() => {
    fetchSchedule().then(setSchedule);
  }, []);
  
  // เลือกวันในตารางเพื่อดูรายละเอียด
  function handleSelectDay(idx) {
    setSelectedDayIndex(idx);
  }
  
  // ปุ่ม sync: กลับสู่วันนี้
  function handleSyncToday() {
    setSelectedDayIndex(todayIndex);
  }
  
  // auto sync เมื่อวันเปลี่ยน
  useEffect(() => {
    const interval = setInterval(() => {
      const nowDayIdx = new Date().getDay();
      if (nowDayIdx !== selectedDayIndex) {
        setSelectedDayIndex(nowDayIdx);
      }
    }, 1000 * 60 * 1); // check ทุก 1 นาที
    return () => clearInterval(interval);
  }, [selectedDayIndex]);
  
  const selectedDay = days[selectedDayIndex] || days[todayIndex];
  const selectedTasks = schedule[selectedDay.key] || [];
  
  return (
    <>
      <h1>📅 กิจวัตรประจำวัน</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {days.map((d, idx) => (
          <button
            key={d.key}
            onClick={() => handleSelectDay(idx)}
            style={{
              background: idx === selectedDayIndex ? "#2257df" : "#f5f5f5",
              color: idx === selectedDayIndex ? "#fff" : "#333",
              padding: "6px 18px",
              borderRadius: 8,
              border: "none",
              fontWeight: idx === selectedDayIndex ? "bold" : "normal",
              cursor: "pointer",
              boxShadow: idx === selectedDayIndex ? "0 2px 10px #ccd" : "none"
            }}
          >
            {d.label}
          </button>
        ))}
        <button
          onClick={handleSyncToday}
          style={{
            background: "#ffda60",
            color: "#222",
            padding: "6px 18px",
            borderRadius: 8,
            border: "none",
            marginLeft: 6,
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Sync (กลับสู่วันนี้)
        </button>
      </div>
      <h2 style={{ marginTop: "-10px", color: "#666" }}>
        กิจวัตรประจำวัน "{selectedDay.label}"
      </h2>
      <div style={{ marginTop: "18px" }}>
        {selectedTasks.length === 0 ? (
          <div style={{ color: "#999" }}>ไม่มีข้อมูลกิจวัตรวันนี้</div>
        ) : (
          selectedTasks.map((t, i) => (
            <div
              key={i}
              style={{
                padding: "12px 16px",
                marginBottom: "10px",
                background: "#eef",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "16px"
              }}
            >
              <div style={{ fontWeight: "bold", minWidth: 85 }}>{t.start} – {t.end}</div>
              <div>{t.task}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}