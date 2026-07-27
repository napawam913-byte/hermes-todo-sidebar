/**
 * 模块用途：让浏览器预览使用与 Electron 相同的响应式面板比例。
 * 模块边界：只计算 viewport 内尺寸，不处理桌宠锚点或显示器坐标。
 */
export function calculateBrowserPanelSize(viewportWidth: number, viewportHeight: number) {
  const panelWidth = Math.min(
    viewportWidth,
    clamp(Math.round(viewportWidth * 0.5), 360, 960)
  );
  const panelHeight = Math.max(0, Math.min(
    viewportHeight - 104,
    clamp(Math.round(viewportHeight * 0.57), 420, 720)
  ));
  return { panelHeight, panelWidth };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
