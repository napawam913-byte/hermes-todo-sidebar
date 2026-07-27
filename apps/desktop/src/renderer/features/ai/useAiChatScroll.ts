/**
 * 模块用途：管理 AI 长对话的自动跟随、上翻保持和跳到最新。
 * 模块边界：只操作消息列表滚动，不管理消息内容或模型请求。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { isNearChatBottom, nextUnreadState } from "./aiChatScrollState";

export function useAiChatScroll(itemCount: number) {
  const listRef = useRef<HTMLDivElement>(null);
  const followsLatest = useRef(true);
  const previousCount = useRef(itemCount);
  const [hasUnread, setHasUnread] = useState(false);

  const jumpToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
    followsLatest.current = true;
    setHasUnread(false);
  }, []);

  const onScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    followsLatest.current = isNearChatBottom(list);
    if (followsLatest.current) setHasUnread(false);
  }, []);

  useEffect(() => {
    const hasNewMessage = itemCount > previousCount.current;
    previousCount.current = itemCount;
    if (!hasNewMessage) return;
    if (followsLatest.current) jumpToLatest("auto");
    else setHasUnread(nextUnreadState({ nearBottom: false, hasNewMessage }));
  }, [itemCount, jumpToLatest]);

  return { hasUnread, jumpToLatest, listRef, onScroll };
}
