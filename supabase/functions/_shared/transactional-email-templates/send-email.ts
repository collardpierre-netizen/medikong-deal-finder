import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import {
  FROM_DOMAIN,
  SENDER_DOMAIN,
  sendLovableEmail,
} from 'npm:@lovable.dev/email-js@0.1.0'
import { TEMPLATES } from './registry.ts'

const SITE_NAME = 'MediKong'

export interface SendTemplateEmailOptions {
  templateData?: Record<string, unknown>
  idempotencyKey?: string
  // Per-send overrides applied after rendering (e.g. admin-managed content
  // overrides). The HTML override bypasses React rendering, exactly like the
  // legacy send surface did — callers must treat it as trusted content.
  subjectOverride?: string
  htmlOverride?: string
}

export interface SendTemplateEmailResult {
  sent: boolean
  reason?: string
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) throw new Error('LOVABLE_API_KEY is not set')

  const entry = TEMPLATES[templateName]
  if (!entry) throw new Error(`Unknown template: ${templateName}`)

  const props = { ...(entry.previewData ?? {}), ...(options.templateData ?? {}) }
  let subject =
    typeof entry.subject === 'function' ? entry.subject(props) : entry.subject
  let html: string
  if (options.htmlOverride) {
    html = options.htmlOverride
  } else {
    const element = React.createElement(entry.component as React.ComponentType<Record<string, unknown>>, props)
    html = await renderAsync(element)
  }
  if (options.subjectOverride) subject = options.subjectOverride
  const text = htmlToPlainText(html)

  const result = await sendLovableEmail(
    {
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      to: [to],
      subject,
      html,
      text,
      purpose: 'transactional',
      sender_domain: SENDER_DOMAIN,
      idempotency_key: options.idempotencyKey,
    },
    { apiKey },
  )

  if (!result.sent) {
    return { sent: false, reason: result.reason }
  }

  return { sent: true }
}
