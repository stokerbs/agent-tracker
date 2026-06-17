/**
 * Transactional email via Resend.
 * All functions are fire-and-forget: they never throw or block the caller.
 * RESEND_API_KEY must be set in production; absent key → silent no-op.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://detectivepulse.app";
const FROM = process.env.EMAIL_FROM ?? "Detective Pulse <no-reply@detectivepulse.app>";

// ── shared layout ────────────────────────────────────────────────────────────

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Detective Pulse</title>
</head>
<body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#1E293B;border-radius:12px;overflow:hidden;border:1px solid #334155;">
        <!-- Header -->
        <tr>
          <td style="background:#0EA5E9;padding:20px 32px;">
            <p style="margin:0;font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px;">
              Detective Pulse
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:1px;text-transform:uppercase;">
              Operations Command Center
            </p>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #334155;">
            <p style="margin:0;font-size:11px;color:#64748B;text-align:center;">
              This is an automated message from Detective Pulse. Do not reply.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#0EA5E9;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">${label}</a>`;
}

function mono(text: string): string {
  return `<code style="font-family:monospace;background:#0F172A;color:#38BDF8;padding:2px 6px;border-radius:4px;font-size:13px;">${text}</code>`;
}

// ── email senders ────────────────────────────────────────────────────────────

interface AssignmentEmailParams {
  to: string;
  agentName: string;
  caseNumber: string;
  caseType: string | null;
  clientName: string | null;
  caseId: string;
}

export async function sendAssignmentEmail(params: AssignmentEmailParams): Promise<void> {
  const { to, agentName, caseNumber, caseType, clientName, caseId } = params;
  if (!process.env.RESEND_API_KEY) return;

  const caseUrl = `${APP_URL}/cases/${caseId}`;
  const html = layout(`
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#F1F5F9;">New Case Assignment</p>
    <p style="margin:0 0 20px;font-size:14px;color:#94A3B8;">Hi ${agentName},</p>
    <p style="margin:0 0 20px;font-size:14px;color:#CBD5E1;line-height:1.6;">
      You have been assigned to case ${mono(caseNumber)}.
      ${caseType ? `The case type is <strong style="color:#F1F5F9;">${caseType}</strong>.` : ""}
      ${clientName ? `Client: <strong style="color:#F1F5F9;">${clientName}</strong>.` : ""}
    </p>
    <p style="margin:0;font-size:14px;color:#94A3B8;">Log in to review your assignment and begin field operations.</p>
    ${button(caseUrl, "View Case")}
  `);

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM,
      to,
      subject: `New assignment: ${caseNumber}`,
      html,
    });
  } catch (err) {
    console.error("[email] sendAssignmentEmail failed:", err);
  }
}

interface InvoiceEmailParams {
  to: string;
  clientName: string;
  invoiceNumber: string;
  invoiceTitle: string;
  amount: number;
  currency: string;
  dueDate: string | null;
}

export async function sendInvoiceEmail(params: InvoiceEmailParams): Promise<void> {
  const { to, clientName, invoiceNumber, invoiceTitle, amount, currency, dueDate } = params;
  if (!process.env.RESEND_API_KEY) return;

  const portalUrl = `${APP_URL}/portal`;
  const amountFormatted = `${amount.toLocaleString("th-TH")} ${currency}`;
  const dueLine = dueDate
    ? `<p style="margin:0 0 20px;font-size:14px;color:#CBD5E1;line-height:1.6;">
        Payment is due by <strong style="color:#F1F5F9;">${new Date(dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong>.
       </p>`
    : "";

  const html = layout(`
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#F1F5F9;">Invoice ${invoiceNumber}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#94A3B8;">Dear ${clientName},</p>
    <p style="margin:0 0 20px;font-size:14px;color:#CBD5E1;line-height:1.6;">
      An invoice has been issued for <strong style="color:#F1F5F9;">${invoiceTitle}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#0F172A;border-radius:8px;border:1px solid #334155;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;">Amount Due</p>
          <p style="margin:0;font-size:28px;font-weight:700;color:#0EA5E9;font-family:monospace;">${amountFormatted}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748B;">${mono(invoiceNumber)}</p>
        </td>
      </tr>
    </table>
    ${dueLine}
    <p style="margin:0;font-size:14px;color:#94A3B8;">
      Log in to your client portal to view and download the full invoice.
    </p>
    ${button(portalUrl, "View Invoice in Portal")}
  `);

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Invoice ${invoiceNumber} — ${amountFormatted}`,
      html,
    });
  } catch (err) {
    console.error("[email] sendInvoiceEmail failed:", err);
  }
}

interface ReportApprovedEmailParams {
  to: string;
  clientName: string;
  caseNumber: string;
}

export async function sendReportApprovedEmail(params: ReportApprovedEmailParams): Promise<void> {
  const { to, clientName, caseNumber } = params;
  if (!process.env.RESEND_API_KEY) return;

  const portalUrl = `${APP_URL}/portal`;
  const html = layout(`
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#F1F5F9;">Your Report Is Ready</p>
    <p style="margin:0 0 20px;font-size:14px;color:#94A3B8;">Dear ${clientName},</p>
    <p style="margin:0 0 20px;font-size:14px;color:#CBD5E1;line-height:1.6;">
      A surveillance report for case ${mono(caseNumber)} has been approved and is now available
      in your secure client portal.
    </p>
    <p style="margin:0;font-size:14px;color:#94A3B8;">
      All reports are confidential. Please do not forward this email.
    </p>
    ${button(portalUrl, "View Report in Portal")}
  `);

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Surveillance report ready — ${caseNumber}`,
      html,
    });
  } catch (err) {
    console.error("[email] sendReportApprovedEmail failed:", err);
  }
}
