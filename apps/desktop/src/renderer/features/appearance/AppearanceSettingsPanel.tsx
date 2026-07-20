/**
 * 模块用途：展示面板不透明度调节和模型连接设置入口。
 * 模块边界：只收发外观数值与导航事件，不直接读写本地存储。
 */
import { SlidersHorizontal, Sparkles } from "lucide-react";
import { DetailPageShell } from "../../components/DetailPageShell";
import { QuietButton } from "../../components/buttons";
import type { CharacterPack } from "../sidebar/characterPack";
import { MAX_PANEL_OPACITY, MIN_PANEL_OPACITY } from "./appearanceSettings";
import { CharacterPicker } from "./CharacterPicker";

interface AppearanceSettingsPanelProps {
  characterId: string;
  characters: CharacterPack[];
  panelOpacity: number;
  onBack(): void;
  onOpenAiConfig(): void;
  onCharacterChange(characterId: string): void;
  onPanelOpacityChange(value: number): void;
}

export function AppearanceSettingsPanel(props: AppearanceSettingsPanelProps) {
  return (
    <DetailPageShell label="桌宠设置" title="外观" onBack={props.onBack}>
      <div className="appearance-settings-body">
        <section className="appearance-settings-card">
          <div className="appearance-settings-heading is-character-heading">
            <div>
              <strong>桌宠角色</strong>
              <span>角色只改变桌宠外观和动作，待办界面保持一致</span>
            </div>
          </div>
          <CharacterPicker
            characters={props.characters}
            selectedId={props.characterId}
            onChange={props.onCharacterChange}
          />
        </section>

        <section className="appearance-settings-card">
          <div className="appearance-settings-heading">
            <span className="appearance-settings-icon" aria-hidden="true">
              <SlidersHorizontal size={18} strokeWidth={1.9} />
            </span>
            <div>
              <strong>面板不透明度</strong>
              <span>桌面内容保持可见，文字和按钮始终清晰。</span>
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
        </section>

        <section className="appearance-settings-link">
          <div>
            <strong>模型连接</strong>
            <span>配置 AI 安排使用的 OpenAI 兼容接口。</span>
          </div>
          <QuietButton
            icon={<Sparkles size={16} strokeWidth={1.8} />}
            onClick={props.onOpenAiConfig}
          >
            模型连接设置
          </QuietButton>
        </section>
      </div>
    </DetailPageShell>
  );
}
