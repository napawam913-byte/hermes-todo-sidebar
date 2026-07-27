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

## 审查修复追加

- `package.json`：`dist:win:compatible` 现在明确调用 `electron-builder --win --x64 --dir`。
- `scripts/create-compatible-portable.mjs`：删除对 `node_modules/electron/dist/electron.exe` 的引用和替换逻辑。脚本复制 builder 输出后，将目标目录中的 `Hermes 待办桌宠.exe` 重命名为版本化 EXE；不再包含 signed Electron 表述。
- 脚本提供带 main guard 的 `assertInsideRelease` 导出。它拒绝相对路径上溯、`release/` 根本身和不同盘符等所有 `release/` 外路径。
- 脚本在生成后验证版本化 EXE、`resources/app.asar`、PE 签名和 x64 machine `0x8664`，并用 SHA-256 确认最终 EXE 与 `release/win-unpacked/Hermes 待办桌宠.exe` 字节相同。
- `apps/desktop/src/main/windowsPackaging.test.ts`：增加 ICO 头、精确 `--x64` 命令、builder EXE 重命名、禁止 `electron.exe` 引用，以及子 Node 进程路径守卫测试。先运行时这些新断言失败，修复后通过。

## 审查修复命令与结果

- `npm test -- --reporter=dot apps/desktop/src/main/windowsPackaging.test.ts`：修复前失败（缺少 `--x64`、未重命名 builder EXE、未导出路径守卫）；修复后通过，5 个测试。
- `npm run typecheck`：通过。
- `npm run check:source-lines`：通过；修改的 MJS 为 120 行、TS 为 76 行。
- `npm run build`：通过。
- `npm run dist:win:compatible`：通过，执行 `electron-builder --win --x64 --dir` 并生成版本化目录。
- 最终产物独立核对：版本化 EXE 存在，品牌 builder EXE 不再留在目标目录，`resources/app.asar` 和说明存在；PE 为 `PE\\0\\0` / `0x8664`；builder 与版本化 EXE 的 SHA-256 均为 `776DEC67AD30554A6A710D9A3EB9B41F092C795EAD7FFE5784F96E4A2AFB228D`。
