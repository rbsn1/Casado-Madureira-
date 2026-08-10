import { ReactNode } from "react";

type AuthSplitLayoutProps = {
  children: ReactNode;
  label: string;
  tagline: string;
};

export function AuthSplitLayout({ children, label, tagline }: AuthSplitLayoutProps) {
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[42%_1fr]">
      <div className="relative flex h-[104px] items-center overflow-hidden bg-[linear-gradient(160deg,#1E3A5F_0%,#16304e_60%,#0f1e31_100%)] px-6 lg:h-auto lg:flex-col lg:items-start lg:justify-between lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(76,123,163,0.55),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_80%,rgba(230,167,86,0.28),transparent_50%)]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white ring-1 ring-white/20">
            CM
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
            {label}
          </p>
        </div>
        <p className="relative z-10 hidden text-lg font-semibold leading-snug text-white lg:block">
          {tagline}
        </p>
      </div>
      <div className="flex items-center justify-center bg-bg px-4 py-10 lg:px-16 lg:py-16">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
