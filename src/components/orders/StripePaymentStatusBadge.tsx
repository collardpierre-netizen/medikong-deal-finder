import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { resolveStripePaymentStatus, type StripePaymentStatus } from "@/lib/stripe-payment-status";

interface OrderLike {
  payment_method?: string | null;
  payment_status?: string | null;
  stripe_payment_intent_id?: string | null;
}

const TONE_CLS: Record<StripePaymentStatus["tone"], string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-300",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
};

interface Props {
  order: OrderLike | null | undefined;
  size?: "sm" | "xs";
  showIcon?: boolean;
  className?: string;
}

export default function StripePaymentStatusBadge({ order, size = "sm", showIcon = true, className }: Props) {
  const status = resolveStripePaymentStatus(order);
  if (!status) return null;
  const Icon = status.state === "confirmed" ? CheckCircle2 : status.state === "failed" ? XCircle : Clock;
  const sz = size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5";
  return (
    <span
      title={status.hint}
      className={`inline-flex items-center gap-1 border rounded-full font-semibold ${TONE_CLS[status.tone]} ${sz} ${className ?? ""}`}
    >
      {showIcon && <Icon size={size === "xs" ? 10 : 11} />}
      {status.label}
    </span>
  );
}
