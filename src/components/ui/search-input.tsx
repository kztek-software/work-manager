"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  value: string;
  onChange: (value: string, e?: React.ChangeEvent<HTMLInputElement>) => void;
  size?: "sm" | "md" | "lg";
  onClear?: () => void;
  containerClassName?: string;
  iconClassName?: string;
  shortcut?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = "Tìm kiếm...",
      size = "md",
      className,
      containerClassName,
      iconClassName,
      shortcut,
      disabled,
      ...props
    },
    ref
  ) => {
    const handleClear = () => {
      onChange("");
      onClear?.();
    };

    const sizeStyles = {
      sm: {
        container: "h-8",
        input: "text-xs",
        icon: "left-2.5 h-3.5 w-3.5",
        clear: "right-2 h-4 w-4",
        padLeft: 34,
        padRight: 28,
      },
      md: {
        container: "h-10",
        input: "text-sm",
        icon: "left-3.5 h-4 w-4",
        clear: "right-2.5 h-4.5 w-4.5",
        padLeft: 42,
        padRight: 36,
      },
      lg: {
        container: "h-11",
        input: "text-base",
        icon: "left-4 h-5 w-5",
        clear: "right-3 h-5 w-5",
        padLeft: 48,
        padRight: 40,
      },
    }[size];

    return (
      <div className={cn("relative flex items-center w-full group", containerClassName)}>
        <Search
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-muted transition-colors pointer-events-none group-focus-within:text-accent shrink-0 z-10",
            sizeStyles.icon,
            iconClassName
          )}
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value, e)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            paddingLeft: `${sizeStyles.padLeft}px`,
            paddingRight: value || shortcut ? `${sizeStyles.padRight}px` : "14px",
            ...props.style,
          }}
          className={cn(
            "w-full rounded-xl border border-line bg-surface-2/90 text-foreground placeholder:text-muted/60",
            "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all font-medium",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            sizeStyles.container,
            sizeStyles.input,
            className
          )}
          {...props}
        />
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full text-muted hover:text-foreground hover:bg-surface/80 transition-colors cursor-pointer z-10",
              sizeStyles.clear
            )}
            title="Xóa nội dung tìm kiếm"
          >
            <X className="h-3 w-3 stroke-[2.5]" />
          </button>
        ) : shortcut ? (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-line bg-surface text-[10px] font-mono text-muted/70 pointer-events-none select-none z-10">
            {shortcut}
          </span>
        ) : null}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
