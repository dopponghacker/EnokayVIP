import { Resend } from "resend";
import { Tier, TIER_META, VipTip, BookingCode } from "./types";

let resend: Resend;

function getResendClient(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Enokay69 <noreply@enokay69.com>";

function getTierColor(tier: Tier): string {
  switch (tier) {
    case "accurate-odds":
      return "#0d9488";
    case "draw-tips":
      return "#f59e0b";
    case "correct-score":
      return "#7c3aed";
    default:
      return "#0f172a";
  }
}

function buildTipsHtml(tips: VipTip[], bookingCode: BookingCode | null, tier: Tier): string {
  const meta = TIER_META[tier];
  const tierColor = getTierColor(tier);

  const tipsRows = tips
    .map(
      (tip) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">
          ${tip.homeTeam} vs ${tip.awayTeam}
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;">
          ${tip.league}
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:${tierColor};">
          ${tip.prediction}
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;">
          ${tip.odds || "-"}
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;">
          ${tip.time || "-"}
        </td>
      </tr>`
    )
    .join("");

  const bookingSection = bookingCode
    ? `
    <div style="margin-top:32px;padding:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;text-align:center;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#166534;font-weight:600;">BOOKING CODE</p>
      <p style="margin:0;font-size:32px;font-weight:900;color:#15803d;letter-spacing:4px;">${bookingCode.code}</p>
    </div>
  `
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
        <!-- Header -->
        <div style="text-align:center;margin-bottom:32px;">
          <div style="display:inline-block;width:48px;height:48px;background:${tierColor};border-radius:12px;line-height:48px;font-size:18px;font-weight:900;color:white;">69</div>
          <h1 style="margin:16px 0 4px 0;font-size:24px;font-weight:900;color:#0f172a;">Enokay69</h1>
          <p style="margin:0;font-size:13px;color:#64748b;">VIP Predictions - ${meta.label}</p>
        </div>

        <!-- Tips Table -->
        <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:${tierColor};">
                <th style="padding:12px 16px;text-align:left;color:white;font-weight:700;">Match</th>
                <th style="padding:12px 16px;text-align:left;color:white;font-weight:700;">League</th>
                <th style="padding:12px 16px;text-align:left;color:white;font-weight:700;">Prediction</th>
                <th style="padding:12px 16px;text-align:left;color:white;font-weight:700;">Odds</th>
                <th style="padding:12px 16px;text-align:left;color:white;font-weight:700;">Time</th>
              </tr>
            </thead>
            <tbody>
              ${tipsRows}
            </tbody>
          </table>
        </div>

        ${bookingSection}

        <!-- Footer -->
        <div style="margin-top:32px;text-align:center;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;">
            This package was purchased for <strong>${meta.label}</strong> at <strong>GH&#8373;${meta.amount}</strong>.
          </p>
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            Access valid for 24 hours from time of approval.
          </p>
          <p style="margin:16px 0 0 0;font-size:11px;color:#cbd5e1;">
            &copy; ${new Date().getFullYear()} Enokay69. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendVipTipsEmail(
  email: string,
  tier: Tier,
  tips: VipTip[],
  bookingCode: BookingCode | null
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured - skipping email");
      return { success: false, error: "Email service not configured" };
    }

    const meta = TIER_META[tier];
    const html = buildTipsHtml(tips, bookingCode, tier);

    const { error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Enokay69 - ${meta.label} VIP Predictions`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Email send error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}
