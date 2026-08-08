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
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 disabled:pointer-events-none disabled:opacity-60",
          variant === "default" &&
            "bg-brand-700 text-white hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-lg",
          variant === "outline" &&
            "border border-border bg-bg text-text hover:border-brand-300 hover:bg-brand-50",
          variant === "ghost" && "bg-transparent text-text-muted hover:bg-brand-50 hover:text-text",
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
