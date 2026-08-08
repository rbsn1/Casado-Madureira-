import * as React from "react";
import clsx from "clsx";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={clsx(
        "h-4 w-4 rounded border border-border text-brand-700 accent-brand-700",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/10",
        className
      )}
      {...props}
    />
  );
});
Checkbox.displayName = "Checkbox";
