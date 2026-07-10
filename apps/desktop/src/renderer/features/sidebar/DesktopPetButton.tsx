/**
 * 模块用途：桌宠式闲置入口，第一版只显示待办数量并触发展开。
 * 模块边界：只负责桌面悬浮入口展示，不读取或修改待办数据。
 */
import { ListTodo } from "lucide-react";

interface DesktopPetButtonProps {
  activeCount: number;
  onOpen: () => void;
}

export function DesktopPetButton({ activeCount, onOpen }: DesktopPetButtonProps) {
  return (
    <button className="desktop-pet-button" type="button" onClick={onOpen} aria-label="打开待办桌宠">
      <span className="desktop-pet-aura" />
      <span className="desktop-pet-body" aria-hidden="true">
        <span className="desktop-pet-ears">
          <span />
          <span />
        </span>
        <span className="desktop-pet-face">
          <span className="desktop-pet-eye" />
          <span className="desktop-pet-eye" />
        </span>
        <span className="desktop-pet-belly">
          <ListTodo size={16} strokeWidth={2} />
        </span>
      </span>
      {activeCount > 0 ? <span className="desktop-pet-count">{activeCount}</span> : null}
    </button>
  );
}
