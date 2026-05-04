import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Suspense, Component, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { lazyWithRetry, resetReloadAttempts } from "./lazy-with-retry";

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
    return this.state.hasError ? <div>boom</div> : this.props.children;
  }
}

function renderLazy(importer: () => Promise<any>, key: string) {
  const onError = vi.fn();
  const Lazy = lazyWithRetry(importer as any, key);
  render(
    <CatchBoundary onError={onError}>
      <Suspense fallback={<div>loading</div>}>
        <Lazy />
      </Suspense>
    </CatchBoundary>,
  );
  return { onError };
}

describe("lazyWithRetry", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetReloadAttempts();
    sessionStorage.clear();
    // Disable auto-reload by maxing the counter so errors propagate to the boundary.
    sessionStorage.setItem("medikong:reload-count", "99");
    // Default: probe returns a JS-looking response.
    globalThis.fetch = vi.fn(async () =>
      new Response("export default {};", {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    ) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders the component when import resolves with a default export", async () => {
    const Hello = () => <div>hello-world</div>;
    const importer = vi.fn(async () => ({ default: Hello }));
    renderLazy(importer, "hello");
    await waitFor(() => expect(screen.getByText("hello-world")).toBeInTheDocument());
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it("throws a descriptive error when the resolved module has no default export", async () => {
    const importer = vi.fn(async () => ({}) as any);
    const { onError } = renderLazy(importer, "no-default");
    await waitFor(() => expect(onError).toHaveBeenCalled());
    const err = onError.mock.calls[0][0] as Error & { chunkKey?: string };
    expect(err.message).toMatch(/no-default/);
    expect(err.message).toMatch(/without a default export/i);
    expect(err.chunkKey).toBe("no-default");
  });

  it("throws a descriptive error when the importer resolves with null/undefined", async () => {
    const importer = vi.fn(async () => null as any);
    const { onError } = renderLazy(importer, "null-mod");
    await waitFor(() => expect(onError).toHaveBeenCalled());
    const err = onError.mock.calls[0][0] as Error;
    expect(err.message).toMatch(/null-mod/);
  });

  it("propagates a wrapped HTML error when the chunk URL returns text/html", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html><body>404</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    ) as any;
    const importer = vi.fn(async () => {
      throw new Error(
        "Failed to fetch dynamically imported module: https://cdn.example.com/assets/chunk-abc.js",
      );
    });
    const { onError } = renderLazy(importer, "html-chunk");
    await waitFor(() => expect(onError).toHaveBeenCalled());
    const err = onError.mock.calls[0][0] as Error & {
      chunkKey?: string;
      probe?: { looksLikeHtml?: boolean; contentType?: string | null };
    };
    expect(err.message).toMatch(/text\/html/);
    expect(err.chunkKey).toBe("html-chunk");
    expect(err.probe?.looksLikeHtml).toBe(true);
    expect(err.probe?.contentType).toContain("text/html");
  });

  it("propagates the original import error when no URL can be probed", async () => {
    const importer = vi.fn(async () => {
      throw new TypeError("can't access property \"default\", t._result is undefined");
    });
    const { onError } = renderLazy(importer, "raw-fail");
    await waitFor(() => expect(onError).toHaveBeenCalled());
    const err = onError.mock.calls[0][0] as Error & { chunkKey?: string };
    expect(err.chunkKey).toBe("raw-fail");
    expect(err.message).toMatch(/_result|default/);
  });
});
