import * as React from "react";
import clsx from "clsx";

export function Separator({
  className,
  orientation = "horizontal"
}: React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={clsx(
        "bg-slate-200/90",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
    />
  );
}
