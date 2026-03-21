import clsx from "clsx";
import { sundayScaleStatusClasses, sundayScaleStatusLabel } from "@/lib/sundayServiceScale";

export function PresenceStatusBadge({ status }: { status: string | null | undefined }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", sundayScaleStatusClasses(status))}>
      {sundayScaleStatusLabel(status)}
    </span>
  );
}
