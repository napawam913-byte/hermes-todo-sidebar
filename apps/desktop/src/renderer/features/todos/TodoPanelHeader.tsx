/**
 * 模块用途：统一待办工作面与设置控制台的全局标题和右侧动作。
 * 模块边界：只发送打开或关闭设置事件，不持有面板会话状态。
 */
import { Settings2 } from "lucide-react";
import { IconButton, QuietButton } from "../../components/buttons";

interface TodoPanelHeaderProps {
  settingsOpen: boolean;
  onCloseSettings(): void;
  onOpenSettings(): void;
}

export function TodoPanelHeader(props: TodoPanelHeaderProps) {
  return (
    <header className="todo-panel-header">
      <h1>{props.settingsOpen ? "设置" : "待办事项"}</h1>
      <div className="panel-actions">
        {props.settingsOpen ? (
          <QuietButton className="settings-done-button" onClick={props.onCloseSettings}>
            完成
          </QuietButton>
        ) : (
          <IconButton
            icon={<Settings2 size={17} strokeWidth={1.8} />}
            onClick={props.onOpenSettings}
          >
            打开设置
          </IconButton>
        )}
      </div>
    </header>
  );
}
