import * as React from "react";
import clsx from "clsx";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={clsx(
        "h-4 w-4 rounded border border-slate-300 text-[var(--login-primary,#0B6AAE)] accent-[var(--login-primary,#0B6AAE)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/10",
        className
      )}
      {...props}
    />
  );
});
Checkbox.displayName = "Checkbox";
