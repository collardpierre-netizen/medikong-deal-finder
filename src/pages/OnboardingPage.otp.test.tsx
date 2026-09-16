/**
 * Tests automatisés — écran d'onboarding : validation du code reçu par e-mail.
 *
 * Couvre :
 *  - la longueur du code (OTP_LENGTH, source unique de vérité dans src/config/otp.ts) :
 *    aucun appel de vérification tant que le code est incomplet, appel avec un token
 *    de la bonne longueur dès que toutes les cases sont remplies (saisie + collage) ;
 *  - l'expiration du code (erreur backend "Token has expired") → message d'erreur affiché ;
 *  - les erreurs génériques (code invalide) → message d'erreur, pas de passage à l'étape suivante ;
 *  - le succès → aucun message d'erreur.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OTP_LENGTH } from "@/config/otp";

/* ─── Mocks ─────────────────────────────────────────────────────────────── */

const signInWithOtp = vi.fn(async () => ({ data: {}, error: null }));
const verifyOtp = vi.fn(async (_args: unknown) => ({ data: {}, error: null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...(args as [])),
      verifyOtp: (args: unknown) => verifyOtp(args),
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
      signInWithPassword: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        order: () => ({ limit: async () => ({ data: [], error: null }) }),
      }),
      insert: async () => ({ error: null }),
    }),
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));

vi.mock("@/hooks/usePageImages", () => ({
  usePageImages: () => ({ getImage: () => null, images: [], isLoading: false }),
}));

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: "/onboarding", search: "", hash: "", state: null, key: "t" }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/i18n", () => ({ default: { changeLanguage: vi.fn() } }));

import OnboardingPage from "./OnboardingPage";

/* ─── Helpers ───────────────────────────────────────────────────────────── */

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <OnboardingPage />
    </QueryClientProvider>,
  );

/** Amène l'écran jusqu'à l'étape "Vérifiez votre email" (code OTP). */
async function goToOtpStep(user: ReturnType<typeof userEvent.setup>) {
  renderPage();

  await user.click(screen.getByText("Je souhaite acheter"));
  await act(async () => {
    vi.advanceTimersByTime(500);
  });

  await user.click(await screen.findByText("Pharmacien"));
  await act(async () => {
    vi.advanceTimersByTime(500);
  });

  const emailInput = await screen.findByPlaceholderText("votre@email.com");
  await user.type(emailInput, "pharmacie@example.be");
  await user.click(screen.getByText("Recevoir le code"));

  await screen.findByText("Vérifiez votre email");
  return screen.getAllByInputMode ? [] : [];
}

const otpInputs = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"][maxlength="1"]'));

/* ─── Tests ─────────────────────────────────────────────────────────────── */

describe("Onboarding — validation du code reçu par e-mail", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signInWithOtp.mockClear();
    verifyOtp.mockClear();
    verifyOtp.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it(`affiche exactement ${OTP_LENGTH} cases et annonce un code à ${OTP_LENGTH} chiffres`, async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await goToOtpStep(user);

    expect(otpInputs()).toHaveLength(OTP_LENGTH);
    expect(
      screen.getByText((t) => t.includes(`code à ${OTP_LENGTH} chiffres`)),
    ).toBeInTheDocument();
  });

  it("ne vérifie rien tant que le code est incomplet", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await goToOtpStep(user);

    const inputs = otpInputs();
    for (let i = 0; i < OTP_LENGTH - 1; i++) {
      await user.type(inputs[i], String(i + 1));
    }

    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("refuse les caractères non numériques", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await goToOtpStep(user);

    const inputs = otpInputs();
    await user.type(inputs[0], "a");

    expect(inputs[0].value).toBe("");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it(`vérifie le code avec un token de ${OTP_LENGTH} chiffres dès la dernière case remplie`, async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await goToOtpStep(user);

    const code = "12345678".slice(0, OTP_LENGTH).padEnd(OTP_LENGTH, "9");
    const inputs = otpInputs();
    for (let i = 0; i < OTP_LENGTH; i++) {
      await user.type(inputs[i], code[i]);
    }

    await waitFor(() => expect(verifyOtp).toHaveBeenCalled());
    const firstCall = verifyOtp.mock.calls[0][0] as { email: string; token: string; type: string };
    expect(firstCall.token).toBe(code);
    expect(firstCall.token).toHaveLength(OTP_LENGTH);
    expect(firstCall.email).toBe("pharmacie@example.be");
    expect(screen.queryByText("Code invalide. Réessayez.")).not.toBeInTheDocument();
  });

  it("vérifie le code collé depuis l'e-mail (collage complet)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await goToOtpStep(user);

    const code = "8".repeat(OTP_LENGTH);
    otpInputs()[0].focus();
    await user.paste(code);

    await waitFor(() => expect(verifyOtp).toHaveBeenCalled());
    expect((verifyOtp.mock.calls[0][0] as { token: string }).token).toBe(code);
  });

  it("ignore un collage trop court (moins de chiffres que la longueur attendue)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await goToOtpStep(user);

    otpInputs()[0].focus();
    await user.paste("1234");

    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("affiche une erreur quand le code est expiré", async () => {
    verifyOtp.mockResolvedValue({
      data: null,
      error: { message: "Token has expired or is invalid", status: 403 },
    } as never);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await goToOtpStep(user);

    const inputs = otpInputs();
    for (let i = 0; i < OTP_LENGTH; i++) await user.type(inputs[i], "1");

    expect(await screen.findByText("Code invalide. Réessayez.")).toBeInTheDocument();
    // L'écran reste sur l'étape de vérification (pas de passage à l'étape suivante)
    expect(screen.getByText("Vérifiez votre email")).toBeInTheDocument();
  });

  it("affiche une erreur quand le code est invalide et n'avance pas", async () => {
    verifyOtp.mockResolvedValue({
      data: null,
      error: { message: "Invalid token", status: 401 },
    } as never);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await goToOtpStep(user);

    const inputs = otpInputs();
    for (let i = 0; i < OTP_LENGTH; i++) await user.type(inputs[i], "7");

    expect(await screen.findByText("Code invalide. Réessayez.")).toBeInTheDocument();
    // Tous les types d'OTP ont été essayés avant de conclure à l'échec
    expect(verifyOtp.mock.calls.length).toBeGreaterThan(1);
  });
});
