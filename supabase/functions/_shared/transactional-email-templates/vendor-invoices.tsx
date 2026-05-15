import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr, Section, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MediKong"
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/cms-images/email-logo-horizontal.png'

interface InvoiceItem {
  vendorName: string
  invoiceNumber: string
  amount: string
  pdfUrl: string
  hostedUrl?: string
}

interface VendorInvoicesProps {
  orderNumber?: string
  customerName?: string
  invoices?: InvoiceItem[]
}

const VendorInvoicesEmail = ({
  orderNumber = 'MK-2026-00001',
  customerName,
  invoices = [],
}: VendorInvoicesProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Vos factures pour la commande {orderNumber}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>
          {customerName ? `Bonjour ${customerName},` : 'Bonjour,'}
        </Heading>
        <Text style={text}>
          Votre commande <strong style={{ color: '#1e3a5f' }}>{orderNumber}</strong> a été
          confirmée et payée. Vous trouverez ci-dessous les factures émises par vos fournisseurs :
        </Text>

        {invoices.map((inv, i) => (
          <Section key={i} style={invoiceBox}>
            <Row>
              <Column style={{ verticalAlign: 'top' as const }}>
                <Text style={vendorLabel}>{inv.vendorName}</Text>
                <Text style={invoiceMeta}>
                  Facture {inv.invoiceNumber} — {inv.amount}
                </Text>
              </Column>
              <Column style={{ verticalAlign: 'top' as const, textAlign: 'right' as const }}>
                <Button href={inv.pdfUrl} style={button}>
                  Télécharger PDF
                </Button>
              </Column>
            </Row>
          </Section>
        ))}

        <Hr style={divider} />
        <Text style={legalText}>
          Ces factures sont émises au nom et pour le compte de chaque fournisseur concerné,
          conformément à notre statut d'opérateur de marketplace.
        </Text>

        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VendorInvoicesEmail,
  subject: (data: Record<string, any>) =>
    `Vos factures pour la commande Medikong ${data.orderNumber || ''}`.trim(),
  displayName: 'Factures vendors',
  previewData: {
    orderNumber: 'MK-2026-00042',
    customerName: 'Pharmacie Centrale',
    invoices: [
      { vendorName: 'Laboratoires Acme', invoiceNumber: 'INV-0001', amount: '450,00 EUR', pdfUrl: '#' },
      { vendorName: 'Distrib Pharma', invoiceNumber: 'INV-0123', amount: '795,00 EUR', pdfUrl: '#' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 24px' }
const invoiceBox = { backgroundColor: '#f8f9fb', borderRadius: '8px', padding: '16px', marginBottom: '12px', border: '1px solid #d1d5db' }
const vendorLabel = { fontSize: '15px', fontWeight: '600' as const, color: '#1e3a5f', margin: '0 0 4px' }
const invoiceMeta = { fontSize: '13px', color: '#6b7280', margin: '0' }
const button = { backgroundColor: '#1e3a5f', color: '#ffffff', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block' }
const divider = { borderColor: '#d1d5db', margin: '24px 0' }
const legalText = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 24px', fontStyle: 'italic' as const }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
