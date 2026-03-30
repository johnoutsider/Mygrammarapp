"use client";

import * as React from "react";

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export function Switch({ checked = false, onCheckedChange, className = "", disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => onCheckedChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
        checked ? "bg-cyan-500" : "bg-gray-200"
      } ${className}`}
    >
      <span
        data-slot="switch-thumb"
        data-state={checked ? "checked" : "unchecked"}
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
