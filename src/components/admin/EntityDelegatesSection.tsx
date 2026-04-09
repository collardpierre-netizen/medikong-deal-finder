import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, User, MapPin, Tag, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type EntityType = "brand" | "manufacturer" | "vendor";

interface Props {
  entityType: EntityType;
  entityId: string;
}

export function EntityDelegatesSection({ entityType, entityId }: Props) {
  const [showAssign, setShowAssign] = useState(false);
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["entity-delegates", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegate_assignments")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);
      if (error) throw error;
      return data;
    },
  });

  const delegateIds = assignments.map(a => a.delegate_id);

  const { data: delegates = [] } = useQuery({
    queryKey: ["delegates-by-ids", delegateIds],
    queryFn: async () => {
      if (!delegateIds.length) return [];
      const { data, error } = await supabase
        .from("delegates")
        .select("*")
        .in("id", delegateIds);
      if (error) throw error;
      return data;
    },
    enabled: delegateIds.length > 0,
  });

  const handleRemove = async (assignmentId: string) => {
    const { error } = await supabase.from("delegate_assignments").delete().eq("id", assignmentId);
    if (error) toast.error(error.message);
    else {
      toast.success("Délégué retiré");
      queryClient.invalidateQueries({ queryKey: ["entity-delegates", entityType, entityId] });
    }
  };

  const handleTogglePrimary = async (assignmentId: string, current: boolean) => {
    const { error } = await supabase.from("delegate_assignments").update({ is_primary: !current } as any).eq("id", assignmentId);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["entity-delegates", entityType, entityId] });
  };

  return (
    <div className="p-5 rounded-[10px] bg-card border border-border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Délégués assignés</h3>
        <button onClick={() => setShowAssign(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-primary hover:bg-primary/90">
          <Plus size={14} /> Assigner
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : assignments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun délégué assigné</p>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => {
            const d = delegates.find(x => x.id === a.delegate_id);
            if (!d) return null;
            return (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                {d.photo_url ? (
                  <img src={d.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><User size={16} className="text-muted-foreground" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{d.full_name}</span>
                    {a.is_primary && <Badge className="text-[9px] bg-amber-100 text-amber-800 border-amber-200">Principal</Badge>}
                    <Badge variant={d.delegate_type === "commercial" ? "default" : "secondary"} className="text-[9px]">
                      {d.delegate_type === "commercial" ? "Commercial" : "Contact"}
                    </Badge>
                  </div>
                  <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
                    {d.email && <span>{d.email}</span>}
                    {d.phone && <span>{d.phone}</span>}
                  </div>
                  {(d.zones as string[])?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin size={10} className="text-muted-foreground" />
                      {(d.zones as string[]).map((z: string) => <Badge key={z} variant="outline" className="text-[9px]">{z}</Badge>)}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleTogglePrimary(a.id, a.is_primary)} title="Principal" className="p-1.5 rounded hover:bg-muted">
                    <Star size={14} className={a.is_primary ? "text-amber-500 fill-amber-500" : "text-muted-foreground"} />
                  </button>
                  <button onClick={() => handleRemove(a.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AssignDelegateDialog
        open={showAssign}
        onOpenChange={setShowAssign}
        entityType={entityType}
        entityId={entityId}
        existingDelegateIds={delegateIds}
        onAssigned={() => queryClient.invalidateQueries({ queryKey: ["entity-delegates", entityType, entityId] })}
      />
    </div>
  );
}

function AssignDelegateDialog({ open, onOpenChange, entityType, entityId, existingDelegateIds, onAssigned }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  entityType: EntityType; entityId: string; existingDelegateIds: string[];
  onAssigned: () => void;
}) {
  const [search, setSearch] = useState("");

  const { data: allDelegates = [] } = useQuery({
    queryKey: ["all-delegates-for-assign"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delegates").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const available = allDelegates.filter(d =>
    !existingDelegateIds.includes(d.id) &&
    d.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async (delegateId: string) => {
    const { error } = await supabase.from("delegate_assignments").insert({
      delegate_id: delegateId,
      entity_type: entityType,
      entity_id: entityId,
      is_primary: existingDelegateIds.length === 0,
    } as any);
    if (error) toast.error(error.message);
    else {
      toast.success("Délégué assigné");
      onAssigned();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[70vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Assigner un délégué</DialogTitle></DialogHeader>
        <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="mb-3" />
        {available.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Aucun délégué disponible</p>
        ) : (
          <div className="space-y-2">
            {available.map(d => (
              <button key={d.id} onClick={() => handleAssign(d.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 text-left transition-colors">
                {d.photo_url ? (
                  <img src={d.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><User size={14} className="text-muted-foreground" /></div>
                )}
                <div>
                  <div className="text-sm font-medium">{d.full_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.delegate_type === "commercial" ? "Commercial" : "Contact"} {d.email ? `· ${d.email}` : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
