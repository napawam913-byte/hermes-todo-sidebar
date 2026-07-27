/**
 * 模块用途：生成不经过临时目录自解压的 Windows 策略兼容免安装测试目录。
 * 模块边界：只重组新鲜 electron-builder 产物，不修改源码、用户数据或系统策略。
 */
import {
  copyFileSync,
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseDirectory = join(rootDirectory, "release");
const packageJson = JSON.parse(readFileSync(join(rootDirectory, "package.json"), "utf8"));
const sourceDirectory = join(releaseDirectory, "win-unpacked");
const targetDirectory = join(
  releaseDirectory,
  `${packageJson.name}-${packageJson.version}-x64-portable-dir`
);
const sourceExecutable = join(sourceDirectory, `${packageJson.build.productName}.exe`);
const signedElectronExecutable = join(
  rootDirectory,
  "node_modules",
  "electron",
  "dist",
  "electron.exe"
);
const targetExecutable = join(
  targetDirectory,
  `Hermes-Todo-Sidebar-${packageJson.version}.exe`
);

assertInputs();
assertInsideRelease(targetDirectory);
rmSync(targetDirectory, { recursive: true, force: true });
cpSync(sourceDirectory, targetDirectory, { recursive: true });
rmSync(join(targetDirectory, `${packageJson.build.productName}.exe`), { force: true });
copyFileSync(signedElectronExecutable, targetExecutable);
writeFileSync(
  join(targetDirectory, "使用说明.txt"),
  [
    "Hermes 待办桌宠策略兼容免安装测试版",
    "",
    `双击 Hermes-Todo-Sidebar-${packageJson.version}.exe 启动。`,
    "此目录必须整体保留，不能只移动 exe。",
    "测试版数据保存在独立的 hermes-todo-sidebar-test 目录。",
    ""
  ].join("\r\n"),
  "utf8"
);

console.log(targetDirectory);

function assertInputs() {
  for (const path of [sourceDirectory, sourceExecutable, signedElectronExecutable]) {
    if (!existsSync(path)) throw new Error(`缺少打包输入：${path}`);
  }
}

function assertInsideRelease(path) {
  const child = relative(releaseDirectory, path);
  if (!child || child.startsWith("..") || resolve(path) === resolve(releaseDirectory)) {
    throw new Error(`拒绝清理 release 之外的目录：${path}`);
  }
}
