import { useEffect } from "react";
import { Inbox, CheckCheck, Check, Package, Tag, Sparkles, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import {
  useVendorNotifications,
  useVendorUnreadNotificationsCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useVendorNotifications";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

function iconForType(type?: string) {
  if (type?.includes("brand")) return <Tag size={14} />;
  if (type?.includes("submission")) return <Sparkles size={14} />;
  return <Package size={14} />;
}

export function NotificationsBell() {
  const { data: vendor } = useCurrentVendor();
  const vendorId = vendor?.id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: notifs = [] } = useVendorNotifications(vendorId, 10);
  const { data: unread = 0 } = useVendorUnreadNotificationsCount(vendorId);
  const markRead = useMarkNotificationRead(vendorId);
  const markAll = useMarkAllNotificationsRead(vendorId);

  // Realtime subscription on vendor_notifications
  useEffect(() => {
    if (!vendorId) return;
    const channel = supabase
      .channel(`vendor-notifs-${vendorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_notifications", filter: `vendor_id=eq.${vendorId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["vendor-notifications", vendorId] });
          qc.invalidateQueries({ queryKey: ["vendor-notifications-unread-count", vendorId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId, qc]);

  const handleClick = (n: any) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.cta_url) navigate(n.cta_url);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications catalogue"
          title="Notifications catalogue & propositions"
          className="relative p-2 rounded-md hover:bg-[#F1F5F9] transition-colors"
        >
          <Inbox size={18} className="text-[#616B7C]" />
          {unread > 0 && (
            <span className="absolute top-0 right-0 min-w-[16px] h-[16px] px-1 rounded-full bg-[#1B5BDA] text-white text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-semibold">Centre de notifications</p>
            <p className="text-[11px] text-muted-foreground">Catalogue & propositions</p>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              <CheckCheck size={12} /> Tout lu
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[420px]">
          {notifs.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground px-6">
              <Inbox size={22} className="mx-auto opacity-40 mb-2" />
              Aucune notification pour le moment.<br />
              Définissez vos centres d'intérêt pour être alerté.
            </div>
          ) : (
            <ul className="divide-y">
              {notifs.map((n: any) => {
                const isUnread = !n.read_at;
                return (
                  <li
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/60 transition ${
                      isUnread ? "bg-primary/5" : ""
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isUnread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {iconForType(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium leading-tight truncate">{n.title}</p>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />}
                      </div>
                      {n.body && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                        </span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5">{n.type}</Badge>
                      </div>
                    </div>
                    {isUnread && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead.mutate(n.id);
                        }}
                        className="text-muted-foreground hover:text-foreground p-1"
                        aria-label="Marquer comme lu"
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-xs"
            onClick={() => navigate("/vendor/notifications")}
          >
            Voir toutes les notifications
            <ChevronRight size={14} />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
