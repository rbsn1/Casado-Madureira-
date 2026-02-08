import { ReactNode } from "react";

type PortalBackgroundProps = {
  children: ReactNode;
  heroImageSrc?: string;
  heroHeight?: string;
  theme?: "ccm" | "discipulado";
};

export function PortalBackground({
  children,
  heroImageSrc,
  heroHeight = "520px",
  theme = "ccm"
}: PortalBackgroundProps) {
  const isDiscipulado = theme === "discipulado";
  const rootClass = isDiscipulado
    ? "relative min-h-screen overflow-hidden bg-[#f5f9ff] text-slate-900"
    : "relative min-h-screen overflow-hidden bg-[#F7FBF7] text-slate-900";
  const ambientClass = isDiscipulado
    ? "absolute inset-0 bg-gradient-to-b from-[#f4f8ff] via-sky-100/70 to-indigo-100/45 portal-ambient-glow"
    : "absolute inset-0 bg-gradient-to-b from-[#f9fbfa] via-emerald-100/60 to-emerald-200/40 portal-ambient-glow";
  const heroOverlayClass = isDiscipulado
    ? "absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.92)_0%,_rgba(243,247,255,0.66)_45%,_rgba(208,223,247,0.4)_75%)]"
    : "absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.9)_0%,_rgba(244,250,246,0.62)_45%,_rgba(210,234,222,0.42)_75%)]";
  const heroGradientClass = isDiscipulado
    ? "absolute inset-0 bg-gradient-to-b from-white/85 via-sky-50/55 to-indigo-100/30"
    : "absolute inset-0 bg-gradient-to-b from-white/85 via-emerald-50/45 to-emerald-100/30";
  const glowMainClass = isDiscipulado
    ? "absolute left-1/2 top-8 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-sky-200/45 blur-[150px] portal-glow-main"
    : "absolute left-1/2 top-8 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-200/40 blur-[150px] portal-glow-main";
  const glowSideClass = isDiscipulado
    ? "absolute right-[-120px] top-[220px] h-[320px] w-[320px] rounded-full bg-indigo-200/35 blur-[140px] portal-glow-side"
    : "absolute right-[-120px] top-[220px] h-[320px] w-[320px] rounded-full bg-sky-200/25 blur-[140px] portal-glow-side";
  const glowLowerClass = isDiscipulado
    ? "absolute bottom-[-120px] left-[-40px] h-[300px] w-[300px] rounded-full bg-sky-200/30 blur-[140px] portal-glow-lower"
    : "absolute bottom-[-120px] left-[-40px] h-[300px] w-[300px] rounded-full bg-emerald-200/25 blur-[140px] portal-glow-lower";

  return (
    <div className={rootClass}>
      {/* Base gradient (more presence) */}
      <div className={ambientClass} />

      {/* Hero image backdrop (more anchor) */}
      {heroImageSrc ? (
        <div className="absolute inset-x-0 top-0" style={{ height: heroHeight }} aria-hidden="true">
          <div
            className="absolute inset-0 bg-cover bg-no-repeat opacity-[0.13] blur-2xl saturate-60"
            style={{
              backgroundImage: `url(${heroImageSrc})`,
              backgroundPosition: "right center",
              transform: "translateX(28px)"
            }}
          />
          <div className={heroOverlayClass} />
          <div className={heroGradientClass} />
        </div>
      ) : null}

      {/* Symbolic pattern overlay (rings/olive/cross) */}
      <div
        className="absolute inset-0 opacity-[0.05] portal-pattern"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"240\" height=\"240\" viewBox=\"0 0 240 240\"><g fill=\"none\" stroke=\"%23000000\" stroke-width=\"1\"><circle cx=\"44\" cy=\"52\" r=\"18\"/><circle cx=\"68\" cy=\"52\" r=\"18\"/><path d=\"M120 44v28M106 58h28\"/><path d=\"M170 60c10 10 22 10 32 0\"/><path d=\"M170 60c2 8 6 14 12 18\"/><path d=\"M202 60c-2 8-6 14-12 18\"/></g></svg>')",
          backgroundSize: "280px 280px"
        }}
      />

      {/* Glows */}
      <div className={glowMainClass} />
      <div className={glowSideClass} />
      <div className={glowLowerClass} />

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
