import * as React from "react";
import clsx from "clsx";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(
          "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/10 disabled:pointer-events-none disabled:opacity-60",
          variant === "default" &&
            "bg-[var(--login-primary,#0B6AAE)] text-white hover:-translate-y-0.5 hover:shadow-lg hover:brightness-105",
          variant === "outline" &&
            "border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
          variant === "ghost" && "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800",
          size === "default" && "h-12 px-4 text-base",
          size === "sm" && "h-9 px-3 text-sm",
          size === "lg" && "h-12 px-6 text-base",
          size === "icon" && "h-10 w-10",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
