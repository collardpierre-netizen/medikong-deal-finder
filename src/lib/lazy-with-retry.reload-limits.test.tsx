import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Suspense, Component, type ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import {
  lazyWithRetry,
  resetReloadAttempts,
  safeAutoReload,
  safeCacheBustReload,
  safeTransientChunkReload,
  MAX_AUTO_RELOADS_PER_SESSION,
  __reloadTiming,
} from "./lazy-with-retry";

/**
 * Guarantees that a failing lazy chunk cannot loop indefinitely across
 * multiple routes: once the per-session reload caps are exhausted, the
 * error boundary must catch the failure instead of triggering a new
 * navigation. Simulates admin + several other routes hitting the same
 * transient chunk error.
 */

class CatchBoundary extends Component<
  { children: ReactNode; onError: (e: Error) => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.hasError ? <div>boundary</div> : this.props.children;
  }
}

function renderLazyRoute(importer: () => Promise<any>, key: string) {
  const onError = vi.fn();
  const Lazy = lazyWithRetry(importer as any, key);
  const utils = render(
    <CatchBoundary onError={onError}>
      <Suspense fallback={<div>loading</div>}>
        <Lazy />
      </Suspense>
    </CatchBoundary>,
  );
  return { onError, ...utils };
}

describe("lazyWithRetry — reload limits across routes", () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = window.location;
  const originalScheduler = __reloadTiming.scheduler;
  let reloadSpy: ReturnType<typeof vi.fn>;
  let replaceSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetReloadAttempts();
    sessionStorage.clear();

    reloadSpy = vi.fn();
    replaceSpy = vi.fn();
    // Redefine window.location with spy-able reload/replace, keep other props.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        href: "http://localhost/",
        reload: reloadSpy,
        replace: replaceSpy,
      },
    });

    // Probe returns healthy JS by default; individual tests override.
    globalThis.fetch = vi.fn(async () =>
      new Response("export default {};", {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    ) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it("safeAutoReload caps at MAX_AUTO_RELOADS_PER_SESSION and stops looping", () => {
    for (let i = 0; i < MAX_AUTO_RELOADS_PER_SESSION; i++) {
      // Bypass the cooldown between attempts.
      sessionStorage.removeItem("medikong:reload-last-at");
      expect(safeAutoReload()).toBe(true);
    }
    sessionStorage.removeItem("medikong:reload-last-at");
    expect(safeAutoReload()).toBe(false);
    expect(reloadSpy).toHaveBeenCalledTimes(MAX_AUTO_RELOADS_PER_SESSION);
  });

  it("safeCacheBustReload caps at 2 per session (no infinite ?_v= loop)", () => {
    expect(safeCacheBustReload()).toBe(true);
    expect(safeCacheBustReload()).toBe(true);
    expect(safeCacheBustReload()).toBe(false);
    expect(replaceSpy).toHaveBeenCalledTimes(2);
  });

  it("safeTransientChunkReload caps at 5 per session", () => {
    for (let i = 0; i < 5; i++) {
      expect(safeTransientChunkReload("http://cdn/x.js")).toBe(true);
    }
    expect(safeTransientChunkReload("http://cdn/x.js")).toBe(false);
    expect(replaceSpy).toHaveBeenCalledTimes(5);
  });

  it("does NOT loop across multiple routes once caps are exhausted — boundary catches", async () => {
    // Simulate that the session has already exhausted every reload budget
    // (as would happen after a few failed attempts on an admin route).
    sessionStorage.setItem("medikong:reload-count", "99");
    sessionStorage.setItem("medikong:chunk-cache-bust-count", "99");
    sessionStorage.setItem("medikong:transient-chunk-reload-count", "99");

    // Probe: text/html fallback (stale deploy) — the worst offender for loops.
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    ) as any;

    const routes = [
      "/admin/vendors-stripe",
      "/admin/rfq",
      "/catalogue",
      "/mes-rfq",
      "/compte",
    ];

    for (const route of routes) {
      const importer = vi.fn(async () => {
        throw new Error(
          `Failed to fetch dynamically imported module: http://cdn.example.com${route}.js`,
        );
      });
      const { onError, unmount } = renderLazyRoute(importer, `route:${route}`);
      await waitFor(() => expect(onError).toHaveBeenCalled());
      unmount();
    }

    // Zero reload/replace calls should have happened: caps were exhausted,
    // so every route escalated to the boundary instead of navigating.
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
