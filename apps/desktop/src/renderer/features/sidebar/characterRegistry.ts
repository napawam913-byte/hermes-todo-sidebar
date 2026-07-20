/**
 * 模块用途：提供已安装角色包列表、按 ID 解析和默认角色安全回退。
 * 模块边界：只管理已完成校验的角色包，不负责构建期资源发现或设置持久化。
 */
import {
  normalizeCharacterPackManifest,
  type CharacterPack,
  type CharacterPackSource
} from "./characterPack";

export interface CharacterRegistry {
  list(): CharacterPack[];
  resolve(characterId: string): CharacterPack;
}

export function createCharacterRegistry(
  packs: CharacterPackSource[],
  defaultCharacterId: string
): CharacterRegistry {
  const validated = packs.map((pack) => ({
    ...pack,
    manifest: normalizeCharacterPackManifest(pack.manifest)
  }));
  const byId = new Map(validated.map((pack) => [pack.manifest.id, pack]));
  const fallback = byId.get(defaultCharacterId);
  if (!fallback) throw new Error(`默认角色不存在：${defaultCharacterId}`);
  return {
    list: () => [...validated],
    resolve: (characterId) => byId.get(characterId) ?? fallback
  };
}
