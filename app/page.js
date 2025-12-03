"use client";
import { useEffect, useState } from "react";

// ดึงข้อมูลกิจวัตร
async function fetchSchedule() {
  const res = await fetch("/api/schedule");
  return res.json();
}

function canUseNotificationAPI() {
  return typeof window !== "undefined"
    && "Notification" in window
    && typeof Notification === "function";
}

export default function Home() {
  const [schedule, setSchedule] = useState({});
  const [notificationStatus, setNotificationStatus] = useState("loading");
  const [registration, setRegistration] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date()); // เวลาปัจจุบัน (Real-time)
  const [nextTaskInfo, setNextTaskInfo] = useState(null);
  const [notifiedTasks, setNotifiedTasks] = useState(new Set()); // ป้องกันแจ้งเตือนซ้ำ

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

  // ลงทะเบียน Service Worker
  useEffect(() => {
    if (canUseNotificationAPI() && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("✅ Service Worker registered:", reg);
          setRegistration(reg);
        })
        . catch((error) => {
          console.error("❌ Service Worker registration failed:", error);
        });
    }
  }, []);

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
        ... options,
      });
      console.log(`✅ Notification sent: ${title}`);
    } catch (err) {
      console.error("❌ Notification error:", err);
    }
  };

  // ฟังก์ชัน: แปลงเวลา HH:MM เป็นวินาทีตั้งแต่เที่ยงคืน
  const timeToSeconds = (timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 3600 + m * 60;
  };

  // ฟังก์ชัน: ติดตามและแจ้งเตือนแบบเรียลไทม์
  const checkAndNotifyTasks = () => {
    const tasks = schedule[days[todayIndex]?. key] || [];
    const now = new Date();
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    tasks.forEach((task, index) => {
      const taskStartSeconds = timeToSeconds(task. start);
      const taskId = `${todayIndex}-${task.start}-${task.task}`; // สร้าง unique ID สำหรับงาน

      // ตรวจสอบว่าถึงเวลาเริ่มงาน (ภายใน 0-59 วินาทีของนาทีแรก)
      if (
        currentSeconds >= taskStartSeconds &&
        currentSeconds < taskStartSeconds + 60 &&
        !notifiedTasks. has(taskId) &&
        notificationStatus === "granted"
      ) {
        console.log(`🎯 Task notification triggered: ${task.task} at ${task.start}`);

        sendNotification(`🔔 ถึงเวลาเริ่มกิจวัตร!`, {
          body: `${task.start} - ${task.task}\n\n📝 ${task.description}`,
          tag: `task-${task.start}`,
        });

        // ป้องกันแจ้งเตือนซ้ำ
        setNotifiedTasks((prev) => new Set(prev). add(taskId));

        // ส่งเสียง (optional)
        playNotificationSound();
      }
    });
  };

  // ฟังก์ชัน: เล่นเสียงแจ้งเตือน (optional)
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // ความถี่เสียง
      oscillator. type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.warn("⚠️ Audio notification not available");
    }
  };

  // อัปเดตเวลาปัจจุบันทุกวินาที
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // อัปเดตทุก 1 วินาที (แทนที่เดิมที่ 30 วินาที)

    return () => clearInterval(interval);
  }, []);

  // ตรวจสอบและแจ้งเตือนทั่วไป
  useEffect(() => {
    checkAndNotifyTasks();
  }, [currentTime, schedule, todayIndex, notificationStatus, registration]);

  // ฟังก์ชัน: หางานถัดไป
  const getNextTask = () => {
    const tasks = schedule[days[todayIndex]?.key] || [];
    const now = new Date();
    const currentSeconds = now.getHours() * 3600 + now. getMinutes() * 60 + now.getSeconds();

    for (let task of tasks) {
      const taskStartSeconds = timeToSeconds(task.start);

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
          isImmediate: secondsUntil < 300, // งานที่จะเริ่มในอีก 5 นาที
        };
      }
    }

    return null;
  };

  // อัปเดตงานถัดไป
  useEffect(() => {
    const next = getNextTask();
    setNextTaskInfo(next);
  }, [currentTime, schedule, todayIndex]);

  // Sync วันอัตโนมัติ
  useEffect(() => {
    const interval = setInterval(() => {
      const nowDayIdx = new Date().getDay();
      if (nowDayIdx !== selectedDayIndex) {
        setSelectedDayIndex(nowDayIdx);
        setNotifiedTasks(new Set()); // รีเซ็ตงานที่แจ้งเตือนแล้ว
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedDayIndex]);

  // ฟังก์ชั่นปุ่มทดสอบแจ้งเตือน
  async function testNotification() {
    if (! canUseNotificationAPI()) {
      alert(
        "เบราว์เซอร์ของคุณไม่รองรับฟีเจอร์การแจ้งเตือน (Notification API)"
      );
      return;
    }

    console.log("📢 Testing notification.  Permission:", Notification.permission);

    if (Notification.permission === "granted") {
      if (! registration) {
        alert("Service Worker ยังไม่พร้อม กรุณารอสักครู่");
        return;
      }

      await sendNotification("🎉 ทดสอบแจ้งเตือน!", {
        body: "นี่คือข้อความทดสอบจากระบบ RoutineOS\n\n✅ ระบบแจ้งเตือนทำงานปกติแล้ว",
      });
      playNotificationSound();
    } else if (Notification.permission === "denied") {
      alert(
        "❌ คุณได้ปฏิเสธสิทธิ์แจ้งเตือน\n\nกรุณาเปิดสิทธิ์ในเบราว์เซอร์:\n1. ไปที่ Settings\n2. หา Notifications\n3. อนุญาตให้ RoutineOS ส่งแจ้งเตือน"
      );
    } else if (Notification.permission === "default") {
      Notification.requestPermission(). then(async (result) => {
        setNotificationStatus(result);
        if (result === "granted") {
          if (!registration) {
            alert("Service Worker ยังไม่พร้อม กรุณารอสักครู่");
            return;
          }

          await sendNotification("🎉 ทดสอบแจ้งเตือน!", {
            body: "นี่คือข้อความทดสอบจากระบบ RoutineOS\n\n✅ ระบบแจ้งเตือนทำงานปกติแล้ว",
          });
          playNotificationSound();
        }
      });
    }
  }

  const selectedDay = days[selectedDayIndex] || days[todayIndex];
  const selectedTasks = schedule[selectedDay. key] || [];

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
      notificationText = "กำลังตรวจสอบ...  ";
      notificationColor = "#2196f3";
  }

  return (
    <>
      <h1>📅 ตารางกิจวัตรประจำวัน</h1>

      {/* ส่วนเวลาปัจจุบัน (Real-time Clock) */}
      <div
        style={{
          marginBottom: 20,
          padding: "16px",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "#fff",
          borderRadius: 12,
          boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "14px", opacity: 0.9 }}>🕐 เวลาปัจจุบัน</div>
        <div
          style={{
            fontSize: "48px",
            fontWeight: "bold",
            marginTop: 8,
            fontFamily: "monospace",
            letterSpacing: "2px",
          }}
        >
          {currentTimeFormatted}
        </div>
        <div style={{ fontSize: "12px", marginTop: 8, opacity: 0.85 }}>
          {days[todayIndex]. label} • {currentTime.toLocaleDateString("th-TH")}
        </div>
      </div>

      {/* ส่วนแสดงงานถัดไป */}
      {nextTaskInfo && (
        <div
          style={{
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
            animation: nextTaskInfo.isImmediate ?  "pulse 1s infinite" : "none",
          }}
        >
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
          <div
            style={{
              fontSize: nextTaskInfo.isImmediate ?  "20px" : "16px",
              marginTop: 8,
              fontWeight: "bold",
              fontFamily: "monospace",
            }}
          >
            ⏱️ {nextTaskInfo.timeUntil}
          </div>
        </div>
      )}

      {/* ปุ่มทดสอบแจ้งเตือน */}
      <button
        onClick={testNotification}
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
        onMouseEnter={(e) => (e.target.style.background = "#4ac94a")}
        onMouseLeave={(e) => (e.target.style.background = "#5fdb5f")}
      >
        🔔 ทดสอบแจ้งเตือน
      </button>

      {/* ปุ่มเลือกวัน */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {days. map((d, idx) => (
          <button
            key={d.key}
            onClick={() => setSelectedDayIndex(idx)}
            style={{
              background: idx === selectedDayIndex ? "#2257df" : "#f5f5f5",
              color: idx === selectedDayIndex ?  "#fff" : "#333",
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
          onMouseEnter={(e) => (e.target.style.background = "#ffc947")}
          onMouseLeave={(e) => (e.target.style.background = "#ffda60")}
        >
          ↩️ วันนี้
        </button>
      </div>

      {/* หัวข้อ */}
      <h2 style={{ marginTop: "-10px", color: "#666" }}>
        📋 กิจวัตรประจำวัน "{selectedDay.label}"
      </h2>

      {/* รายการกิจวัตร */}
      <div style={{ marginTop: "18px" }}>
        {selectedTasks.length === 0 ? (
          <div
            style={{
              color: "#999",
              padding: "20px",
              textAlign: "center",
              background: "#f5f5f5",
              borderRadius: 8,
            }}
          >
            ไม่มีข้อมูลกิจวัตรวันนี้
          </div>
        ) : (
          selectedTasks.map((t, i) => {
            const isCurrentTask =
              timeToSeconds(t.start) <=
                new Date(). getHours() * 3600 +
                  new Date().getMinutes() * 60 +
                  new Date().getSeconds() &&
              timeToSeconds(t. end) >
                new Date().getHours() * 3600 +
                  new Date().getMinutes() * 60 +
                  new Date().getSeconds() &&
              selectedDayIndex === todayIndex;

            return (
              <div
                key={i}
                style={{
                  padding: "16px",
                  marginBottom: "12px",
                  background: isCurrentTask
                    ? "linear-gradient(135deg, #fff5b4 0%, #ffe082 100%)"
                    : "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                  borderRadius: "10px",
                  borderLeft: isCurrentTask ? "5px solid #ff9800" : "5px solid #2257df",
                  boxShadow: isCurrentTask
                    ? "0 4px 15px rgba(255, 152, 0, 0.3)"
                    : "0 2px 8px rgba(0,0,0,0.1)",
                  animation: isCurrentTask ? "pulse 1s infinite" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                    gap: "16px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: "16px",
                        color: isCurrentTask ? "#ff9800" : "#2257df",
                      }}
                    >
                      {isCurrentTask && "🔴 "} ⏰ {t.start} – {t.end}
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: "600",
                        marginTop: 6,
                        color: "#333",
                      }}
                    >
                      📌 {t.task}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        marginTop: 8,
                        color: "#666",
                        lineHeight: "1.5",
                      }}
                    >
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
      <div
        style={{
          marginTop: 24,
          padding: "16px",
          background: `${notificationColor}15`,
          borderLeft: `4px solid ${notificationColor}`,
          borderRadius: 8,
          color: "#333",
        }}
      >
        <div style={{ fontSize: "14px", color: "#666" }}>📢 สถานะแจ้งเตือน</div>
        <div
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            marginTop: 6,
            color: notificationColor,
          }}
        >
          {notificationText}
        </div>

        {notificationStatus === "not-supported" && (
          <div style={{ fontSize: "13px", marginTop: 8, color: "#666", lineHeight: "1.6" }}>
            ⚠️ แนะนำให้ใช้:<br />
            • <strong>Android:</strong> Chrome, Firefox, Edge<br />
            • <strong>iOS:</strong> Safari (iOS 16. 4+)<br />
            • <strong>Desktop:</strong> Chrome, Firefox, Edge
          </div>
        )}

        {notificationStatus === "denied" && (
          <div style={{ fontSize: "13px", marginTop: 8, color: "#f44336", lineHeight: "1.6" }}>
            🔧 วิธีแก้ไข:<br />
            1. ไปที่ Settings / การตั้งค่า<br />
            2. หา Notifications / การแจ้งเตือน<br />
            3.  ค้นหา RoutineOS และเปลี่ยนเป็น "Allow"
          </div>
        )}
      </div>

      {/* ส่วนท้าย */}
      <div style={{ marginTop: 32, textAlign: "center", color: "#999", fontSize: "12px" }}>
        <div>
          ⏱️ ติดตามเวลาแบบเรียลไทม์ (อัปเดตทุกวินาที)
        </div>
        <div style={{ marginTop: 8 }}>
          🔔 แจ้งเตือนอัตโนมัติจะเริ่มตรงเวลากิจวัตรแต่ละรายการ
        </div>
        <div style={{ marginTop: 8 }}>
          ⭐ งานปัจจุบันจะไฮไลต์เหลืองอัตโนมัติ
        </div>
      </div>
    </>
  );
}