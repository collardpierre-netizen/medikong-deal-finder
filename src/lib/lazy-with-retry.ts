import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RETRY_TOKEN_PREFIX = "lazy-retry:";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "");
}

function isChunkLoadError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("dynamically imported module") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("fetch")
  );
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await importer();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(`${RETRY_TOKEN_PREFIX}${key}`);
      }
      return mod;
    } catch (error) {
      if (typeof window !== "undefined" && isChunkLoadError(error)) {
        const retryKey = `${RETRY_TOKEN_PREFIX}${key}`;
        const alreadyRetried = window.sessionStorage.getItem(retryKey) === "1";

        if (!alreadyRetried) {
          window.sessionStorage.setItem(retryKey, "1");
          window.location.reload();
          return new Promise<never>(() => undefined);
        }
      }

      throw error;
    }
  });
}

export function installViteChunkReloadGuard() {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    window.location.reload();
  });
}