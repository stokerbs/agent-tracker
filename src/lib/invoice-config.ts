// Invoice payment / remit-to details printed on every generated invoice PDF.
//
// Deliberately NOT branded with the company name (operational security: an
// invoice should not let a surveillance subject trace the firm). Only the bank
// transfer details the client needs in order to pay are shown.
//
// Single-tenant config — edit these values to change the payee on all invoices.

export interface InvoiceRemit {
  bankLabel: string; // e.g. "Please transfer to: SCB Bank"
  accountName: string;
  swift: string;
  accountNumber: string;
}

export const INVOICE_REMIT: InvoiceRemit = {
  bankLabel: "Please transfer to: SCB Bank",
  accountName: "Apidet Tharaboot",
  swift: "SICOTHBK",
  accountNumber: "4141503931",
};

// Closing line above the total, like the template's "Thank you for your business!".
export const INVOICE_FOOTER_NOTE = "Thank you for your business!";
