import * as React from "react";

export type LucideProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

function IconBase({
  children,
  size = 20,
  strokeWidth = 2,
  className,
  ...props
}: LucideProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Mail(props: LucideProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </IconBase>
  );
}

export function Lock(props: LucideProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </IconBase>
  );
}

export function Eye(props: LucideProps) {
  return (
    <IconBase {...props}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </IconBase>
  );
}

export function EyeOff(props: LucideProps) {
  return (
    <IconBase {...props}>
      <path d="M2 12s3.5-6 10-6c2 0 3.8.6 5.2 1.5" />
      <path d="M22 12s-3.5 6-10 6c-2 0-3.8-.6-5.2-1.5" />
      <path d="m3 3 18 18" />
      <path d="M9.8 9.8A3 3 0 0 0 12 15a3 3 0 0 0 2.2-.9" />
    </IconBase>
  );
}

export function ArrowLeft(props: LucideProps) {
  return (
    <IconBase {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </IconBase>
  );
}
