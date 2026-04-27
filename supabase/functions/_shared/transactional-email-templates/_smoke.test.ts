/**
 * Smoke test : instancie chaque template avec ses previewData (ou {})
 * et vérifie qu'aucune erreur (TDZ, ReferenceError, throw, etc.)
 * ne survient lors du rendu via React.createElement.
 *
 * Couvre les ex-bugs urgencyBoxInfo/Warn/Alert sur vendor-contract-reminder
 * en rendant ce template sur les 3 niveaux (1, 2, 3).
 */
import * as React from 'npm:react@18.3.1'
import { renderToStaticMarkup } from 'npm:react-dom@18.3.1/server'
import { TEMPLATES } from './registry.ts'

let failures = 0
const results: Array<{ name: string; variant: string; ok: boolean; err?: string }> = []

function tryRender(name: string, variant: string, props: Record<string, any>) {
  const entry = TEMPLATES[name]
  try {
    const el = React.createElement(entry.component as any, props)
    const html = renderToStaticMarkup(el)
    if (!html || html.length < 20) {
      throw new Error(`HTML output too short (${html?.length ?? 0} chars)`)
    }
    // Calcule aussi le subject (string ou function) pour tester sa branche
    const subj =
      typeof entry.subject === 'function'
        ? (entry.subject as any)(props)
        : entry.subject
    if (!subj || typeof subj !== 'string') {
      throw new Error('subject did not resolve to a string')
    }
    results.push({ name, variant, ok: true })
  } catch (e) {
    failures++
    results.push({ name, variant, ok: false, err: (e as Error).message })
  }
}

for (const [name, entry] of Object.entries(TEMPLATES)) {
  // 1) avec previewData fourni
  tryRender(name, 'previewData', entry.previewData ?? {})
  // 2) avec props vides — vérifie les fallbacks
  tryRender(name, 'empty', {})
}

// Cas spécifique : vendor-contract-reminder doit fonctionner pour les 3 niveaux
for (const lvl of [1, 2, 3]) {
  tryRender('vendor-contract-reminder', `level=${lvl}`, {
    vendorCompanyName: 'PharmaCorp SRL',
    signerName: 'Jean Dupont',
    daysSinceInvitation: lvl * 4,
    reminderLevel: lvl,
    contractVersion: 'v1.0',
    contractUrl: 'https://medikong.pro/vendor/contract',
  })
}

for (const r of results) {
  const tag = r.ok ? 'OK' : 'FAIL'
  console.log(`[${tag}] ${r.name}  (${r.variant})${r.err ? '  -> ' + r.err : ''}`)
}

console.log(`\n${results.length - failures}/${results.length} renders OK, ${failures} failures.`)
if (failures > 0) Deno.exit(1)
