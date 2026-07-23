import type { BulletinView } from "./bulletin-view";
import { topicLabel } from "./taxonomy";
import type { ImpactLevel } from "./types";

const IMPACT_COLORS: Record<ImpactLevel, { fg: string; bg: string; border: string }> = {
  HIGH: { fg: "#9a2515", bg: "#fbeae7", border: "#eec3ba" },
  MEDIUM: { fg: "#8a5a12", bg: "#fbf1e2", border: "#ecd8ae" },
  LOW: { fg: "#276e4d", bg: "#e8f3ec", border: "#bfdfcc" },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function entryBlock(entry: BulletinView): string {
  const colors = IMPACT_COLORS[entry.impactLevel];
  const checklist = entry.actionChecklist
    .slice(0, 3)
    .map(
      (item) =>
        `<li style="margin:0 0 6px 0; color:#1c2b36; font-size:14px; line-height:20px;">${escapeHtml(item)}</li>`
    )
    .join("");

  const topics = entry.topics
    .map(
      (slug) =>
        `<span style="display:inline-block; background:#f6f8f9; color:#5b6b76; font-size:11px; border-radius:999px; padding:2px 8px; margin:0 4px 4px 0;">${escapeHtml(
          topicLabel(slug)
        )}</span>`
    )
    .join("");

  return `
  <tr>
    <td style="padding:20px 0; border-bottom:1px solid #dde4e8;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="display:inline-block; background:${colors.bg}; color:${colors.fg}; border:1px solid ${colors.border}; border-radius:999px; padding:2px 10px; font-size:12px; font-weight:600;">
              ${entry.impactLevel.charAt(0)}${entry.impactLevel.slice(1).toLowerCase()} impact
            </span>
            <span style="color:#5b6b76; font-size:12px; margin-left:8px;">${escapeHtml(entry.sourceName)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding-top:10px;">
            <span style="color:#1c2b36; font-size:16px; font-weight:600; line-height:22px;">${escapeHtml(
              entry.title
            )}</span>
          </td>
        </tr>
        <tr>
          <td style="padding-top:6px;">${topics}</td>
        </tr>
        <tr>
          <td style="padding-top:8px; color:#1c2b36; font-size:14px; line-height:21px;">
            ${escapeHtml(entry.summary)}
          </td>
        </tr>
        ${
          checklist
            ? `<tr>
          <td style="padding-top:12px;">
            <span style="color:#0f7a72; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.03em;">Do before your next inspection</span>
            <ul style="margin:8px 0 0 0; padding-left:18px;">${checklist}</ul>
          </td>
        </tr>`
            : ""
        }
      </table>
    </td>
  </tr>`;
}

export function buildDigestHtml(
  entries: BulletinView[],
  options: { careHomeName: string; periodLabel: string }
): string {
  const { careHomeName, periodLabel } = options;
  const rows = entries.map(entryBlock).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Compliance Bulletin digest</title>
  </head>
  <body style="margin:0; padding:0; background:#f6f8f9; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f9; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border:1px solid #dde4e8; border-radius:8px;">
            <tr>
              <td style="padding:24px 28px; border-bottom:1px solid #dde4e8;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <span style="display:inline-block; width:28px; height:28px; background:#103a53; color:#ffffff; border-radius:6px; font-size:12px; font-weight:700; text-align:center; line-height:28px;">CI</span>
                      <span style="color:#1c2b36; font-size:15px; font-weight:600; margin-left:8px;">Compliance Bulletin</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0 28px;">
                <p style="margin:0; color:#5b6b76; font-size:13px;">${escapeHtml(periodLabel)} digest for</p>
                <h1 style="margin:4px 0 0 0; color:#1c2b36; font-size:20px;">${escapeHtml(careHomeName)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${
                    rows ||
                    `<tr><td style="padding:24px 0; color:#5b6b76; font-size:14px;">No new updates in this period.</td></tr>`
                  }
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px 28px;">
                <p style="margin:0; color:#5b6b76; font-size:12px; line-height:18px;">
                  You&rsquo;re receiving this digest because your Compliance Bulletin subscription is active.
                  This is a preview only — no email has been sent.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
