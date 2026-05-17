/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as orderConfirmation } from './order-confirmation.tsx'
import { template as vendorApplication } from './vendor-application.tsx'
import { template as vendorApproved } from './vendor-approved.tsx'
import { template as vendorRejected } from './vendor-rejected.tsx'
import { template as buyerRegistration } from './buyer-registration.tsx'
import { template as vendorContractSigned } from './vendor-contract-signed.tsx'
import { template as adminContractNotification } from './admin-contract-notification.tsx'
import { template as vendorContractSubmitted } from './vendor-contract-submitted.tsx'
import { template as vendorContractReminder } from './vendor-contract-reminder.tsx'
import { template as rfqVendorInvitation } from './rfq-vendor-invitation.tsx'
import { template as vendorPriceChallenge } from './vendor-price-challenge.tsx'
import { template as vendorNewOrder } from './vendor-new-order.tsx'
import { template as wholesaleSavingsReport } from './wholesale-savings-report.tsx'
import { template as subscriptionExtensionApproved } from './subscription-extension-approved.tsx'
import { template as subscriptionExtensionRejected } from './subscription-extension-rejected.tsx'
import { template as adminVendorMarketIntelNotification } from './admin-vendor-market-intel-notification.tsx'
import { template as vendorInvoices } from './vendor-invoices.tsx'
import { template as orderLineRefundedCustomer } from './order-line-refunded-customer.tsx'
import { template as orderLineRefundedAdmin } from './order-line-refunded-admin.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'vendor-invoices': vendorInvoices,
  'rfq-vendor-invitation': rfqVendorInvitation,
  'wholesale-savings-report': wholesaleSavingsReport,
  'order-confirmation': orderConfirmation,
  'vendor-application': vendorApplication,
  'vendor-approved': vendorApproved,
  'vendor-rejected': vendorRejected,
  'buyer-registration': buyerRegistration,
  'vendor-contract-signed': vendorContractSigned,
  'admin-contract-notification': adminContractNotification,
  'vendor-contract-submitted': vendorContractSubmitted,
  'vendor-contract-reminder': vendorContractReminder,
  'vendor-price-challenge': vendorPriceChallenge,
  'vendor-new-order': vendorNewOrder,
  'subscription-extension-approved': subscriptionExtensionApproved,
  'subscription-extension-rejected': subscriptionExtensionRejected,
  'admin-vendor-market-intel-notification': adminVendorMarketIntelNotification,
  'order-line-refunded-customer': orderLineRefundedCustomer,
  'order-line-refunded-admin': orderLineRefundedAdmin,
}
