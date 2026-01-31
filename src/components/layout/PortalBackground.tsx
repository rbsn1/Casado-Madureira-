import { ReactNode } from "react";

type PortalBackgroundProps = {
  children: ReactNode;
  heroImageSrc?: string;
  heroHeight?: string;
};

export function PortalBackground({
  children,
  heroImageSrc,
  heroHeight = "520px"
}: PortalBackgroundProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F7FBF7] text-slate-900">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-emerald-50/60 to-emerald-100/70" />

      {/* Hero image backdrop (optional) */}
      {heroImageSrc ? (
        <div className="absolute inset-x-0 top-0" style={{ height: heroHeight }} aria-hidden="true">
          <div
            className="absolute inset-0 bg-center bg-no-repeat bg-cover opacity-[0.14] blur-2xl saturate-50"
            style={{
              backgroundImage: `url(${heroImageSrc})`,
              backgroundPosition: "right center",
              transform: "translateX(32px)"
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.9)_0%,_rgba(255,255,255,0.55)_45%,_rgba(255,255,255,0.2)_75%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/35 to-transparent" />
        </div>
      ) : null}

      {/* Glows */}
      <div className="absolute left-1/2 top-10 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-emerald-200/30 blur-[140px]" />
      <div className="absolute right-[-120px] top-[220px] h-[320px] w-[320px] rounded-full bg-sky-200/25 blur-[140px]" />
      <div className="absolute bottom-[-120px] left-[-40px] h-[300px] w-[300px] rounded-full bg-emerald-200/25 blur-[140px]" />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0)_45%,_rgba(12,20,14,0.06)_100%)]" />

      {/* Noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\" viewBox=\"0 0 120 120\"><circle cx=\"12\" cy=\"18\" r=\"1.2\" fill=\"%23ffffff\"/><circle cx=\"46\" cy=\"34\" r=\"1\" fill=\"%23ffffff\"/><circle cx=\"78\" cy=\"20\" r=\"1.1\" fill=\"%23ffffff\"/><circle cx=\"20\" cy=\"72\" r=\"0.9\" fill=\"%23ffffff\"/><circle cx=\"58\" cy=\"64\" r=\"1.2\" fill=\"%23ffffff\"/><circle cx=\"92\" cy=\"88\" r=\"1\" fill=\"%23ffffff\"/><circle cx=\"104\" cy=\"46\" r=\"0.9\" fill=\"%23ffffff\"/></svg>')"
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
