/**
 * 模块用途：通过 Vite 构建期发现内置角色目录并创建已校验的角色注册表。
 * 模块边界：只发现随应用发布的资源，不接受运行时外部压缩包或网络角色。
 */
import { DEFAULT_CHARACTER_ID } from "../appearance/appearanceSettings";
import type { CharacterPackSource } from "./characterPack";
import { createCharacterRegistry } from "./characterRegistry";

const manifests = import.meta.glob("../../assets/characters/*/character.json", {
  eager: true,
  import: "default"
}) as Record<string, unknown>;
const atlases = import.meta.glob("../../assets/characters/*/atlas.webp", {
  eager: true,
  import: "default",
  query: "?url"
}) as Record<string, string>;
const thumbnails = import.meta.glob("../../assets/characters/*/thumbnail.webp", {
  eager: true,
  import: "default",
  query: "?url"
}) as Record<string, string>;

const packs = Object.entries(manifests).map(([path, manifest]) => {
  const id = readFolderId(path);
  const atlasUrl = findAsset(atlases, id, "atlas.webp");
  const thumbnailUrl = findAsset(thumbnails, id, "thumbnail.webp");
  return { manifest, atlasUrl, thumbnailUrl } satisfies CharacterPackSource;
});

export const characterRegistry = createCharacterRegistry(packs, DEFAULT_CHARACTER_ID);

function readFolderId(path: string): string {
  const match = path.match(/\/characters\/([^/]+)\//);
  if (!match) throw new Error(`无法识别角色目录：${path}`);
  return match[1];
}

function findAsset(assets: Record<string, string>, id: string, fileName: string) {
  const entry = Object.entries(assets).find(([path]) =>
    path.includes(`/characters/${id}/`) && path.endsWith(`/${fileName}`));
  if (!entry) throw new Error(`角色 ${id} 缺少 ${fileName}`);
  return entry[1];
}
