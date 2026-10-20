/** Builds the text a phone reads out of a QR code, for each kind of content. Pure functions, unit-tested. */

/** Wi-Fi: backslash-escape \ ; , : and " (the format used by Android and iOS cameras). */
const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
export type WifiSecurity = "WPA" | "WEP" | "nopass";
export function wifiPayload(o: { ssid: string; password: string; security: WifiSecurity; hidden: boolean }): string {
  const parts = [`T:${o.security}`, `S:${wifiEscape(o.ssid)}`];
  if (o.security !== "nopass") parts.push(`P:${wifiEscape(o.password)}`);
  if (o.hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

/** vCard 3.0 values escape backslash, comma, semicolon and newlines. */
const vEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
export type VCard = { first: string; last: string; org: string; title: string; phone: string; email: string; url: string; street: string; city: string; country: string };
export function vcardPayload(c: VCard): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${vEscape(c.last)};${vEscape(c.first)};;;`, `FN:${vEscape([c.first, c.last].filter(Boolean).join(" "))}`];
  if (c.org) lines.push(`ORG:${vEscape(c.org)}`);
  if (c.title) lines.push(`TITLE:${vEscape(c.title)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone.replace(/[^\d+]/g, "")}`);
  if (c.email) lines.push(`EMAIL:${c.email.trim()}`);
  if (c.url) lines.push(`URL:${c.url.trim()}`);
  if (c.street || c.city || c.country) lines.push(`ADR;TYPE=WORK:;;${vEscape(c.street)};${vEscape(c.city)};;;${vEscape(c.country)}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

export const emailPayload = (to: string, subject: string, body: string): string => {
  const q = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean).join("&");
  return `mailto:${to.trim()}${q ? `?${q}` : ""}`;
};
export const phonePayload = (n: string): string => `tel:${n.replace(/[^\d+]/g, "")}`;
export const smsPayload = (n: string, msg: string): string => `SMSTO:${n.replace(/[^\d+]/g, "")}:${msg}`;

/** UPI payment link (NPCI deep-link format): upi://pay?pa=…&pn=…&am=…&cu=INR&tn=… */
export const UPI_ID_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{2,64}$/;
export function upiPayload(o: { vpa: string; name: string; amount: string; note: string }): string {
  const enc = (s: string) => encodeURIComponent(s.trim());
  const parts = [`pa=${o.vpa.trim()}`, `pn=${enc(o.name)}`];
  if (o.amount.trim()) parts.push(`am=${Number(o.amount).toFixed(2).replace(/\.00$/, "")}`);
  parts.push("cu=INR");
  if (o.note.trim()) parts.push(`tn=${enc(o.note)}`);
  return `upi://pay?${parts.join("&")}`;
}

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
/** WCAG contrast ratio between two #rrggbb colours, plus whether the code is light-on-dark (inverted). */
export function qrContrast(fg: string, bg: string): { ratio: number; inverted: boolean } {
  const a = lum(fg), b = lum(bg);
  return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), inverted: a > b };
}

/** SVG markup for a module matrix. Adjacent dark modules in a row are merged into one rectangle, which keeps the file small. */
export function qrSvg(matrix: boolean[][], o: { margin: number; fg: string; bg: string; transparent: boolean; size?: number }): string {
  const n = matrix.length, total = n + o.margin * 2;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c]) continue;
      let end = c;
      while (end + 1 < n && matrix[r][end + 1]) end++;
      d += `M${c + o.margin} ${r + o.margin}h${end - c + 1}v1h-${end - c + 1}z`;
      c = end;
    }
  }
  const px = o.size ? ` width="${o.size}" height="${o.size}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"${px} shape-rendering="crispEdges">${o.transparent ? "" : `<rect width="${total}" height="${total}" fill="${o.bg}"/>`}<path d="${d}" fill="${o.fg}"/></svg>`;
}
