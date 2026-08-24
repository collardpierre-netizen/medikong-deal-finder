import { createClient } from 'npm:@supabase/supabase-js@2'
import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type LegacyReason = 'bounce' | 'complaint' | 'unsubscribe'

// Reproduces the legacy suppression handler's writes on the kept tables:
// - suppressed_emails upsert (notification-only; Lovable enforces suppression
//   at send time, this row is never read to gate sends)
// - email_send_log audit row with the stock 'system' template name
// CHECK constraints on both tables only accept the exact strings below.
async function recordSuppression(
  recipient: string,
  reason: LegacyReason,
  eventId: string,
) {
  const normalizedEmail = recipient.toLowerCase()
  const redacted = normalizedEmail[0] + '***@' + (normalizedEmail.split('@')[1] ?? '')

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      { email: normalizedEmail, reason, metadata: null },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      code: suppressError.code,
      message: suppressError.message,
      event_id: eventId,
    })
    // Throw so the delivery is retried (handlers are idempotent: upsert on email)
    throw new Error('Failed to write suppression')
  }

  const { status, message } = mapReason(reason)
  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: null,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status,
      error_message: message,
      metadata: null,
    })

  if (insertError) {
    // Non-fatal — the suppression itself was already recorded.
    console.error('Failed to insert email_send_log', {
      code: insertError.code,
      message: insertError.message,
      event_id: eventId,
    })
  }

  console.log('Suppression processed', { email_redacted: redacted, reason, event_id: eventId })
}

function mapReason(reason: LegacyReason): { status: string; message: string } {
  switch (reason) {
    case 'bounce':
      return { status: 'bounced', message: 'Permanent bounce — email address is invalid or rejected' }
    case 'complaint':
      return { status: 'complained', message: 'Spam complaint — recipient marked email as spam' }
    default:
      return { status: 'suppressed', message: 'Recipient unsubscribed' }
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await recordSuppression(event.data.recipient, 'bounce', event.event_id)
    },
    'email.complaint': async (event) => {
      await recordSuppression(event.data.recipient, 'complaint', event.event_id)
    },
    'email.unsubscribed': async (event) => {
      await recordSuppression(event.data.recipient, 'unsubscribe', event.event_id)
    },
  },
})

Deno.serve((req) => handler(req))
