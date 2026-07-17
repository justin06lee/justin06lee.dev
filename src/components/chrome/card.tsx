import { cn } from "@/lib/utils";

export type CardProps = {
  className?: string;
  children?: React.ReactNode;
  /** CSS background applied to the card. Transparent by default. */
  background?: string;
};

/** Bordered container. Square corners, thin border, dark-only. */
export function Card({ className, children, background }: CardProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 border border-white/10 p-5", className)}
      style={{ background }}
    >
      {children}
    </div>
  );
}

export type CardHeaderProps = {
  className?: string;
  children?: React.ReactNode;
};

/** Top row that lays a title and meta side by side. */
export function CardHeader({ className, children }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      {children}
    </div>
  );
}

export type CardTitleProps = {
  className?: string;
  children?: React.ReactNode;
  /** Renders the title as a link. External URLs get target="_blank". */
  href?: string;
};

export function CardTitle({ className, children, href }: CardTitleProps) {
  const heading = (
    <h3 className={cn("text-lg font-semibold leading-tight", className)}>
      {children}
    </h3>
  );
  if (!href) return heading;
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      className="underline-offset-4 hover:underline"
      {...(external && { target: "_blank", rel: "noopener noreferrer" })}
    >
      {heading}
    </a>
  );
}

export type CardMetaProps = {
  className?: string;
  children?: React.ReactNode;
};

/** Muted, shrink-proof meta slot — e.g. a year, pinned to the right of the header. */
export function CardMeta({ className, children }: CardMetaProps) {
  return (
    <span className={cn("shrink-0 select-none text-xs text-white/60", className)}>
      {children}
    </span>
  );
}

export type CardBodyProps = {
  className?: string;
  children?: React.ReactNode;
};

export function CardBody({ className, children }: CardBodyProps) {
  return <p className={cn("text-sm text-white/80", className)}>{children}</p>;
}

export type CardActionsProps = {
  className?: string;
  children?: React.ReactNode;
};

/** Footer row for links/buttons. */
export function CardActions({ className, children }: CardActionsProps) {
  return (
    <div className={cn("mt-3 flex items-center gap-2", className)}>{children}</div>
  );
}
