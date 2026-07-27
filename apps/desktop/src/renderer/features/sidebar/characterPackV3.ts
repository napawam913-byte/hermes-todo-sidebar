/**
 * 模块用途：定义并严格校验十四行 CharacterPack V3，同时把旧角色包映射到统一动作槽位。
 * 模块边界：只处理清单数据，不加载图像，也不决定动作时长和状态优先级。
 */
import type { PetDragDirection } from "./petDragDirection";

export interface CharacterClipV3 {
  row: number;
  mirrorX?: boolean;
}

export interface CharacterAtlasV3 {
  columns: 6;
  rows: 7 | 14;
  cellWidth: 192;
  cellHeight: 208;
  renderWidth: 88;
  renderHeight: 96;
}

export interface CharacterClipsV3 {
  idle: { base: CharacterClipV3; blink: CharacterClipV3 };
  awaken: CharacterClipV3;
  dragging: Record<PetDragDirection, CharacterClipV3>;
  thinking: CharacterClipV3;
  working: CharacterClipV3;
  waiting: CharacterClipV3;
  reminding: CharacterClipV3;
  complete: CharacterClipV3;
  error: CharacterClipV3;
  sleeping: CharacterClipV3;
}

export interface CharacterPackManifestV3 {
  schemaVersion: 3;
  id: string;
  displayName: string;
  version: string;
  atlas: CharacterAtlasV3;
  clips: CharacterClipsV3;
}

interface LegacyClip {
  row: number;
  mirrorX?: boolean;
}

interface LegacyManifest {
  id: string;
  displayName: string;
  version: string;
  atlas: Omit<CharacterAtlasV3, "rows"> & { rows: 7 };
  clips: {
    idle: LegacyClip;
    awaken: LegacyClip;
    dragging: Record<PetDragDirection, LegacyClip>;
    working: LegacyClip;
    complete: LegacyClip;
  };
}

const ROOT_KEYS = ["schemaVersion", "id", "displayName", "version", "atlas", "clips"];
const CLIP_ROWS = {
  awaken: 2,
  thinking: 7,
  working: 8,
  waiting: 9,
  reminding: 10,
  complete: 11,
  error: 12,
  sleeping: 13
} as const;

export function validateCharacterPackV3(value: Record<string, unknown>): CharacterPackManifestV3 {
  exactKeys(value, ROOT_KEYS, "角色包");
  validateIdentity(value);
  validateAtlas(value.atlas);
  const clips = record(value.clips, "动作");
  exactKeys(clips, ["idle", "awaken", "dragging", "thinking", "working", "waiting",
    "reminding", "complete", "error", "sleeping"], "动作");
  validateIdle(clips.idle);
  validateDragging(clips.dragging);
  for (const [name, expectedRow] of Object.entries(CLIP_ROWS)) {
    validateClip(clips[name], name, expectedRow);
  }
  return value as unknown as CharacterPackManifestV3;
}

export function upgradeLegacyCharacterPack(legacy: LegacyManifest): CharacterPackManifestV3 {
  const old = legacy.clips;
  return {
    schemaVersion: 3,
    id: legacy.id,
    displayName: legacy.displayName,
    version: legacy.version,
    atlas: legacy.atlas,
    clips: {
      idle: { base: copy(old.idle), blink: copy(old.idle) },
      awaken: copy(old.awaken),
      dragging: {
        down: copy(old.dragging.down), up: copy(old.dragging.up),
        right: copy(old.dragging.right), left: copy(old.dragging.left)
      },
      thinking: copy(old.working),
      working: copy(old.working),
      waiting: copy(old.idle),
      reminding: copy(old.awaken),
      complete: copy(old.complete),
      error: copy(old.idle),
      sleeping: copy(old.idle)
    }
  };
}

function validateIdentity(value: Record<string, unknown>) {
  if (typeof value.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(value.id)) {
    throw new Error("角色 ID 无效");
  }
  if (typeof value.displayName !== "string" || !value.displayName.trim()) throw new Error("角色名称无效");
  if (typeof value.version !== "string" || !value.version.trim()) throw new Error("角色版本无效");
}

function validateAtlas(value: unknown) {
  const atlas = record(value, "图集");
  exactKeys(atlas, ["columns", "rows", "cellWidth", "cellHeight", "renderWidth", "renderHeight"], "图集");
  const expected = { columns: 6, rows: 14, cellWidth: 192, cellHeight: 208, renderWidth: 88, renderHeight: 96 };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (atlas[key] !== expectedValue) throw new Error(`图集尺寸字段 ${key} 无效`);
  }
}

function validateIdle(value: unknown) {
  const idle = record(value, "idle");
  exactKeys(idle, ["base", "blink"], "idle");
  validateClip(idle.base, "idle.base", 0);
  validateClip(idle.blink, "idle.blink", 1);
}

function validateDragging(value: unknown) {
  const dragging = record(value, "dragging");
  exactKeys(dragging, ["down", "up", "right", "left"], "dragging");
  validateClip(dragging.down, "dragging.down", 3);
  validateClip(dragging.up, "dragging.up", 4);
  validateClip(dragging.right, "dragging.right", 5);
  validateClip(dragging.left, "dragging.left", 6);
}

function validateClip(value: unknown, name: string, expectedRow: number) {
  const clip = record(value, name);
  exactKeys(clip, ["row"], name);
  if (clip.row !== expectedRow) throw new Error(`${name} 行号必须为 ${expectedRow}`);
}

function copy(clip: LegacyClip): CharacterClipV3 {
  return { row: clip.row, ...(clip.mirrorX === undefined ? {} : { mirrorX: clip.mirrorX }) };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}必须是对象`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], label: string) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label}包含未知字段`);
  }
}
