/**
 * 模块用途：生成不经过临时目录自解压的 Windows 策略兼容免安装测试目录。
 * 模块边界：只重组新鲜 electron-builder 产物，不修改源码、用户数据或系统策略。
 */
import { createHash } from "node:crypto";
import {
  closeSync,
  cpSync,
  createReadStream,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const rootDirectory = resolve(dirname(scriptPath), "..");
const releaseDirectory = join(rootDirectory, "release");
const packageJson = JSON.parse(readFileSync(join(rootDirectory, "package.json"), "utf8"));
const sourceDirectory = join(releaseDirectory, "win-unpacked");
const builderExecutable = join(sourceDirectory, `${packageJson.build.productName}.exe`);
const targetDirectory = join(
  releaseDirectory,
  `${packageJson.name}-${packageJson.version}-x64-portable-dir`
);
const sourceExecutable = join(targetDirectory, `${packageJson.build.productName}.exe`);
const targetExecutable = join(
  targetDirectory,
  `Hermes-Todo-Sidebar-${packageJson.version}.exe`
);

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  createCompatiblePortable()
    .then((directory) => console.log(directory))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

export async function createCompatiblePortable() {
  assertInputs();
  assertInsideRelease(targetDirectory);
  rmSync(targetDirectory, { recursive: true, force: true });
  cpSync(sourceDirectory, targetDirectory, { recursive: true });
  renameSync(sourceExecutable, targetExecutable);
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
  await assertPackagedOutput();
  return targetDirectory;
}

function assertInputs() {
  if (!existsSync(builderExecutable)) {
    throw new Error(`缺少 builder EXE：${builderExecutable}`);
  }
}

export function assertInsideRelease(path) {
  const candidate = resolve(path);
  const child = relative(releaseDirectory, candidate);

  if (!child || child.startsWith("..") || isAbsolute(child)) {
    throw new Error(`拒绝清理 release 之外的目录：${path}`);
  }
}

async function assertPackagedOutput() {
  const appAsar = join(targetDirectory, "resources", "app.asar");

  if (!existsSync(targetExecutable) || !existsSync(appAsar)) {
    throw new Error("兼容目录缺少版本化 EXE 或 resources/app.asar");
  }
  assertX64Pe(targetExecutable);
  if ((await fileDigest(builderExecutable)) !== (await fileDigest(targetExecutable))) {
    throw new Error("最终 EXE 不等于 builder 产物");
  }
}

function assertX64Pe(path) {
  const descriptor = openSync(path, "r");
  const header = Buffer.alloc(4096);
  const bytesRead = readSync(descriptor, header, 0, header.length, 0);
  closeSync(descriptor);
  const peOffset = bytesRead >= 0x40 ? header.readUInt32LE(0x3c) : 0;

  if (
    bytesRead < peOffset + 6 ||
    header.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0" ||
    header.readUInt16LE(peOffset + 4) !== 0x8664
  ) {
    throw new Error(`版本化 EXE 不是 x64 PE：${path}`);
  }
}

function fileDigest(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}
