/**
 * 模块用途：维护当前本地日期，并在午夜、窗口聚焦和页面恢复可见时刷新。
 * 模块边界：只处理日期键，不读取待办、周期计划或 Electron 状态。
 */
import { useEffect, useState } from "react";

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function millisecondsUntilNextLocalDay(now: Date): number {
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return nextDay.getTime() - now.getTime() + 50;
}

export function useLocalDateKey(): string {
  const [dateKey, setDateKey] = useState(() => toLocalDateKey(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const refresh = () => {
      const now = new Date();
      setDateKey(toLocalDateKey(now));
      clearTimeout(timer);
      timer = setTimeout(refresh, millisecondsUntilNextLocalDay(now));
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return dateKey;
}
