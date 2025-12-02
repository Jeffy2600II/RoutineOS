"use client";
import { useEffect, useState } from "react";

// ดึงข้อมูลกิจวัตร
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
  
  // ดึงข้อมูลกิจวัตร
  useEffect(() => {
    fetchSchedule().then(setSchedule);
  }, []);
  
  // ขอ permission แจ้งเตือนทันทีถ้ายังไม่ได้อนุญาต
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);
  
  // ตั้ง timer แจ้งเตือนกิจวัตรวันนี้เมื่อ permissions เป็น granted
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    const tasks = schedule[days[todayIndex]?.key] || [];
    const timers = [];
    tasks.forEach(t => {
      const [h, m] = t.start.split(":").map(Number);
      const now = new Date();
      const taskTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      const msUntilTask = taskTime.getTime() - now.getTime();
      if (msUntilTask > 0) {
        timers.push(setTimeout(() => {
          try {
            new Notification("ถึงเวลาเริ่มกิจวัตร!", {
              body: `${t.start} - ${t.task}`,
              icon: "/icon-192.png"
            });
          } catch (err) {
            console.log("Notification error (main timer):", err);
          }
        }, msUntilTask));
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [schedule, todayIndex]);
  
  // sync วันอัตโนมัติ
  useEffect(() => {
    const interval = setInterval(() => {
      const nowDayIdx = new Date().getDay();
      if (nowDayIdx !== selectedDayIndex) setSelectedDayIndex(nowDayIdx);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedDayIndex]);
  
  // ฟังก์ชั่นปุ่มทดสอบแจ้งเตือน
  function testNotification() {
    if (!(typeof window !== "undefined" && "Notification" in window)) {
      alert("เบราว์เซอร์คุณไม่รองรับการแจ้งเตือน");
      return;
    }
    const permission = Notification.permission;
    console.log("Current Notification.permission:", permission);
    
    if (permission === "granted") {
      try {
        const n = new Notification("🎉 ทดสอบแจ้งเตือน!", {
          body: "นี่คือข้อความทดสอบบน RoutineOS",
          icon: "/icon-192.png"
        });
        n.onshow = () => console.log("Notification shown");
        n.onerror = (e) => console.log("Notification API error:", e);
      } catch (err) {
        console.error("Notification error:", err);
        alert("เกิดข้อผิดพลาดขณะแจ้งเตือน ดู Console เพิ่มเติม");
      }
    } else if (permission === "denied") {
      alert("คุณได้ปฏิเสธสิทธิ์แจ้งเตือน กรุณาเปิดสิทธิ์ในเบราว์เซอร์ก่อนใช้งานฟีเจอร์นี้");
    } else {
      Notification.requestPermission().then(result => {
        if (result === "granted") {
          try {
            const n = new Notification("🎉 ทดสอบแจ้งเตือน!", {
              body: "นี่คือข้อความทดสอบบน RoutineOS",
              icon: "/icon-192.png"
            });
            n.onshow = () => console.log("Notification shown");
          } catch (err) {
            console.error("Notification error (pt2):", err);
          }
        } else if (result === "denied") {
          alert("คุณได้ปฏิเสธสิทธิ์แจ้งเตือน กรุณาเปิดสิทธิ์ในเบราว์เซอร์ก่อนใช้งานฟีเจอร์นี้");
        } else {
          alert("คุณยังไม่ได้อนุญาตให้แจ้งเตือน");
        }
      });
    }
  }
  
  const selectedDay = days[selectedDayIndex] || days[todayIndex];
  const selectedTasks = schedule[selectedDay.key] || [];
  
  return (
    <>
      <h1>📅 กิจวัตรประจำวัน</h1>
      <button
        onClick={testNotification}
        style={{
          marginBottom: 16,
          padding: "8px 24px",
          borderRadius: 8,
          background: "#5fdb5f",
          color: "#232",
          border: "none",
          fontWeight: "bold",
          cursor: "pointer"
        }}
      >
        ทดสอบแจ้งเตือน
      </button>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {days.map((d, idx) => (
          <button
            key={d.key}
            onClick={() => setSelectedDayIndex(idx)}
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
          onClick={() => setSelectedDayIndex(todayIndex)}
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
      <div style={{ marginTop:16,color:"#888" }}>
        แจ้งเตือน: <strong>{
          (typeof window !== "undefined" && "Notification" in window)
            ? Notification.permission
            : "เบราว์เซอร์ไม่รองรับ"
        }</strong>
      </div>
    </>
  );
}