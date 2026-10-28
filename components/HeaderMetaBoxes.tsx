"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

export default function HeaderMetaBoxes() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) {
    return (
      <div className="header-datetime-badge" style={{ opacity: 0 }}>
        <Calendar size={14} strokeWidth={2} />
        <span>00 --- 0000 &bull; 00:00</span>
      </div>
    );
  }

  const dateStr = now.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="header-datetime-badge">
      <Calendar size={14} strokeWidth={2} style={{ color: "var(--red)" }} />
      <span>
        {dateStr} &bull; {timeStr}
      </span>
    </div>
  );
}
