/**
 * 模块用途：稍后提醒菜单，提供固定预设时间。
 * 模块边界：只返回分钟数，不计算具体提醒时间。
 */
interface SnoozeMenuProps {
  onSelect: (minutes: number) => void;
}
const options = [
  { label: "5 分钟", minutes: 5 },
  { label: "15 分钟", minutes: 15 },
  { label: "1 小时", minutes: 60 },
  { label: "明天", minutes: 24 * 60 }
];

export function SnoozeMenu({ onSelect }: SnoozeMenuProps) {
  return (
    <div className="snooze-menu" role="menu" aria-label="稍后提醒">
      {options.map((option) => (
        <button key={option.minutes} type="button" role="menuitem" onClick={() => onSelect(option.minutes)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
