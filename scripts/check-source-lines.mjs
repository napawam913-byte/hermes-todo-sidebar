/** 用途：扫描指定源码目录并阻止超过 220 行的文件提交；边界：只做静态行数统计，不修改文件。 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = [
  "apps/desktop/src",
  "services/plan-api/src",
  "services/plan-api/tests",
  "scripts"
];
const extensions = new Set([".ts", ".tsx", ".css", ".py", ".mjs"]);
const limit = 220;
const excludedDirectories = new Set([
  "node_modules", "dist", "dist-electron", "release", "artifacts", "coverage",
  "__pycache__", ".venv"
]);

const violations = [];
for (const root of roots) await collect(root);
violations.sort((left, right) => left.file.localeCompare(right.file));

if (violations.length) {
  for (const violation of violations) console.log(`${violation.lines} ${violation.file}`);
  process.exitCode = 1;
} else {
  console.log(`源码行数守卫通过：${roots.length} 个目录中没有超过 ${limit} 行的受检文件。`);
}

async function collect(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) await collect(file);
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      const text = await readFile(file, "utf8");
      const lines = countLines(text);
      if (lines > limit) violations.push({ lines, file: relative(file) });
    }
  }
}

function countLines(text) {
  if (!text) return 0;
  const trailingBreak = /(?:\r\n|\n|\r)$/.test(text);
  return text.split(/\r\n|\n|\r/).length - Number(trailingBreak);
}

function relative(file) {
  return path.relative(process.cwd(), file).split(path.sep).join("/");
}
