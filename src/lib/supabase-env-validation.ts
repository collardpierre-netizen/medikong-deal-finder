/**
 * Validates at boot that the Supabase URL and publishable key are resolved.
 * If missing, renders a clear fullscreen message instead of letting the app
 * fail with cryptic "No API key found in request" errors at runtime.
 */

export interface SupabaseEnvCheck {
  ok: boolean;
  url: string | null;
  hasKey: boolean;
  missing: string[];
}

export function checkSupabaseEnv(): SupabaseEnvCheck {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const url = env.VITE_SUPABASE_URL?.trim() || null;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || null;
  const missing: string[] = [];
  if (!url) missing.push("VITE_SUPABASE_URL");
  if (!key) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");
  return { ok: missing.length === 0, url, hasKey: !!key, missing };
}

export function renderSupabaseEnvError(check: SupabaseEnvCheck) {
  if (typeof document === "undefined") return;
  const root = document.getElementById("root");
  if (!root) return;
  const missingList = check.missing.map((k) => `<li><code>${k}</code></li>`).join("");
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,sans-serif;background:#0F172A;color:#fff;">
      <div style="max-width:560px;width:100%;background:#1E252F;border:1px solid #334155;border-radius:12px;padding:32px;">
        <div style="font-size:14px;color:#F59E0B;font-weight:600;margin-bottom:8px;">⚠ Configuration manquante</div>
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Le backend MediKong n'a pas pu être initialisé</h1>
        <p style="margin:0 0 16px;color:#CBD5E1;font-size:14px;line-height:1.5;">
          Les variables d'environnement Supabase suivantes ne sont pas résolues dans ce bundle&nbsp;:
        </p>
        <ul style="margin:0 0 16px 20px;color:#FCA5A5;font-size:13px;">${missingList}</ul>
        <p style="margin:0 0 16px;color:#94A3B8;font-size:13px;line-height:1.5;">
          Cela arrive généralement après un redéploiement où Lovable Cloud n'a pas encore réinjecté les clés,
          ou si le build a été produit hors environnement Lovable. Rechargez la page&nbsp;; si l'erreur persiste,
          republiez le projet depuis Lovable.
        </p>
        <button onclick="window.location.reload()" style="background:#1C58D9;color:#fff;border:0;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
          Recharger la page
        </button>
      </div>
    </div>
  `;
}
