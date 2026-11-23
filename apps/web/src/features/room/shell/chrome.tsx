"use client";

import { ChevronRightIcon, SettingsIcon, XIcon } from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/features/ui/controls";
import { Toast } from "@/features/ui/feedback";
import { AvatarPair, Logo } from "@/features/ui/marks";
import { easeOut, easeOutCubic, press } from "@/features/ui/motion";
import { cn } from "@/lib/utils";
import type { Room } from "../mock";

/** Floating room pill: avatars, room name, settings gear. */
export function TopBar({
  room,
  onSettings,
}: {
  room: Room;
  onSettings: () => void;
}) {
  return (
    <div className="absolute top-[calc(16px+env(safe-area-inset-top))] right-4 left-4 z-20 flex h-[52px] items-center rounded-full bg-white pr-1.5 pl-4 shadow-soft md:top-6 md:right-[max(24px,env(safe-area-inset-right))] md:left-auto md:h-12 md:gap-3 md:pr-1">
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <AvatarPair a={room.a.nickname} b={room.b?.nickname} ghostB={!room.b} />
        <h1 className="truncate text-[16px] font-bold">{room.name}</h1>
      </span>
      <IconButton label="방 설정" onClick={onSettings}>
        <SettingsIcon size={22} strokeWidth={2} />
      </IconButton>
    </div>
  );
}

// Module-level so the ref callback keeps one identity and only fires on mount.
function revealPanelTop(el: HTMLElement | null) {
  // The card lands at the top of the scrolling body; bring it into view if the list was scrolled.
  if (!el) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.parentElement?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

/** Desktop left panel. `top` holds the 07c moment card above the body. */
export function Panel({
  header,
  bodyKey,
  top,
  children,
}: {
  header: ReactNode;
  bodyKey: string;
  top?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label="방 패널"
      className="absolute top-6 bottom-[max(24px,env(safe-area-inset-bottom))] left-[max(24px,env(safe-area-inset-left))] z-20 flex w-[400px] flex-col overflow-hidden rounded-[24px] bg-white shadow-soft"
    >
      <div className="shrink-0 px-6 pt-6">
        <div className="mb-4 flex">
          <Logo />
        </div>
        {header}
      </div>
      <SwapBody id={bodyKey} className="px-6 pt-5 pb-6">
        <AnimatePresence initial={false}>
          {top && (
            <motion.div
              key="top"
              data-card
              ref={revealPanelTop}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: easeOut }}
            >
              {top}
            </motion.div>
          )}
        </AnimatePresence>
        {children}
      </SwapBody>
    </section>
  );
}

export type Notice = { text: string; action?: string; onAction?: () => void };

const noop = () => () => {};

/** Toast floating over the map (the S3 spot): under the top bar on mobile, right of the panel on desktop. Auto-dismisses. */
export function FloatingToast({
  notice,
  onDismiss,
}: {
  notice: Notice | null;
  onDismiss: () => void;
}) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!mounted) return null;
  // Portaled: inside the sheet, its transform would pin `fixed` to the sheet instead of the screen.
  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-[calc(80px+env(safe-area-inset-top))] z-30 md:top-24 md:right-auto md:left-1/2 md:w-[420px] md:translate-x-5"
    >
      <AnimatePresence>
        {notice && (
          <Toast
            key={notice.text}
            action={notice.action}
            onAction={notice.onAction}
            // Only an actionable toast takes taps; a plain notice never blocks what's under it.
            className={notice.action && "pointer-events-auto"}
          >
            {notice.text}
          </Toast>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/** Scrolling panel body; a new `id` (tab or flow) crossfades in with its scroll reset. */
export function SwapBody({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: 0.2, ease: easeOut },
        }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          className,
        )}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Flow title + close, in place of the tabs (upload, settings). */
export function FlowHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  // Spacing differs because the sheet (<md) and the panel (md+) frame it differently;
  // md:pt-4 is padding so it doesn't collapse into the logo's margin.
  return (
    <div className="-mt-1 mb-2 flex items-center justify-between md:mt-0 md:mb-0 md:pt-4">
      <h2 className="flex-1 text-[18px] font-bold">{title}</h2>
      <IconButton label="닫기" onClick={onClose} className="-mr-2.5">
        <XIcon size={24} strokeWidth={2} />
      </IconButton>
    </div>
  );
}

/** Icon + label + value list row; a button with a chevron when `onClick` is set. */
export function Row({
  icon,
  label,
  value,
  onClick,
  tone,
}: {
  icon: ReactNode;
  label: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  tone?: "error";
}) {
  const content = (
    <>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full bg-muted",
          tone === "error" ? "text-error" : "text-ink",
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "flex-1 text-[16px] font-medium",
          tone === "error" && "text-error",
        )}
      >
        {label}
      </span>
      {value && (
        <span className="tnum text-[14px] font-semibold text-sub">{value}</span>
      )}
    </>
  );
  if (!onClick)
    return (
      <div className="flex min-h-[52px] items-center gap-3 py-2">{content}</div>
    );
  return (
    <motion.button
      type="button"
      onClick={onClick}
      {...press}
      className="-mx-2 flex min-h-[52px] w-[calc(100%+16px)] items-center gap-3 rounded-[14px] px-2 py-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ink"
    >
      {content}
      <ChevronRightIcon size={20} strokeWidth={2} className="text-disabled" />
    </motion.button>
  );
}

/** Number that counts up from 0 on mount. */
export function CountUp({ to }: { to: number }) {
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => Math.round(v));
  useEffect(() => {
    const anim = animate(value, to, { duration: 0.8, ease: easeOutCubic });
    return () => anim.stop();
  }, [value, to]);
  return (
    <>
      <motion.span aria-hidden>{text}</motion.span>
      <span className="sr-only">{to}</span>
    </>
  );
}

/** 40px extrabold count with a unit: "128장". */
export function BigNumber({
  n,
  unit = "장",
  className,
}: {
  n: number;
  unit?: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "tnum text-[40px] leading-none font-extrabold tracking-[-0.03em]",
        className,
      )}
    >
      <CountUp to={n} />
      <span className="ml-0.5 text-[22px] font-bold">{unit}</span>
    </p>
  );
}
