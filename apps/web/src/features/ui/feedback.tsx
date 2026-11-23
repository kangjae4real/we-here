"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { InfoIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./controls";
import { rise } from "./motion";

/** Dark floating notice with an optional butter action. Enters with `rise`. */
export function Toast({
  children,
  action,
  onAction,
  className,
}: {
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <motion.div
      role="status"
      variants={rise}
      initial="hidden"
      animate="show"
      exit="exit"
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-[16px] bg-ink py-2 pr-2 pl-4 text-[14px] font-semibold text-white shadow-soft",
        className,
      )}
    >
      <InfoIcon size={20} strokeWidth={2} className="shrink-0 text-butter" />
      <span className="flex-1">{children}</span>
      {action && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onAction}
          className="relative h-10 rounded-[12px] bg-butter px-3 text-[14px] font-bold text-ink after:absolute after:-inset-0.5"
        >
          {action}
        </motion.button>
      )}
    </motion.div>
  );
}

/** Two-button confirm (취소 / danger action). Accessible alert dialog with a rising card. */
export function ConfirmDialog({
  open,
  title,
  desc,
  cancel = "취소",
  confirm,
  danger,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  desc?: string;
  cancel?: string;
  confirm: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <AnimatePresence>
        {open && (
          <AlertDialog.Portal keepMounted>
            <AlertDialog.Backdrop
              render={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              }
              className="fixed inset-0 z-50 bg-ink/40"
            />
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-6">
              <AlertDialog.Popup
                render={
                  <motion.div
                    variants={rise}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                  />
                }
                className="pointer-events-auto w-full max-w-[340px] rounded-[24px] bg-white p-6 shadow-soft outline-none"
              >
                <AlertDialog.Title className="text-[18px] leading-snug font-bold">
                  {title}
                </AlertDialog.Title>
                {desc && (
                  <AlertDialog.Description className="mt-2 text-[15px] leading-normal font-medium text-sub">
                    {desc}
                  </AlertDialog.Description>
                )}
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <Button kind="secondary" onClick={onCancel}>
                    {cancel}
                  </Button>
                  <Button
                    kind={danger ? "danger" : "primary"}
                    onClick={onConfirm}
                  >
                    {confirm}
                  </Button>
                </div>
              </AlertDialog.Popup>
            </div>
          </AlertDialog.Portal>
        )}
      </AnimatePresence>
    </AlertDialog.Root>
  );
}

export function EmptyBlock({
  icon,
  title,
  desc,
  children,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  children?: ReactNode;
}) {
  return (
    <motion.div
      variants={rise}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center text-center"
    >
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-butter-soft text-ink">
        {icon}
      </span>
      <p className="text-[18px] leading-snug font-bold">{title}</p>
      {desc && (
        <p className="mt-1.5 text-[14px] font-medium text-sub">{desc}</p>
      )}
      {children && (
        <div className="mt-5 flex w-full flex-col gap-1">{children}</div>
      )}
    </motion.div>
  );
}
