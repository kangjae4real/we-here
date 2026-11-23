"use client";

import { CopyIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { press, spring } from "./motion";

const MotionLink = motion.create(Link);

/* ---------- buttons ---------- */

type ButtonKind = "primary" | "secondary" | "text" | "danger";
const KIND: Record<ButtonKind, string> = {
  primary: "bg-butter text-ink hover:bg-butter-press active:bg-butter-press",
  secondary: "bg-muted text-ink hover:bg-line",
  text: "bg-transparent text-sub hover:text-ink",
  danger: "bg-error text-white",
};

type ButtonProps = {
  kind?: ButtonKind;
  size?: "lg" | "md";
  full?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
} & (
  | { href: string; onClick?: () => void; "aria-label"?: string }
  | ({ href?: undefined } & Omit<
      ComponentProps<typeof motion.button>,
      "className" | "children"
    >)
);

/** Design button: 56px, radius 16, butter primary. `href` renders a link. */
export function Button({
  kind = "primary",
  size = "lg",
  full = true,
  icon,
  children,
  className,
  ...rest
}: ButtonProps) {
  const disabled = "disabled" in rest && rest.disabled;
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-[16px] font-bold select-none transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
    size === "lg" ? "h-14 px-5 text-[16px]" : "h-11 px-4 text-[14px]",
    full && "w-full",
    disabled ? "pointer-events-none bg-muted text-disabled" : KIND[kind],
    className,
  );
  if (rest.href !== undefined) {
    return (
      <MotionLink
        href={rest.href}
        onClick={rest.onClick}
        aria-label={rest["aria-label"]}
        {...press}
        className={cls}
      >
        {icon}
        {children}
      </MotionLink>
    );
  }
  return (
    <motion.button type="button" {...press} className={cls} {...rest}>
      {icon}
      {children}
    </motion.button>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: { label: string; children: ReactNode; className?: string } & Omit<
  ComponentProps<typeof motion.button>,
  "className" | "children"
>) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      {...press}
      className={cn(
        "relative grid size-10 shrink-0 place-items-center rounded-full text-ink outline-none after:absolute after:-inset-0.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/* ---------- inputs ---------- */

/** 56px muted field with an ink focus outline; extra content (a mark, an icon) sits on the right. */
export function TextField({
  icon,
  className,
  ...input
}: { icon?: ReactNode; className?: string } & ComponentProps<"input">) {
  return (
    <label
      className={cn(
        "flex h-14 w-full items-center gap-2 rounded-[14px] bg-muted px-4 -outline-offset-2 transition-[outline-color] focus-within:outline-2 focus-within:outline-ink",
        input.disabled && "opacity-60",
        className,
      )}
    >
      <input
        className="tnum h-full min-w-0 flex-1 bg-transparent text-[16px] font-medium text-ink outline-none placeholder:text-disabled"
        {...input}
      />
      {icon}
    </label>
  );
}

export function LinkBox({ url, onCopy }: { url: string; onCopy?: () => void }) {
  return (
    <div className="flex h-14 items-center gap-3 rounded-[14px] bg-muted pr-2 pl-4">
      <span className="tnum flex-1 truncate text-[16px] font-medium">
        {url}
      </span>
      <IconButton label="링크 복사" onClick={onCopy}>
        <CopyIcon size={20} strokeWidth={2} />
      </IconButton>
    </div>
  );
}

/* ---------- chips & badges ---------- */

const CIRCLED = ["", "①", "②", "③"];
const TONE = {
  butter: "bg-butter-soft text-ink",
  muted: "bg-muted text-sub",
  mint: "bg-heat-1 text-[#0b7a4d]",
} as const;

/** Chapter label: ① 같은 곳, 다른 때 / ② 스친 순간 / ③ 함께한 기억. */
export function ChapterBadge({
  n,
  children,
  tone = "butter",
}: {
  n: 1 | 2 | 3;
  children: ReactNode;
  tone?: keyof typeof TONE;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold",
        TONE[tone],
      )}
    >
      <span className="text-[12px]">{CIRCLED[n]}</span>
      {children}
    </span>
  );
}

export function Chip({
  active,
  children,
  className,
  ...rest
}: { active?: boolean; children: ReactNode; className?: string } & Omit<
  ComponentProps<typeof motion.button>,
  "className" | "children"
>) {
  return (
    <motion.button
      type="button"
      {...press}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-white text-ink hover:border-disabled",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/* ---------- segmented tab ---------- */

/** Pill tabs; the white thumb slides between options with a shared layout spring. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { id: T; label: string }[];
  value: T | null;
  onChange: (id: T) => void;
  label: string;
}) {
  const layoutId = useId();
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid h-11 rounded-full bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on || (value === null && i === 0) ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => {
              const step =
                e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = (i + step + options.length) % options.length;
              onChange(options[next].id);
              (
                e.currentTarget.parentElement?.children[next] as
                  | HTMLElement
                  | undefined
              )?.focus();
            }}
            className={cn(
              "relative rounded-full text-[14px] font-semibold transition-colors outline-none after:absolute after:-inset-y-1 after:inset-x-0 focus-visible:ring-2 focus-visible:ring-ink",
              on ? "text-ink" : "text-sub hover:text-ink",
            )}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                transition={spring}
                className="absolute inset-0 rounded-full bg-white shadow-soft"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
