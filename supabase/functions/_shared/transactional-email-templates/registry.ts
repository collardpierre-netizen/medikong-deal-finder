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
import { template as buyerVerified } from './buyer-verified.tsx'
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
import { template as auditConfirmation } from './audit-confirmation.tsx'
import { template as auditNewLead } from './audit-new-lead.tsx'
import { template as auditReportReady } from './audit-report-ready.tsx'
import { template as accountInvitation } from './account-invitation.tsx'
import { template as vendorAccountCreated } from './vendor-account-created.tsx'
import { template as vendorAttachVerification } from './vendor-attach-verification.tsx'
import { template as vendorSelfRegistered } from './vendor-self-registered.tsx'
import { template as invoicePaymentReminder } from './invoice-payment-reminder.tsx'
import { template as p2pOfferReceived } from './p2p-offer-received.tsx'
import { template as p2pOfferAccepted } from './p2p-offer-accepted.tsx'
import { template as p2pOfferDeclined } from './p2p-offer-declined.tsx'
import { template as p2pCounterOffer } from './p2p-counter-offer.tsx'
import { template as orderLineAccepted } from './order-line-accepted.tsx'
import { template as orderLineShipped } from './order-line-shipped.tsx'
import { template as orderLineDelivered } from './order-line-delivered.tsx'
import { template as vendorDelegateCallback } from './vendor-delegate-callback.tsx'
import { template as quoteSent } from './quote-sent.tsx'
import { template as orderShipped } from './order-shipped.tsx'
import { template as orderDeliveryConfirmation } from './order-delivery-confirmation.tsx'
import { template as vendorStatementReady } from './vendor-statement-ready.tsx'
import { template as vendorPeppolIdReminder } from './vendor-peppol-id-reminder.tsx'



export const TEMPLATES: Record<string, TemplateEntry> = {
  'vendor-invoices': vendorInvoices,
  'rfq-vendor-invitation': rfqVendorInvitation,
  'wholesale-savings-report': wholesaleSavingsReport,
  'order-confirmation': orderConfirmation,
  'vendor-application': vendorApplication,
  'vendor-approved': vendorApproved,
  'vendor-rejected': vendorRejected,
  'buyer-registration': buyerRegistration,
  'buyer-verified': buyerVerified,
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
  'audit-confirmation': auditConfirmation,
  'audit-new-lead': auditNewLead,
  'audit-report-ready': auditReportReady,
  'account-invitation': accountInvitation,
  'vendor-account-created': vendorAccountCreated,
  'vendor-attach-verification': vendorAttachVerification,
  'vendor-self-registered': vendorSelfRegistered,
  'invoice-payment-reminder': invoicePaymentReminder,
  'p2p-offer-received': p2pOfferReceived,
  'p2p-offer-accepted': p2pOfferAccepted,
  'p2p-offer-declined': p2pOfferDeclined,
  'p2p-counter-offer': p2pCounterOffer,
  'order-line-accepted': orderLineAccepted,
  'order-line-shipped': orderLineShipped,
  'order-line-delivered': orderLineDelivered,
  'vendor-delegate-callback': vendorDelegateCallback,
  'quote-sent': quoteSent,
  'order-shipped': orderShipped,
  'order-delivery-confirmation': orderDeliveryConfirmation,
  'vendor-statement-ready': vendorStatementReady,
}

