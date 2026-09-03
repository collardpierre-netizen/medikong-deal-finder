import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, MessageSquare } from "lucide-react";

interface OrderMessagesProps {
  orderId: string;
  /** Point de vue de l'utilisateur courant : change les libellés uniquement. */
  viewer: "admin" | "customer";
  className?: string;
}

interface OrderMessageRow {
  id: string;
  sender_role: string;
  sender_name: string | null;
  body: string;
  created_at: string;
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-BE", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

export function OrderMessages({ orderId, viewer, className }: OrderMessagesProps) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["order-messages", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_messages")
        .select("id, sender_role, sender_name, body, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as OrderMessageRow[];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await supabase.functions.invoke("send-order-message", {
        body: { orderId, message },
      });
      if (error) throw new Error(error.message || "Envoi impossible");
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { email_sent?: boolean };
    },
    onSuccess: (data) => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["order-messages", orderId] });
      toast.success(
        data?.email_sent
          ? viewer === "admin"
            ? "Message envoyé au client (email envoyé)"
            : "Message envoyé à l'équipe MediKong (email envoyé)"
          : "Message enregistré (notification email non envoyée)",
      );
    },
    onError: (e: any) => toast.error(e?.message || "Envoi impossible"),
  });

  return (
    <section className={`bg-white border border-mk-line rounded-xl p-5 ${className ?? ""}`}>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-mk-blue" />
        <h2 className="font-semibold text-mk-navy">
          {viewer === "admin" ? "Messages avec le client" : "Messages avec MediKong"}
        </h2>
        {messages.length > 0 && (
          <span className="text-xs text-mk-sec">
            {messages.length} message{messages.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-mk-sec">Chargement…</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-mk-sec mb-4">
          {viewer === "admin"
            ? "Aucun message. Écrivez au client : il recevra un email avec votre message et pourra répondre depuis son compte."
            : "Aucun message. Posez votre question : l'équipe MediKong vous répondra par email et ici."}
        </p>
      ) : (
        <ul className="space-y-3 mb-4 max-h-[360px] overflow-y-auto pr-1">
          {messages.map((m) => {
            const mine = m.sender_role === viewer;
            return (
              <li
                key={m.id}
                className={`rounded-lg p-3 border text-sm ${
                  mine ? "bg-mk-blue/5 border-mk-blue/30 ml-6" : "bg-mk-bg border-mk-line mr-6"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="font-medium text-mk-navy">
                    {m.sender_name || (m.sender_role === "admin" ? "Équipe MediKong" : "Client")}
                  </span>
                  <span className="text-[11px] text-mk-sec">{formatDate(m.created_at)}</span>
                </div>
                <p className="whitespace-pre-line text-mk-sec">{m.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      <label htmlFor="order-message-draft" className="sr-only">
        Votre message
      </label>
      <textarea
        id="order-message-draft"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder={viewer === "admin" ? "Écrire un message au client…" : "Écrire un message à MediKong…"}
        className="w-full text-sm rounded-md border border-mk-line px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mk-blue/30"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-mk-sec">
          Le destinataire reçoit une notification par email avec votre message.
        </span>
        <button
          type="button"
          disabled={!draft.trim() || sendMutation.isPending}
          onClick={() => sendMutation.mutate(draft.trim())}
          className="bg-mk-blue text-white text-sm px-4 py-2 rounded-md flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send size={14} />
          {sendMutation.isPending ? "Envoi…" : "Envoyer"}
        </button>
      </div>
    </section>
  );
}
