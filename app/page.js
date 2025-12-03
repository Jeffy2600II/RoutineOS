"use client";
import { useEffect, useState, useRef } from "react";

// ดึงข้อมูลกิจวัตร
async function fetchSchedule() {
  const res = await fetch("/api/schedule");
  return res.json();
}

function canUseNotificationAPI() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    typeof Notification === "function"
  );
}

export default function Home() {
  const [schedule, setSchedule] = useState({});
  const [notificationStatus, setNotificationStatus] = useState("loading");
  const [registration, setRegistration] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nextTaskInfo, setNextTaskInfo] = useState(null);
  const [notifiedTasks, setNotifiedTasks] = useState(new Set());
  const [realtimeStatus, setRealtimeStatus] = useState("🟡 ยังไม่เชื่อมต่อ");
  const [eventSource, setEventSource] = useState(null);

  // --- สำหรับ TIMER ทดสอบแจ้งเตือน real-time ---
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [timerId, setTimerId] = useState(null);
  const [timerStatus, setTimerStatus] = useState("");
  const eventSourceRef = useRef();

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

  // ลงทะเบียน Service Worker + เชื่อมต่อ SSE
  useEffect(() => {
    if (canUseNotificationAPI() && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          setRegistration(reg);
          connectToRealtimeNotifications();
        })
        .catch((error) => {
          console.error("❌ Service Worker registration failed:", error);
        });
    }
  }, []);

  // ✨ Real-Time Connection via SSE
  function connectToRealtimeNotifications() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const es = new window.EventSource("/api/notifications/subscribe");
    eventSourceRef.current = es;
    setEventSource(es);

    es.onopen = () => {
      setRealtimeStatus("🟢 เชื่อมต่อแล้ว (Real-Time)");
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Real-time task
        if (data.type === "upcoming-task") {
          const taskId = `${data.dayIndex}-${data.task.start}-${data.task.task}`;
          if (!notifiedTasks.has(taskId)) {
            sendNotification(`🔔 ถึงเวลาเริ่มกิจวัตร!`, {
              body: `${data.task.start} - ${data.task.task}\n\n📝 ${data.task.description}`,
              tag: `task-${data.task.start}`,
            });
            setNotifiedTasks((prev) => new Set(prev).add(taskId));
            playNotificationSound();
          }
        }

        // Real-time test timer: แจ้งเตือนทดสอบ
        if (data.type === "timer" && data.id === timerId) {
          sendNotification(`⏰ แจ้งเตือนทดสอบ!`, {
            body: data.message || `ครบเวลา ${data.minutes} นาที`,
            tag: `test-timer-${data.id}`,
          });
          playNotificationSound();
          setTimerStatus("✅ แจ้งเตือนแล้ว");
          setTimerId(null);
        }
      } catch {}
    };

    es.onerror = () => {
      setRealtimeStatus("🟡 การเชื่อมต่อขาดหายไป กำลัง reconnect...");
      setTimeout(connectToRealtimeNotifications, 3000);
    };
  }

  // ขอ permission แจ้งเตือน
  useEffect(() => {
    if (canUseNotificationAPI()) {
      setNotificationStatus(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then(setNotificationStatus);
      }
    } else {
      setNotificationStatus("not-supported");
    }
  }, []);

  // ฟังก์ชัน: ส่งแจ้งเตือน
  const sendNotification = async (title, options = {}) => {
    if (!registration) {
      console.warn("⚠️ Service Worker not ready");
      return;
    }
    try {
      await registration.showNotification(title, {
        badge: "/icon-192.png",
        icon: "/icon-192.png",
        vibrate: [200, 100, 200],
        requireInteraction: true,
        ...options,
      });
      console.log(`✅ Notification sent: ${title}`);
    } catch (err) {
      console.error("❌ Notification error:", err);
    }
  };

  // ฟังก์ชัน: เล่นเสียงแจ้งเตือน
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800; // ความถี่เสียง
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.warn("⚠️ Audio notification not available");
    }
  };

  // อัปเดตเวลาปัจจุบันทุกวินาที (สำหรับแสดง Clock เท่านั้น)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ฟังก์ชัน: หางานถัดไป
  const getNextTask = () => {
    const tasks = schedule[days[todayIndex]?.key] || [];
    const now = new Date();
    const currentSeconds =
      now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    for (let task of tasks) {
      const [h, m] = task.start.split(":").map(Number);
      const taskStartSeconds = h * 3600 + m * 60;

      if (taskStartSeconds > currentSeconds) {
        const secondsUntil = taskStartSeconds - currentSeconds;
        const hours = Math.floor(secondsUntil / 3600);
        const minutes = Math.floor((secondsUntil % 3600) / 60);
        const seconds = secondsUntil % 60;
        return {
          task: task.task,
          description: task.description,
          start: task.start,
          timeUntil:
            hours > 0
              ? `${hours}ชม ${minutes}นาที ${seconds}วินาที`
              : `${minutes}นาที ${seconds}วินาที`,
          isImmediate: secondsUntil < 300,
        };
      }
    }
    return null;
  };

  useEffect(() => {
    setNextTaskInfo(getNextTask());
  }, [currentTime, schedule, todayIndex]);

  // Sync วันอัตโนมัติ
  useEffect(() => {
    const interval = setInterval(() => {
      const nowDayIdx = new Date().getDay();
      if (nowDayIdx !== selectedDayIndex) {
        setSelectedDayIndex(nowDayIdx);
        setNotifiedTasks(new Set());
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedDayIndex]);

  // ------ ส่วน TEST TIMER (แจ้งเตือนล่วงหน้า) ------
  async function startTestTimer() {
    setTimerStatus("⏳ กำลังนับถอยหลัง...");
    const res = await fetch("/api/notifications/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minutes: timerMinutes,
        message: `แจ้งเตือนทดสอบครบ ${timerMinutes} นาที`,
      }),
    });
    const { id } = await res.json();
    setTimerId(id);
  }

  async function cancelTestTimer() {
    if (!timerId) return;
    await fetch("/api/notifications/timer", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: timerId }),
    });
    setTimerStatus("❌ ยกเลิกเรียบร้อย");
    setTimerId(null);
  }

  // รูปแบบเวลาปัจจุบัน HH:MM:SS
  const currentTimeFormatted = currentTime.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  let notificationText = "";
  let notificationColor = "";
  switch (notificationStatus) {
    case "granted":
      notificationText = "เปิดใช้งานแล้ว ✅";
      notificationColor = "#4caf50";
      break;
    case "denied":
      notificationText = "คุณไม่อนุญาตแจ้งเตือน ❌";
      notificationColor = "#f44336";
      break;
    case "default":
      notificationText = "ยังไม่ได้อนุญาต 🟡";
      notificationColor = "#ff9800";
      break;
    case "not-supported":
      notificationText = "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน";
      notificationColor = "#9e9e9e";
      break;
    default:
      notificationText = "กำลังตรวจสอบ...";
      notificationColor = "#2196f3";
  }

  const selectedDay = days[selectedDayIndex] || days[todayIndex];
  const selectedTasks = schedule[selectedDay?.key] || [];

  return (
    <>
      <h1>📅 ตารางกิจวัตรประจำวัน</h1>

      {/* CLOCK */}
      <div style={{
        marginBottom: 20, padding: "16px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "#fff", borderRadius: 12,
        boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "14px", opacity: 0.9 }}>🕐 เวลาปัจจุบัน</div>
        <div style={{
          fontSize: "48px", fontWeight: "bold", marginTop: 8,
          fontFamily: "monospace", letterSpacing: "2px"
        }}>{currentTimeFormatted}</div>
        <div style={{ fontSize: "12px", marginTop: 8, opacity: 0.85 }}>
          {days[todayIndex]?.label} • {currentTime.toLocaleDateString("th-TH")}
        </div>
      </div>

      {/* ส่วนแสดงงานถัดไป */}
      {nextTaskInfo && (
        <div style={{
            marginBottom: 20,
            padding: "16px",
            background: nextTaskInfo.isImmediate
              ? "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
              : "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            color: "#fff",
            borderRadius: 12,
            boxShadow: nextTaskInfo.isImmediate
              ? "0 4px 20px rgba(245, 87, 108, 0.5)"
              : "0 4px 15px rgba(79, 172, 254, 0.4)",
            animation: nextTaskInfo.isImmediate ? "pulse 1s infinite" : "none",
          }}>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.8; }
            }
          `}</style>
          <div style={{ fontSize: "14px", opacity: 0.9 }}>
            {nextTaskInfo.isImmediate ? "⚡ เร่งด่วน!" : "⏳ งานถัดไป"}
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", marginTop: 8 }}>
            {nextTaskInfo.start} - {nextTaskInfo.task}
          </div>
          <div style={{ fontSize: "14px", marginTop: 6, opacity: 0.95 }}>
            📝 {nextTaskInfo.description}
          </div>
          <div style={{
            fontSize: nextTaskInfo.isImmediate ? "20px" : "16px",
            marginTop: 8, fontWeight: "bold", fontFamily: "monospace"
          }}>
            ⏱️ {nextTaskInfo.timeUntil}
          </div>
        </div>
      )}

      {/* ปุ่มทดสอบแจ้งเตือน */}
      <button
        onClick={() => sendNotification("🎉 ทดสอบแจ้งเตือน!", {
          body: "นี่คือข้อความทดสอบจาก RoutineOS\n\n✅ ระบบแจ้งเตือนทำงานปกติแล้ว",
        })}
        style={{
          marginBottom: 16,
          padding: "12px 28px",
          borderRadius: 8,
          background: "#5fdb5f",
          color: "#fff",
          border: "none",
          fontWeight: "bold",
          cursor: "pointer",
          fontSize: "16px",
          boxShadow: "0 4px 10px rgba(95, 219, 95, 0.3)",
          transition: "all 0.3s",
        }}
        onMouseEnter={e => (e.target.style.background = "#4ac94a")}
        onMouseLeave={e => (e.target.style.background = "#5fdb5f")}
      >
        🔔 ทดสอบแจ้งเตือน
      </button>

      {/* --- ฟอร์มทดลองแจ้งเตือน real-time --- */}
      <div style={{
        marginTop: 30,
        background: '#fffbe0',
        borderRadius: '10px',
        padding: '16px',
        boxShadow: '0 2px 8px #ffd',
        maxWidth: 350,
      }}>
        <h3>🔬 ทดสอบแจ้งเตือนแบบตั้งเวลา</h3>
        <div>
          <input
            type="number"
            min={1}
            max={60}
            value={timerMinutes}
            onChange={e => setTimerMinutes(Number(e.target.value))}
            style={{ width: 60, fontSize: 18, borderRadius: 6, border: '1px solid #ccc', marginRight: '8px' }}
          />
          <span>นาที</span>
        </div>
        <button
          disabled={!!timerId}
          onClick={startTestTimer}
          style={{
            margin: '12px 8px 12px 0', padding: "6px 16px", background: "#5fdb5f", color: "#fff", border: 'none', borderRadius: 6
          }}
        >
          ▶️ เริ่ม
        </button>
        <button
          disabled={!timerId}
          onClick={cancelTestTimer}
          style={{
            margin: '12px 0', padding: "6px 16px", background: "#fa3f3f", color: "#fff", border: 'none', borderRadius: 6
          }}
        >
          ⏹️ หยุด
        </button>
        <div style={{marginTop:10, fontSize:16}}>{timerStatus}</div>
      </div>

      {/* ปุ่มเลือกวัน */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {days.map((d, idx) => (
          <button
            key={d.key}
            onClick={() => setSelectedDayIndex(idx)}
            style={{
              background: idx === selectedDayIndex ? "#2257df" : "#f5f5f5",
              color: idx === selectedDayIndex ? "#fff" : "#333",
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              fontWeight: idx === selectedDayIndex ? "bold" : "normal",
              cursor: "pointer",
              boxShadow: idx === selectedDayIndex ? "0 2px 10px #ccd" : "none",
              transition: "all 0.2s",
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
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            marginLeft: 6,
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => (e.target.style.background = "#ffc947")}
          onMouseLeave={e => (e.target.style.background = "#ffda60")}
        >
          ↩️ วันนี้
        </button>
      </div>

      <h2 style={{ marginTop: "-10px", color: "#666" }}>
        📋 กิจวัตรประจำวัน "{selectedDay.label}"
      </h2>

      <div style={{ marginTop: "18px" }}>
        {selectedTasks.length === 0 ? (
          <div style={{
            color: "#999", padding: "20px", textAlign: "center",
            background: "#f5f5f5", borderRadius: 8,
          }}>
            ไม่มีข้อมูลกิจวัตรวันนี้
          </div>
        ) : (
          selectedTasks.map((t, i) => {
            const [sh, sm] = t.start.split(":").map(Number);
            const [eh, em] = t.end.split(":").map(Number);
            const now = new Date();
            const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

            const isCurrentTask =
              sh * 3600 + sm * 60 <= nowSec &&
              eh * 3600 + em * 60 > nowSec &&
              selectedDayIndex === todayIndex;

            return (
              <div key={i}
                style={{
                  padding: "16px", marginBottom: "12px",
                  background: isCurrentTask
                    ? "linear-gradient(135deg, #fff5b4 0%, #ffe082 100%)"
                    : "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                  borderRadius: "10px",
                  borderLeft: isCurrentTask ? "5px solid #ff9800" : "5px solid #2257df",
                  boxShadow: isCurrentTask
                    ? "0 4px 15px rgba(255, 152, 0, 0.3)"
                    : "0 2px 8px rgba(0,0,0,0.1)",
                  animation: isCurrentTask ? "pulse 1s infinite" : "none",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: "bold", fontSize: "16px",
                      color: isCurrentTask ? "#ff9800" : "#2257df"
                    }}>
                      {isCurrentTask && "🔴 "} ⏰ {t.start} – {t.end}
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: "600", marginTop: 6, color: "#333" }}>
                      📌 {t.task}
                    </div>
                    <div style={{ fontSize: "13px", marginTop: 8, color: "#666", lineHeight: "1.5" }}>
                      📝 {t.description}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* สถานะแจ้งเตือน */}
      <div style={{ marginTop: 24, padding: "16px",
          background: `${notificationColor}15`,
          borderLeft: `4px solid ${notificationColor}`,
          borderRadius: 8, color: "#333",
        }}>
        <div style={{ fontSize: "14px", color: "#666" }}>📢 สถานะแจ้งเตือน</div>
        <div style={{ fontSize: "18px", fontWeight: "bold", marginTop: 6, color: notificationColor }}>
          {notificationText}
        </div>
        <div style={{
            fontSize: "13px", marginTop: 12, padding: "8px 12px",
            background: realtimeStatus.includes("🟢") ? "#e8f5e9" : "#fff3e0",
            borderRadius: 6,
            color: realtimeStatus.includes("🟢") ? "#2e7d32" : "#e65100",
          }}>
          <strong>🌐 Real-Time Status:</strong> {realtimeStatus}
        </div>
      </div>
      <div style={{
        marginTop: 32, textAlign: "center", color: "#999", fontSize: "12px"
      }}>
        <div>⚡ ระบบ Real-Time แบบสตรีม (ไม่กินทรัพยากรมาก)</div>
        <div style={{ marginTop: 8 }}>
          🔔 แจ้งเตือนจะเข้ามาทันทีเมื่อถึงกิจวัตร/ทดสอบ timer
        </div>
        <div style={{ marginTop: 8 }}>
          ⭐ งานปัจจุบันจะไฮไลต์เหลืองอัตโนมัติ
        </div>
        <div style={{ marginTop: 8 }}>
          🌐 เชื่อมต่อ SSE แท้จริง
        </div>
      </div>
    </>
  );
}