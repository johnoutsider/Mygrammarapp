import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

export function Button({
  className = "",
  variant = "default",
  children,
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none px-4 py-2";
  const variants: Record<string, string> = {
    default: "bg-cyan-500 text-white hover:bg-cyan-600",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-700",
  };
  return (
    <button className={`${base} ${variants[variant] ?? ""} ${className}`} {...props}>
      {children}
    </button>
  );
}
