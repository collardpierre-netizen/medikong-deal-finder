import { AlertTriangle, AlertCircle, Info, Link2, ExternalLink, RefreshCw, PencilLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VendorAccountErrorPresentation, VendorAccountErrorAction } from "@/lib/vendor-account-errors";

const SEVERITY_STYLE: Record<VendorAccountErrorPresentation["severity"], { bg: string; border: string; iconColor: string; titleColor: string; Icon: typeof AlertTriangle }> = {
  error:   { bg: "bg-destructive/5",   border: "border-destructive/30",      iconColor: "text-destructive",  titleColor: "text-destructive",  Icon: AlertCircle },
  warning: { bg: "bg-amber-50",        border: "border-amber-200",           iconColor: "text-amber-600",    titleColor: "text-amber-900",    Icon: AlertTriangle },
  info:    { bg: "bg-sky-50",          border: "border-sky-200",             iconColor: "text-sky-600",      titleColor: "text-sky-900",      Icon: Info },
};

const INTENT_ICON: Record<NonNullable<VendorAccountErrorAction["intent"]>, typeof Link2 | null> = {
  attach: Link2,
  open_vendor: ExternalLink,
  open_user: ExternalLink,
  edit_email: PencilLine,
  retry: RefreshCw,
  contact_support: null,
};

type ActionHandler = (action: VendorAccountErrorAction) => void;

type Props = {
  presentation: VendorAccountErrorPresentation;
  onAction?: ActionHandler;
  onDismiss?: () => void;
};

export function VendorAccountErrorAlert({ presentation, onAction, onDismiss }: Props) {
  const { severity, title, description, hint, code, primaryAction, secondaryAction, tertiaryAction } = presentation;
  const style = SEVERITY_STYLE[severity];
  const Icon = style.Icon;

  const handleClick = (action: VendorAccountErrorAction) => {
    if (action.href && !onAction) {
      window.location.assign(action.href);
      return;
    }
    onAction?.(action);
  };

  return (
    <div className={`relative rounded-lg border ${style.bg} ${style.border} p-4 space-y-3`}>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded hover:bg-background/60 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}

      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${style.iconColor}`} />
        <div className="space-y-1.5 flex-1 min-w-0">
          <h4 className={`text-sm font-semibold ${style.titleColor}`}>{title}</h4>
          <p className="text-sm text-foreground/90 break-words">{description}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          <p className="text-[10px] font-mono text-muted-foreground/70 pt-1">code · {code}</p>
        </div>
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {secondaryAction && (
            <ActionButton action={secondaryAction} onClick={handleClick} />
          )}
          {primaryAction && (
            <ActionButton action={primaryAction} onClick={handleClick} primary />
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  action,
  onClick,
  primary,
}: {
  action: VendorAccountErrorAction;
  onClick: ActionHandler;
  primary?: boolean;
}) {
  const Icon = action.intent ? INTENT_ICON[action.intent] : null;
  return (
    <Button
      size="sm"
      variant={action.variant ?? (primary ? "default" : "outline")}
      onClick={() => onClick(action)}
      className="gap-1.5"
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {action.label}
    </Button>
  );
}
