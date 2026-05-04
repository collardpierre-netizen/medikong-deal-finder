import { createRoot } from "react-dom/client";
import "./i18n";
import App from "./App.tsx";
import "./index.css";
import { installViteChunkReloadGuard } from "@/lib/lazy-with-retry";
import { installBuildVersionWatcher } from "@/lib/build-version";
import { runContractEnvValidationOnBoot } from "@/lib/contract/env-validation";
import { installGlobalErrorReporting } from "@/lib/errorReporter";
import {
  checkSupabaseEnv,
  renderSupabaseEnvError,
  type SupabaseEnvCheck,
} from "@/lib/supabase-env-validation";

installViteChunkReloadGuard();
installBuildVersionWatcher();
installGlobalErrorReporting();

// Diagnostic non bloquant : vérifie au démarrage que les variables d'env
// et le bucket de stockage des PDFs de contrats sont correctement configurés.
// Le rapport est exposé sur window.__medikongContractEnv pour debug rapide.
runContractEnvValidationOnBoot();

// Validation bloquante : sans VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY,
// le client Supabase plante avec "No API key found in request". On affiche
// un message clair plutôt qu'un blank screen ou un spinner infini.
const supabaseEnv = checkSupabaseEnv();
(window as unknown as { __medikongSupabaseEnv?: SupabaseEnvCheck }).__medikongSupabaseEnv =
  supabaseEnv;
if (!supabaseEnv.ok) {
  console.error(
    "[MediKong] Variables Supabase manquantes:",
    supabaseEnv.missing.join(", "),
  );
  renderSupabaseEnvError(supabaseEnv);
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
