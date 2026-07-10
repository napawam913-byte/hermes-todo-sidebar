/**
 * 模块用途：统一按钮组件，保证图标、文本、hover、press 和禁用态一致。
 * 模块边界：只封装按钮外观和基础交互，不包含业务动作。
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  children?: ReactNode;
};

function joinClassName(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}
export function IconButton({ icon, children, className, ...props }: ButtonProps) {
  return (
    <button className={joinClassName("ui-button ui-button-icon", className)} type="button" {...props}>
      {icon}
      {children ? <span className="sr-only">{children}</span> : null}
    </button>
  );
}

export function PrimaryButton({ icon, children, className, ...props }: ButtonProps) {
  return (
    <button className={joinClassName("ui-button ui-button-primary", className)} type="button" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function QuietButton({ icon, children, className, ...props }: ButtonProps) {
  return (
    <button className={joinClassName("ui-button ui-button-quiet", className)} type="button" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
