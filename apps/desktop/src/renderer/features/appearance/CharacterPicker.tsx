/**
 * 模块用途：展示已安装角色包并让用户选择当前桌宠角色。
 * 模块边界：不发现角色资源、不播放动作，也不直接写入本地存储。
 */
import { Check } from "lucide-react";
import type { CharacterPack } from "../sidebar/characterPack";

interface CharacterPickerProps {
  characters: CharacterPack[];
  selectedId: string;
  onChange(characterId: string): void;
}

export function CharacterPicker(props: CharacterPickerProps) {
  return (
    <div className="character-picker" role="radiogroup" aria-label="桌宠角色">
      {props.characters.map((character) => {
        const selected = character.manifest.id === props.selectedId;
        return (
          <button
            aria-checked={selected}
            className={selected ? "character-option is-selected" : "character-option"}
            key={character.manifest.id}
            onClick={() => props.onChange(character.manifest.id)}
            role="radio"
            type="button"
          >
            <img alt="" src={character.thumbnailUrl} />
            <span className="character-option-copy">
              <strong>{character.manifest.displayName}</strong>
              <small>{selected ? "当前使用" : "可用"}</small>
            </span>
            {selected ? <Check aria-hidden="true" size={16} strokeWidth={2.2} /> : null}
          </button>
        );
      })}
    </div>
  );
}
