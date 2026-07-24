import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  vendorCompanyName?: string
  contactName?: string
  vendorSettingsUrl?: string
  peppolExample?: string
}

const Email = ({
  vendorCompanyName,
  contactName,
  vendorSettingsUrl = 'https://medikong.pro/vendor/settings',
  peppolExample = '0208:BE0404014205',
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Complétez votre identifiant Peppol pour recevoir vos factures électroniques</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>Votre identifiant Peppol est requis</Heading>
        </Section>

        <Text style={paragraph}>
          Bonjour {contactName || vendorCompanyName || 'cher partenaire'},
        </Text>

        <Text style={paragraph}>
          Nous avons remarqué que <strong>{vendorCompanyName || 'votre entreprise'}</strong> n'a pas encore renseigné son
          identifiant Peppol sur MediKong.
        </Text>

        <Section style={warnBox}>
          <Text style={warnText}>
            ⚠️ Votre identifiant Peppol est requis pour recevoir vos factures électroniques
            conformément à la loi belge du 1<sup>er</sup> janvier 2026.
          </Text>
        </Section>

        <Text style={paragraph}>
          Format attendu : <span style={mono}>0208:BEXXXXXXXXXXX</span> (votre n° TVA belge sans points ni tirets,
          précédé de « 0208: »).<br />
          Exemple : <span style={mono}>{peppolExample}</span>
        </Text>

        <Text style={paragraph}>
          Votre comptable ou votre logiciel de facturation peut vous fournir cet identifiant en quelques minutes.
        </Text>

        <Section style={ctaWrap}>
          <Button href={vendorSettingsUrl} style={cta}>
            Compléter mon Peppol ID
          </Button>
        </Section>

        <Text style={footer}>
          MediKong SRL · 23 rue de la Procession, 7822 Ath · BE 1005.771.323
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: '⚠️ Votre identifiant Peppol est requis',
  displayName: 'Vendeur — Rappel Peppol ID (BE)',
  previewData: { vendorCompanyName: 'Noralphar', contactName: 'Jean Dupont' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', color: '#1D2530' } as const
const container = { padding: '24px 28px', maxWidth: '600px', margin: '0 auto' } as const
const header = { borderBottom: '3px solid #1B5BDA', paddingBottom: '12px', marginBottom: '18px' } as const
const h1 = { fontSize: '20px', fontWeight: 700, color: '#1D2530', margin: 0 } as const
const paragraph = { fontSize: '14px', lineHeight: '22px', color: '#1D2530', margin: '10px 0' } as const
const warnBox = { backgroundColor: '#FEF3C7', borderLeft: '4px solid #F59E0B', padding: '12px 14px', margin: '16px 0', borderRadius: '4px' } as const
const warnText = { fontSize: '13px', lineHeight: '20px', color: '#92400E', margin: 0, fontWeight: 600 } as const
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', backgroundColor: '#F1F5F9', padding: '1px 6px', borderRadius: '3px', fontSize: '13px' } as const
const ctaWrap = { textAlign: 'center' as const, margin: '24px 0 8px' }
const cta = { backgroundColor: '#1B5BDA', color: '#ffffff', padding: '12px 22px', borderRadius: '6px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' } as const
const footer = { fontSize: '11px', color: '#8B95A5', textAlign: 'center' as const, marginTop: '24px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }
