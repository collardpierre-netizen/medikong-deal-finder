// Integration tests for stripe-webhook event handlers.
// Run with: deno test --allow-env --allow-net supabase/functions/stripe-webhook/webhook.test.ts
//
// These tests inject stub `supabase` and `stripe` clients via `__setTestDeps`
// and verify that the handlers update the right tables on the two key events:
//   - checkout.session.completed
//   - payment_intent.payment_failed
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  __setTestDeps,
  handleCheckoutSessionCompleted,
  handlePaymentFailed,
} from "./index.ts";

// ------------------------- Stub builders -------------------------

type Call = { table: string; op: string; payload?: any; filters: Array<[string, any]> };

function makeSupabaseStub(opts: {
  selectResults?: Record<string, any>; // keyed by "<table>:<op>"
  orderRow?: any;                       // returned by orders select+maybeSingle
  insertError?: Error | null;
} = {}) {
  const calls: Call[] = [];
  const rpcCalls: Array<{ name: string; args: any }> = [];
  const invokeCalls: Array<{ name: string; body: any }> = [];

  function builder(table: string, op: string, payload?: any) {
    const call: Call = { table, op, payload, filters: [] };
    calls.push(call);
    const api: any = {
      select: (_cols?: string, _opts?: any) => api,
      eq: (col: string, val: any) => {
        call.filters.push([col, val]);
        return api;
      },
      in: (col: string, vals: any[]) => {
        call.filters.push([col, vals]);
        return api;
      },
      maybeSingle: async () => {
        if (table === "orders" && op === "select") {
          return { data: opts.orderRow ?? null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => ({ data: null, error: null }),
      then: (resolve: any) =>
        resolve({
          data: null,
          error: op === "insert" && opts.insertError ? opts.insertError : null,
          count: 0,
        }),
    };
    return api;
  }

  const supabase = {
    from(table: string) {
      return {
        update: (payload: any) => builder(table, "update", payload),
        insert: (payload: any) => builder(table, "insert", payload),
        select: (cols?: string, selOpts?: any) => {
          const b = builder(table, "select");
          // mimic chained select: support .eq().maybeSingle()
          return b.select(cols, selOpts);
        },
      };
    },
    rpc: async (name: string, args: any) => {
      rpcCalls.push({ name, args });
      return { data: { success: true, new_stock: 0 }, error: null };
    },
    functions: {
      invoke: async (name: string, body: any) => {
        invokeCalls.push({ name, body });
        return { data: null, error: null };
      },
    },
  };

  return { supabase, calls, rpcCalls, invokeCalls };
}

function makeStripeStub() {
  const transfers: any[] = [];
  return {
    paymentIntents: {
      retrieve: async (id: string) => ({ id, latest_charge: `ch_for_${id}` }),
    },
    transfers: {
      create: async (params: any) => {
        transfers.push(params);
        return { id: `tr_${transfers.length}`, ...params };
      },
    },
    _transfers: transfers,
  };
}

// ------------------------- Tests: checkout.session.completed -------------------------

Deno.test("checkout.session.completed: updates order to confirmed/paid with session + PI ids", async () => {
  const { supabase, calls } = makeSupabaseStub({
    orderRow: {
      id: "order_1",
      order_number: "MK-001",
      total_incl_vat: 100,
      payment_method: "card",
      shipping_address: null,
      customer: { email: "buyer@example.com", company_name: "Acme" },
    },
  });
  const stripe = makeStripeStub();
  __setTestDeps({ supabase, stripe });

  const session: any = {
    id: "cs_test_123",
    livemode: false,
    payment_intent: "pi_abc",
    metadata: {
      order_id: "order_1",
      order_number: "MK-001",
      vendor_breakdown: "[]",
    },
  };

  await handleCheckoutSessionCompleted(session);

  const orderUpdate = calls.find((c) => c.table === "orders" && c.op === "update");
  assert(orderUpdate, "orders.update must be called");
  assertEquals(orderUpdate!.payload.status, "confirmed");
  assertEquals(orderUpdate!.payload.payment_status, "paid");
  assertEquals(orderUpdate!.payload.stripe_session_id, "cs_test_123");
  assertEquals(orderUpdate!.payload.stripe_payment_intent_id, "pi_abc");
  assertEquals(orderUpdate!.payload.is_test, true);
  assertEquals(orderUpdate!.filters[0], ["id", "order_1"]);
});

Deno.test("checkout.session.completed: livemode=true sets is_test=false", async () => {
  const { supabase, calls } = makeSupabaseStub();
  __setTestDeps({ supabase, stripe: makeStripeStub() });

  const session: any = {
    id: "cs_live",
    livemode: true,
    metadata: { order_id: "order_2", vendor_breakdown: "[]" },
  };

  await handleCheckoutSessionCompleted(session);
  const orderUpdate = calls.find((c) => c.table === "orders" && c.op === "update");
  assertEquals(orderUpdate!.payload.is_test, false);
});

Deno.test("checkout.session.completed: no order_id → no DB update", async () => {
  const { supabase, calls } = makeSupabaseStub();
  __setTestDeps({ supabase, stripe: makeStripeStub() });

  await handleCheckoutSessionCompleted({ id: "cs_x", metadata: {} } as any);
  const orderUpdate = calls.find((c) => c.table === "orders" && c.op === "update");
  assertEquals(orderUpdate, undefined);
});

Deno.test("checkout.session.completed: missing payment_intent → no stripe_payment_intent_id, no PI retrieval", async () => {
  const { supabase, calls } = makeSupabaseStub();
  const stripe = makeStripeStub();
  let retrieved = false;
  stripe.paymentIntents.retrieve = async (id: string) => {
    retrieved = true;
    return { id, latest_charge: "ch_x" } as any;
  };
  __setTestDeps({ supabase, stripe });

  const session: any = {
    id: "cs_no_pi",
    livemode: false,
    metadata: { order_id: "order_3", vendor_breakdown: "[]" },
  };
  await handleCheckoutSessionCompleted(session);

  const orderUpdate = calls.find((c) => c.table === "orders" && c.op === "update");
  assertEquals(orderUpdate!.payload.stripe_payment_intent_id, undefined);
  assertEquals(retrieved, false, "Stripe PI retrieval must be skipped without a payment_intent");
});

// ------------------------- Tests: payment_intent.payment_failed -------------------------

Deno.test("payment_intent.payment_failed: marks order payment_status=failed and writes audit log", async () => {
  const { supabase, calls } = makeSupabaseStub();
  __setTestDeps({ supabase, stripe: makeStripeStub() });

  const pi: any = {
    id: "pi_failed",
    metadata: { order_id: "order_9" },
    last_payment_error: { message: "card_declined" },
  };

  await handlePaymentFailed(pi);

  const orderUpdate = calls.find((c) => c.table === "orders" && c.op === "update");
  assert(orderUpdate, "orders.update must be called on failure");
  assertEquals(orderUpdate!.payload.payment_status, "failed");
  assert(
    String(orderUpdate!.payload.admin_notes).includes("card_declined"),
    "admin_notes must include the Stripe error message",
  );
  assertEquals(orderUpdate!.filters[0], ["id", "order_9"]);

  const audit = calls.find((c) => c.table === "audit_logs" && c.op === "insert");
  assert(audit, "audit_logs.insert must be called on failure");
  assertEquals(audit!.payload.action, "payment_failed");
  assertEquals(audit!.payload.module, "stripe");
  assert(String(audit!.payload.detail).includes("pi_failed"));
  assert(String(audit!.payload.detail).includes("order_9"));
});

Deno.test("payment_intent.payment_failed: missing message falls back to 'erreur inconnue'", async () => {
  const { supabase, calls } = makeSupabaseStub();
  __setTestDeps({ supabase, stripe: makeStripeStub() });

  await handlePaymentFailed({
    id: "pi_x",
    metadata: { order_id: "order_10" },
    last_payment_error: null,
  } as any);

  const orderUpdate = calls.find((c) => c.table === "orders" && c.op === "update");
  assert(String(orderUpdate!.payload.admin_notes).includes("erreur inconnue"));
});

Deno.test("payment_intent.payment_failed: no order_id → no DB writes", async () => {
  const { supabase, calls } = makeSupabaseStub();
  __setTestDeps({ supabase, stripe: makeStripeStub() });

  await handlePaymentFailed({ id: "pi_orphan", metadata: {} } as any);
  assertEquals(calls.length, 0);
});
