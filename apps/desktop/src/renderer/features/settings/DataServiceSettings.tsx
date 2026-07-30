/**
 * 模块用途：提供 Plan API 数据服务配置、连接测试与首次迁移操作界面。
 * 模块边界：只调用传入控制器，不访问 preload，也不持久化明文 Token。
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  PlanApiConnectionInput,
  PlanApiConnectionMode,
  PlanApiConnectionTestResult
} from "../../../shared/planApiBridgeContract";
import type { PlanApiDataServiceController } from "../../data/usePlanApiDataService";
import { getDataServiceStatus, getMigrationPresentation } from "./dataServicePresentation";

interface DataServiceSettingsProps {
  dataService?: PlanApiDataServiceController;
}

interface ConnectionDraft extends PlanApiConnectionInput {}

const defaults: ConnectionDraft = {
  mode: "local", baseUrl: "http://127.0.0.1:8743", sshTarget: "",
  localPort: 8743, remotePort: 8743, desktopToken: ""
};

export function DataServiceSettings({ dataService }: DataServiceSettingsProps) {
  const [draft, setDraft] = useState<ConnectionDraft>(() => fromConfig(dataService));
  const [testResult, setTestResult] = useState<PlanApiConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirming, setConfirming] = useState<"migrate" | "keep" | null>(null);
  const testRequestVersion = useRef(0);

  useEffect(() => {
    if (!dataService
      || dataService.status.mode !== "migration_blocked"
      || dataService.migration
      || dataService.busy) return;
    void dataService.refreshMigration();
  }, [
    dataService?.busy,
    dataService?.migration,
    dataService?.refreshMigration,
    dataService?.status.mode
  ]);

  useEffect(() => {
    if (!dataService?.config) return;
    setDraft(fromConfig(dataService));
  }, [dataService?.config]);

  const controller = dataService;
  if (!controller) return <PreviewState />;
  const activeController: PlanApiDataServiceController = controller;
  const status = getDataServiceStatus({
    status: controller.status,
    configured: Boolean(controller.config?.configured),
    testResult
  });
  const complete = draft.mode === "local"
    ? Boolean(draft.baseUrl.trim())
    : Boolean(draft.sshTarget.trim() && draft.localPort && draft.remotePort);
  const tokenReady = Boolean(draft.desktopToken.trim() || activeController.config?.tokenConfigured);
  const requestBusy = controller.busy || testing;

  function update<K extends keyof ConnectionDraft>(field: K, value: ConnectionDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    testRequestVersion.current += 1;
    setTestResult(null);
    setConfirming(null);
  }

  async function testConnection() {
    if (testing) return;
    const requestVersion = ++testRequestVersion.current;
    setTesting(true);
    try {
      const result = await activeController.testConnection(connectionPayload(draft));
      if (requestVersion === testRequestVersion.current) setTestResult(result);
    } finally {
      setTesting(false);
    }
  }

  async function saveConnection(event: FormEvent) {
    event.preventDefault();
    if (!complete || !tokenReady) return;
    const payload = connectionPayload(draft);
    const submittedToken = draft.desktopToken;
    if (await activeController.saveConnection(payload)) {
      setDraft((current) => current.desktopToken === submittedToken
        ? { ...current, desktopToken: "" }
        : current);
      setTestResult(null);
    }
  }

  return (
    <section className="settings-section data-service-settings">
      <header className="settings-section-header data-service-header">
        <div><h2>数据服务</h2><p>配置 Plan API 的本地直连或云端 SSH。</p></div>
        <span className={`settings-status-pill is-${status.tone}`}><i aria-hidden="true" />{status.label}</span>
      </header>
      <div className="settings-section-divider" />
      {controller.error ? <div className="settings-inline-error" role="alert">{controller.error}</div> : null}
      <MigrationArea dataService={controller} confirming={confirming} onConfirming={setConfirming} />
      <form className="data-service-form" onSubmit={(event) => void saveConnection(event)}>
        <fieldset disabled={controller.busy}>
          <legend>连接模式</legend>
          <div className="data-service-mode" role="group" aria-label="连接模式">
            {(["local", "ssh"] as const).map((mode) => (
              <button
                aria-pressed={draft.mode === mode}
                className={draft.mode === mode ? "is-active" : undefined}
                key={mode}
                onClick={() => update("mode", mode)}
                type="button"
              >{mode === "local" ? "本地直连" : "云端 SSH"}</button>
            ))}
          </div>
        </fieldset>
        {draft.mode === "local" ? (
          <label>Base URL<input name="baseUrl" value={draft.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} /></label>
        ) : (
          <div className="data-service-ssh-fields">
            <label>SSH 目标<input name="sshTarget" value={draft.sshTarget} onChange={(event) => update("sshTarget", event.target.value)} /></label>
            <label>本地端口<input min="1" name="localPort" type="number" value={draft.localPort} onChange={(event) => update("localPort", Number(event.target.value))} /></label>
            <label>远端端口<input min="1" name="remotePort" type="number" value={draft.remotePort} onChange={(event) => update("remotePort", Number(event.target.value))} /></label>
          </div>
        )}
        <label>Desktop Token
          <input name="desktopToken" placeholder={controller.config?.tokenHint || "输入 Token"} type="password" value={draft.desktopToken} onChange={(event) => update("desktopToken", event.target.value)} />
          {controller.config?.tokenConfigured ? <small>已配置：{controller.config.tokenHint}</small> : null}
        </label>
        {testResult ? <p className={`data-service-test-result is-${testResult.ok ? "success" : "failure"}`} role="status">{testResult.message}</p> : null}
        <div className="data-service-actions">
          <button disabled={requestBusy || !complete || !tokenReady} onClick={() => void testConnection()} type="button">测试连接</button>
          <button disabled={requestBusy || !complete || !tokenReady} type="submit">保存连接</button>
        </div>
      </form>
      <ServiceFacts dataService={controller} draft={draft} testResult={testResult} />
    </section>
  );
}

function ServiceFacts({ dataService, draft, testResult }: {
  dataService: PlanApiDataServiceController;
  draft: ConnectionDraft;
  testResult: PlanApiConnectionTestResult | null;
}) {
  const { config, status } = dataService;
  return <dl className="data-service-facts">
    <div><dt>已保存连接模式</dt><dd>{modeLabel(config?.mode ?? "local")}</dd></div>
    {status.serverRevision !== undefined ? <div><dt>已保存服务版本</dt><dd>#{status.serverRevision}</dd></div> : null}
    {testResult?.ok ? <><div><dt>本次测试模式</dt><dd>{modeLabel(draft.mode)}</dd></div><div><dt>本次测试版本</dt><dd>#{testResult.serverRevision}</dd></div></> : null}
    {status.lastSyncedAt ? <div><dt>最近同步</dt><dd>{new Date(status.lastSyncedAt).toLocaleString()}</dd></div> : null}
  </dl>;
}

function MigrationArea({ dataService, confirming, onConfirming }: {
  dataService: PlanApiDataServiceController;
  confirming: "migrate" | "keep" | null;
  onConfirming(value: "migrate" | "keep" | null): void;
}) {
  if (!dataService.migration) return null;
  const view = getMigrationPresentation(dataService.migration);
  const disabled = dataService.busy || view.busy;
  const execute = async (action: "migrate" | "keep") => {
    if (confirming !== action) return onConfirming(action);
    const completed = action === "migrate"
      ? await dataService.migrateLegacyState()
      : await dataService.keepRemoteData();
    if (completed) onConfirming(null);
  };
  return <section className={`data-service-migration is-${view.tone}`}>
    <h3>{view.title}</h3><p>{view.detail}</p>
    {view.action ? <button disabled={disabled} onClick={() => void execute("migrate")} type="button">{confirming === "migrate" ? "再次确认迁移" : view.action}</button> : null}
    {view.canKeepRemote ? <button disabled={disabled} onClick={() => void execute("keep")} type="button">{confirming === "keep" ? "再次确认保留" : "保留云端数据"}</button> : null}
    {confirming ? <p className="data-service-confirm" role="alert">此操作会保留备份并改变数据来源，请再次确认。</p> : null}
  </section>;
}

function PreviewState() {
  return <section className="settings-section data-service-settings data-service-preview">
    <header className="settings-section-header"><div><h2>数据服务</h2><p>浏览器预览 / 桌面连接尚未接入</p></div><span className="settings-status-pill"><i aria-hidden="true" />只读</span></header>
    <div className="settings-section-divider" /><p>桌面连接接入后可在此配置和测试数据服务。</p>
  </section>;
}

function fromConfig(dataService?: PlanApiDataServiceController): ConnectionDraft {
  const config = dataService?.config;
  if (!config) return defaults;
  return { mode: config.mode as PlanApiConnectionMode, baseUrl: config.baseUrl, sshTarget: config.sshTarget, localPort: config.localPort, remotePort: config.remotePort, desktopToken: "" };
}

function connectionPayload(draft: ConnectionDraft): PlanApiConnectionInput {
  return draft.mode === "ssh"
    ? { ...draft, baseUrl: `http://127.0.0.1:${draft.localPort}` }
    : { ...draft };
}

function modeLabel(mode: PlanApiConnectionMode) {
  return mode === "ssh" ? "云端 SSH" : "本地直连";
}
