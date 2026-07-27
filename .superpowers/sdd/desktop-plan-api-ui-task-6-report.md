# Phase 3 Task 6 发布报告

## 修改文件

- `package.json`：根版本设为 `0.2.0-test.1`；`dist:win:compatible` 依次执行生产构建、Windows unpacked 打包和兼容目录生成；Windows 图标保持使用仓库内 `build/icon.ico`。
- `package-lock.json`：根包版本设为 `0.2.0-test.1`。
- `scripts/create-compatible-portable.mjs`：仅重组已经新鲜生成的 `release/win-unpacked`，保留版本化目录、版本化 EXE、中文说明和 `release/` 边界清理保护。
- `apps/desktop/src/main/windowsPackaging.test.ts`：覆盖仓库 ICO 和完整兼容打包命令链。
- `build/icon.ico`：已确认 ICO 文件头为 `00 00 01 00`，并被 Windows 打包配置引用。

## 设计取舍

`dist:win:compatible` 在 npm 命令链中执行 `npm run build && electron-builder --win --dir`，再运行复制脚本。这样每次命令都会从当前源码构建并生成新的 unpacked 包，不会把旧的 `release/win-unpacked` 直接当作发布副本；复制脚本仍负责将删除限制在 `release/` 内。

## 命令与结果

- `npm test -- --reporter=dot`：通过，131 个测试文件、474 个测试。
- `npm run typecheck`：通过。
- `npm run check:source-lines`：通过；受检目录无文件超过 220 行。
- `npm run build`：通过。
- `npm test -- --reporter=dot apps/desktop/src/main/windowsPackaging.test.ts`：通过，3 个测试。
- `npm run dist:win:compatible`：通过；执行生产构建、`electron-builder --win --dir`，并生成兼容目录。

## 生成目录

- `release/win-unpacked/`：由当前源码和 Electron 43.1.0 新鲜打包生成。
- `release/hermes-todo-sidebar-0.2.0-test.1-x64-portable-dir/`：已核对存在 `Hermes-Todo-Sidebar-0.2.0-test.1.exe`、`resources/app.asar` 和 `使用说明.txt`。
- `release/hermes-todo-sidebar-0.1.3-test.17-x64-portable-dir/`：仍存在，未被覆盖。

## 未解决问题

本机应用控制策略阻止 Electron 安装器加载其 ZIP 解压原生模块，且初始 `node_modules/electron/dist` 缺失。为完成验证，使用本机缓存的精确 `electron-v43.1.0-win32-x64.zip` 恢复了忽略的 `node_modules/electron/dist`；发布产物和所有项目验证均已通过。新的干净环境仍需要允许标准 Electron 二进制安装流程。
