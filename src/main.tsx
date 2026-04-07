import { createRoot } from "react-dom/client";
import "./i18n";
import App from "./App.tsx";
import "./index.css";
import { installViteChunkReloadGuard } from "@/lib/lazy-with-retry";

installViteChunkReloadGuard();

createRoot(document.getElementById("root")!).render(<App />);
