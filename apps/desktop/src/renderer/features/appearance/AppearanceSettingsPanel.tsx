/**
 * 模块用途：展示角色选择和面板不透明度两组外观设置。
 * 模块边界：只收发外观数值，不管理设置导航或直接读写本地存储。
 */
import { SlidersHorizontal } from "lucide-react";
import type { CharacterPack } from "../sidebar/characterPack";
import { MAX_PANEL_OPACITY, MIN_PANEL_OPACITY } from "./appearanceSettings";
import { CharacterPicker } from "./CharacterPicker";

interface AppearanceSettingsPanelProps {
  characterId: string;
  characters: CharacterPack[];
  panelOpacity: number;
  onCharacterChange(characterId: string): void;
  onPanelOpacityChange(value: number): void;
}

export function AppearanceSettingsPanel(props: AppearanceSettingsPanelProps) {
  return (
    <section className="settings-section appearance-settings-section">
      <header className="settings-section-header">
        <h2>外观</h2>
        <p>选择陪伴角色，并调整桌面面板的清晰程度。</p>
      </header>
      <div className="appearance-settings-group">
        <div className="settings-group-heading">
          <h3>桌宠角色</h3>
          <p>角色只改变桌宠外观和动作，待办界面保持一致</p>
        </div>
        <CharacterPicker
          characters={props.characters}
          selectedId={props.characterId}
          onChange={props.onCharacterChange}
        />
      </div>
      <div className="settings-section-divider" />
      <div className="appearance-settings-group">
        <div className="appearance-settings-heading">
          <span className="appearance-settings-icon" aria-hidden="true">
            <SlidersHorizontal size={18} strokeWidth={1.9} />
          </span>
          <div>
            <h3>面板不透明度</h3>
            <p>桌面内容保持可见，文字和按钮始终清晰。</p>
          </div>
          <output htmlFor="panel-opacity">{props.panelOpacity}%</output>
        </div>
        <input
          id="panel-opacity"
          aria-label="面板不透明度"
          max={MAX_PANEL_OPACITY}
          min={MIN_PANEL_OPACITY}
          step="1"
          type="range"
          value={props.panelOpacity}
          onChange={(event) => props.onPanelOpacityChange(Number(event.target.value))}
        />
        <div className="appearance-settings-scale" aria-hidden="true">
          <span>更透明</span><span>更清晰</span>
        </div>
      </div>
    </section>
  );
}
