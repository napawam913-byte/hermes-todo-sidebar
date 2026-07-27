/**
 * 模块用途：装配外观设置与模型连接设置，并接入会话级 AI 配置控制器。
 * 模块边界：不管理顶层面板路由，不进入 AI 对话或修改业务数据。
 */
import type { AiPlannerController } from "../ai/useAiPlanner";
import type { PlanApiDataServiceController } from "../../data/usePlanApiDataService";
import { AppearanceSettingsPanel } from "../appearance/AppearanceSettingsPanel";
import type { CharacterPack } from "../sidebar/characterPack";
import type { SettingsSection } from "../sidebar/panelSessionState";
import { ModelConnectionSettings } from "./ModelConnectionSettings";
import { DataServiceSettings } from "./DataServiceSettings";
import { SettingsShell } from "./SettingsShell";
import { getDataServiceStatus } from "./dataServicePresentation";
import { getSettingsModelStatus } from "./settingsModelStatus";

interface SettingsPanelProps {
  characterId: string;
  characters: CharacterPack[];
  panelOpacity: number;
  planner: AiPlannerController;
  dataService?: PlanApiDataServiceController;
  section: SettingsSection;
  onCharacterChange(characterId: string): void;
  onPanelOpacityChange(value: number): void;
  onSectionChange(section: SettingsSection): void;
}

export function SettingsPanel(props: SettingsPanelProps) {
  const status = getSettingsModelStatus(
    Boolean(props.planner.config?.configured),
    props.planner.configConnection
  );
  const dataStatus = props.dataService
    ? getDataServiceStatus({
      status: props.dataService.status,
      configured: Boolean(props.dataService.config?.configured),
      testResult: null
    })
    : { label: "只读", tone: "unconfigured" as const };

  return (
    <SettingsShell
      activeSection={props.section}
      modelStatus={status}
      dataStatus={dataStatus}
      onSectionChange={props.onSectionChange}
      appearance={(
        <AppearanceSettingsPanel
          characterId={props.characterId}
          characters={props.characters}
          panelOpacity={props.panelOpacity}
          onCharacterChange={props.onCharacterChange}
          onPanelOpacityChange={props.onPanelOpacityChange}
        />
      )}
      model={(
        <ModelConnectionSettings
          busy={props.planner.busy}
          config={props.planner.config}
          connection={props.planner.configConnection}
          draft={props.planner.configDraft}
          error={props.planner.error}
          status={status}
          onFieldChange={props.planner.changeConfigField}
          onSave={props.planner.saveConfigAndStay}
          onTest={props.planner.testConnection}
        />
      )}
      data={<DataServiceSettings dataService={props.dataService} />}
    />
  );
}
