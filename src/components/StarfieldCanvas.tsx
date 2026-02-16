"use client";

import { useEffect, useRef } from "react";

type StarfieldCanvasProps = {
  density?: number;
  twinkle?: boolean;
  className?: string;
};

type StarTier = "small" | "medium" | "large";

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  tier: StarTier;
  soft: boolean;
  twinkleAmp: number;
  twinkleSpeed: number;
  twinklePhase: number;
};

const REFERENCE_AREA = 1440 * 900;
const MIN_STARS = 160;
const MAX_STARS = 1400;

function randomIn(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickStarTier(): StarTier {
  const roll = Math.random();
  if (roll < 0.8) return "small";
  if (roll < 0.98) return "medium";
  return "large";
}

function getStarRadius(tier: StarTier) {
  if (tier === "small") return randomIn(0.4, 1.2);
  if (tier === "medium") return randomIn(1.2, 2.0);
  return randomIn(2.0, 3.0);
}

function getStarAlpha(tier: StarTier) {
  if (tier === "small") return randomIn(0.12, 0.34);
  if (tier === "medium") return randomIn(0.22, 0.58);
  return randomIn(0.45, 0.9);
}

function buildStars(width: number, height: number, density: number): Star[] {
  const area = Math.max(1, width * height);
  const scaledCount = Math.round((density * area) / REFERENCE_AREA);
  const count = Math.max(MIN_STARS, Math.min(MAX_STARS, scaledCount));
  const stars: Star[] = [];

  for (let i = 0; i < count; i += 1) {
    const tier = pickStarTier();
    const radius = getStarRadius(tier);
    const alpha = getStarAlpha(tier);
    const twinkleEligible = Math.random() < (tier === "small" ? 0.22 : tier === "medium" ? 0.38 : 0.55);

    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius,
      alpha,
      tier,
      soft: Math.random() < (tier === "small" ? 0.28 : 0.18),
      twinkleAmp: twinkleEligible ? randomIn(0.05, 0.22) : 0,
      twinkleSpeed: twinkleEligible ? randomIn(0.45, 1.65) : 0,
      twinklePhase: Math.random() * Math.PI * 2
    });
  }

  return stars;
}

export default function StarfieldCanvas({ density = 520, twinkle = true, className = "" }: StarfieldCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const starsRef = useRef<Star[]>([]);
  const rafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const twinkleEnabledRef = useRef(twinkle);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mediaQuery.matches;
    twinkleEnabledRef.current = twinkle && !mediaQuery.matches;

    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
      twinkleEnabledRef.current = twinkle && !event.matches;
      if (!twinkleEnabledRef.current) {
        drawFrame(0);
      } else if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(loop);
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onReducedMotionChange);
    } else {
      mediaQuery.addListener(onReducedMotionChange);
    }

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      starsRef.current = buildStars(width, height, density);
      drawFrame(0);
    };

    const drawFrame = (timeMs: number) => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      if (!width || !height) return;

      ctx.clearRect(0, 0, width, height);
      const t = timeMs * 0.001;
      const twinkleOn = twinkleEnabledRef.current;

      for (let i = 0; i < starsRef.current.length; i += 1) {
        const star = starsRef.current[i];
        const wave = twinkleOn && star.twinkleAmp > 0 ? Math.sin(t * star.twinkleSpeed + star.twinklePhase) : 0;
        const alpha = Math.max(0.04, Math.min(1, star.alpha * (1 + wave * star.twinkleAmp)));

        // Soft pass for a subset so stars don't look too sharp and don't compete with text/card.
        if (star.soft) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(227, 238, 255, ${alpha * 0.12})`;
          ctx.arc(star.x, star.y, star.radius * 2.1, 0, Math.PI * 2);
          ctx.fill();
        }

        if (star.tier === "large") {
          // Keep glow only for very few stars for better performance.
          ctx.shadowColor = "rgba(255, 226, 167, 0.6)";
          ctx.shadowBlur = 10;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = `rgba(239, 245, 255, ${alpha})`;
        if (star.radius < 1.2) {
          ctx.fillRect(star.x, star.y, star.radius, star.radius);
        } else {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;
    };

    const loop = (timeMs: number) => {
      drawFrame(timeMs);
      if (twinkleEnabledRef.current) {
        rafRef.current = window.requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
      }
    };

    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(container);
    resizeCanvas();

    if (twinkleEnabledRef.current) {
      rafRef.current = window.requestAnimationFrame(loop);
    }

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", onReducedMotionChange);
      } else {
        mediaQuery.removeListener(onReducedMotionChange);
      }
    };
  }, [density, twinkle]);

  return (
    <div ref={containerRef} className={`pointer-events-none absolute inset-0 ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
}
