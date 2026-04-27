import { createRoot } from "react-dom/client";
import "./i18n";
import App from "./App.tsx";
import "./index.css";
import { installViteChunkReloadGuard } from "@/lib/lazy-with-retry";
import { runContractEnvValidationOnBoot } from "@/lib/contract/env-validation";
import { installGlobalErrorReporting } from "@/lib/errorReporter";

installViteChunkReloadGuard();
installGlobalErrorReporting();

// Diagnostic non bloquant : vérifie au démarrage que les variables d'env
// et le bucket de stockage des PDFs de contrats sont correctement configurés.
// Le rapport est exposé sur window.__medikongContractEnv pour debug rapide.
runContractEnvValidationOnBoot();

createRoot(document.getElementById("root")!).render(<App />);
