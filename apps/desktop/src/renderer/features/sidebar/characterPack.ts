/**
 * 模块用途：定义角色动作资源合同，并把旧 V1 角色包规范化为无主题的 V2。
 * 模块边界：不发现文件、不加载图片，也不读写用户的角色选择设置。
 */
import type { PetDragDirection } from "./petDragDirection";

export interface AnimationClip {
  row: number;
  frames: 6;
  durationMs: number;
  loop: boolean;
  mirrorX?: boolean;
}

export interface CharacterAtlas {
  columns: 6;
  rows: 7;
  cellWidth: 192;
  cellHeight: 208;
  renderWidth: 88;
  renderHeight: 96;
}

export interface CharacterClips {
  idle: AnimationClip;
  awaken: AnimationClip;
  dragging: Record<PetDragDirection, AnimationClip>;
  working: AnimationClip;
  complete: AnimationClip;
}

export interface CharacterPackManifestV1 {
  schemaVersion: 1;
  id: string;
  displayName: string;
  version: string;
  atlas: CharacterAtlas;
  clips: CharacterClips;
  theme: {
    accent: string;
    accentStrong: string;
    accentSoft: string;
    surfaceTint: string;
  };
}

export interface CharacterPackManifestV2 {
  schemaVersion: 2;
  id: string;
  displayName: string;
  version: string;
  atlas: CharacterAtlas;
  clips: CharacterClips;
}

export interface CharacterPack {
  manifest: CharacterPackManifestV2;
  atlasUrl: string;
  thumbnailUrl: string;
}

export interface CharacterPackSource {
  manifest: unknown;
  atlasUrl: string;
  thumbnailUrl: string;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const V1_KEYS = ["schemaVersion", "id", "displayName", "version", "atlas", "clips", "theme"];
const V2_KEYS = ["schemaVersion", "id", "displayName", "version", "atlas", "clips"];

export function normalizeCharacterPackManifest(value: unknown): CharacterPackManifestV2 {
  const manifest = requireRecord(value, "角色包");
  if (manifest.schemaVersion === 1) {
    const legacy = validateV1Manifest(manifest);
    return {
      schemaVersion: 2,
      id: legacy.id,
      displayName: legacy.displayName,
      version: legacy.version,
      atlas: legacy.atlas,
      clips: legacy.clips
    };
  }
  if (manifest.schemaVersion === 2) return validateV2Manifest(manifest);
  throw new Error("角色包版本无效");
}

function validateV1Manifest(manifest: Record<string, unknown>): CharacterPackManifestV1 {
  exactKeys(manifest, V1_KEYS, "角色包");
  validateIdentity(manifest);
  validateAtlas(manifest.atlas);
  validateClips(manifest.clips);
  validateTheme(manifest.theme);
  return manifest as unknown as CharacterPackManifestV1;
}

function validateV2Manifest(manifest: Record<string, unknown>): CharacterPackManifestV2 {
  exactKeys(manifest, V2_KEYS, "角色包");
  validateIdentity(manifest);
  validateAtlas(manifest.atlas);
  validateClips(manifest.clips);
  return manifest as unknown as CharacterPackManifestV2;
}

function validateIdentity(manifest: Record<string, unknown>) {
  if (typeof manifest.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(manifest.id)) {
    throw new Error("角色 ID 无效");
  }
  if (typeof manifest.displayName !== "string" || !manifest.displayName.trim()) throw new Error("角色名称无效");
  if (typeof manifest.version !== "string" || !manifest.version.trim()) throw new Error("角色版本无效");
}

function validateAtlas(value: unknown) {
  const atlas = requireRecord(value, "图集");
  exactKeys(atlas, ["columns", "rows", "cellWidth", "cellHeight", "renderWidth", "renderHeight"], "图集");
  const expected = { columns: 6, rows: 7, cellWidth: 192, cellHeight: 208, renderWidth: 88, renderHeight: 96 };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (atlas[key] !== expectedValue) throw new Error(`图集尺寸字段 ${key} 无效`);
  }
}

function validateClips(value: unknown) {
  const clips = requireRecord(value, "动作");
  exactKeys(clips, ["idle", "awaken", "dragging", "working", "complete"], "动作");
  validateClip(clips.idle, "idle", 0);
  validateClip(clips.awaken, "awaken", 1);
  validateClip(clips.working, "working", 5);
  validateClip(clips.complete, "complete", 6);
  const dragging = requireRecord(clips.dragging, "拖动动作");
  exactKeys(dragging, ["up", "down", "left", "right"], "拖动动作");
  validateClip(dragging.down, "dragging.down", 2);
  validateClip(dragging.up, "dragging.up", 3);
  validateClip(dragging.left, "dragging.left", 4, true);
  validateClip(dragging.right, "dragging.right", 4);
}

function validateClip(value: unknown, name: string, expectedRow: number, mirrored = false) {
  const clip = requireRecord(value, name);
  const keys = clip.mirrorX === undefined
    ? ["row", "frames", "durationMs", "loop"]
    : ["row", "frames", "durationMs", "loop", "mirrorX"];
  exactKeys(clip, keys, name);
  if (!Number.isInteger(clip.row) || Number(clip.row) < 0 || Number(clip.row) >= 7) throw new Error(`${name} 行号越界`);
  if (clip.frames !== 6) throw new Error(`${name} 帧数无效`);
  if (typeof clip.durationMs !== "number" || clip.durationMs <= 0) throw new Error(`${name} 时长无效`);
  if (typeof clip.loop !== "boolean") throw new Error(`${name} 循环标记无效`);
  if (clip.mirrorX !== undefined && typeof clip.mirrorX !== "boolean") throw new Error(`${name} 镜像标记无效`);
  if (clip.row !== expectedRow) throw new Error(`${name} 行号必须为 ${expectedRow}`);
  if (mirrored ? clip.mirrorX !== true : clip.mirrorX === true) throw new Error(`${name} 镜像标记无效`);
}

function validateTheme(value: unknown) {
  const theme = requireRecord(value, "主题");
  exactKeys(theme, ["accent", "accentStrong", "accentSoft", "surfaceTint"], "主题");
  for (const color of Object.values(theme)) {
    if (typeof color !== "string" || !HEX_COLOR.test(color)) throw new Error("角色主题颜色无效");
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}必须是对象`);
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, allowed: string[], label: string) {
  const actual = Object.keys(record).sort();
  const expected = [...allowed].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label}包含未知字段`);
  }
}
