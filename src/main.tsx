import { createRoot } from "react-dom/client";
import "./i18n";
import App from "./App.tsx";
import "./index.css";
import { installViteChunkReloadGuard } from "@/lib/lazy-with-retry";
import {
  installBuildVersionWatcher,
  preflightBuildVersionBeforeRender,
} from "@/lib/build-version";
import { checkAdminBuildIdOnBoot } from "@/lib/admin-cache-bust";
import { runContractEnvValidationOnBoot } from "@/lib/contract/env-validation";
import { installGlobalErrorReporting } from "@/lib/errorReporter";
import { installBackendRetry } from "@/lib/network-retry";
import { installNetworkDiagnostics } from "@/lib/network-diagnostics";
import { installIncidentCacheRecovery } from "@/lib/cache-bust";

import {
  checkSupabaseEnv,
  renderSupabaseEnvError,
  type SupabaseEnvCheck,
} from "@/lib/supabase-env-validation";

installViteChunkReloadGuard();
installGlobalErrorReporting();
installBackendRetry();
installNetworkDiagnostics();
installIncidentCacheRecovery();


async function bootstrap() {
  const canRender = await preflightBuildVersionBeforeRender();
  if (!canRender) return;

  installBuildVersionWatcher();
  checkAdminBuildIdOnBoot();

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
}

void bootstrap();
