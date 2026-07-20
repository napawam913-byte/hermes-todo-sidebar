/**
 * 模块用途：提供可复用的分段选择控件。
 * 模块边界：只表达选中值和交互，不承载任何待办业务状态。
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: "regular" | "compact";
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  size = "regular",
  disabled = false
}: SegmentedControlProps<T>) {
  return (
    <div className={`segmented-control segmented-control-${size}`} aria-label={ariaLabel} role="group">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            aria-pressed={selected}
            className={selected ? "segmented-control-option is-active" : "segmented-control-option"}
            disabled={disabled}
            key={option.value}
            type="button"
            onClick={() => {
              if (!disabled && !selected) onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
