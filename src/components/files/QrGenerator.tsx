"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Notice, NumberField, RangeField, SelectField } from "./ui";
import { makeMatrix } from "@/lib/files/qrmatrix";
import { UPI_ID_RE, emailPayload, phonePayload, qrContrast, qrSvg, smsPayload, upiPayload, vcardPayload, wifiPayload, type VCard, type WifiSecurity } from "@/lib/files/qr";
import { downloadBlob } from "@/lib/files/download";
import { canvasToBlob } from "@/lib/files/image";
import { copyToClipboard } from "../tool/CopyButton";
import { trackEvent } from "@/lib/analytics";

type Kind = "url" | "text" | "wifi" | "vcard" | "email" | "phone" | "sms" | "upi";
const KINDS: { value: Kind; label: string }[] = [
  { value: "url", label: "Website link (URL)" }, { value: "text", label: "Plain text" }, { value: "wifi", label: "Wi-Fi network" },
  { value: "vcard", label: "Contact card (vCard)" }, { value: "email", label: "Email" }, { value: "phone", label: "Phone number" },
  { value: "sms", label: "SMS message" }, { value: "upi", label: "UPI payment (India)" },
];
const EMPTY_V: VCard = { first: "", last: "", org: "", title: "", phone: "", email: "", url: "", street: "", city: "", country: "" };
const toolId = (preset: string) => (preset === "wifi" ? "wifi-qr-code-generator" : preset === "upi" ? "upi-qr-code-generator" : "qr-code-generator");

export default function QrGenerator({ preset = "general" }: { preset?: string }) {
  const locked: Kind | null = preset === "wifi" ? "wifi" : preset === "upi" ? "upi" : null;
  const [kind, setKind] = useState<Kind>(locked ?? "url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [wifi, setWifi] = useState({ ssid: "", password: "", security: "WPA" as WifiSecurity, hidden: false });
  const [vc, setVc] = useState<VCard>(EMPTY_V);
  const [mail, setMail] = useState({ to: "", subject: "", body: "" });
  const [phone, setPhone] = useState("");
  const [sms, setSms] = useState({ number: "", message: "" });
  const [upi, setUpi] = useState({ vpa: "", name: "", amount: "", note: "" });
  const [level, setLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(4);
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [copied, setCopied] = useState(false);
  const tracked = useRef(false);

  // payload + field-level problem for the current content type
  const built = useMemo((): { payload: string; problem: string; hint?: string } => {
    switch (kind) {
      case "url": {
        const v = url.trim();
        if (!v) return { payload: "", problem: "" };
        const hint = !/^[a-z][a-z0-9+.-]*:/i.test(v) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(v) ? "This looks like a web address without https://. Many phone cameras only open it as a link if it starts with https://." : undefined;
        return { payload: v, problem: "", hint };
      }
      case "text": return { payload: text, problem: "" };
      case "wifi":
        if (!wifi.ssid) return { payload: "", problem: "" };
        if (wifi.security !== "nopass" && !wifi.password) return { payload: "", problem: "Enter the Wi-Fi password, or choose “No password”." };
        if (wifi.security === "WPA" && wifi.password.length < 8) return { payload: "", problem: "WPA/WPA2/WPA3 passwords are at least 8 characters long." };
        return { payload: wifiPayload(wifi), problem: "" };
      case "vcard":
        if (!vc.first && !vc.last) return { payload: "", problem: "" };
        if (vc.email && !/^\S+@\S+\.\S+$/.test(vc.email.trim())) return { payload: "", problem: "That email address doesn't look right." };
        return { payload: vcardPayload(vc), problem: "" };
      case "email":
        if (!mail.to) return { payload: "", problem: "" };
        if (!/^\S+@\S+\.\S+$/.test(mail.to.trim())) return { payload: "", problem: "That email address doesn't look right." };
        return { payload: emailPayload(mail.to, mail.subject, mail.body), problem: "" };
      case "phone":
        if (!phone.trim()) return { payload: "", problem: "" };
        if (phone.replace(/[^\d]/g, "").length < 5) return { payload: "", problem: "Enter a phone number with at least 5 digits." };
        return { payload: phonePayload(phone), problem: "" };
      case "sms":
        if (!sms.number.trim()) return { payload: "", problem: "" };
        if (sms.number.replace(/[^\d]/g, "").length < 5) return { payload: "", problem: "Enter a phone number with at least 5 digits." };
        return { payload: smsPayload(sms.number, sms.message), problem: "" };
      case "upi": {
        if (!upi.vpa.trim()) return { payload: "", problem: "" };
        if (!UPI_ID_RE.test(upi.vpa.trim())) return { payload: "", problem: "A UPI ID looks like name@bank (letters, digits, dots, hyphens, then @ and the bank handle)." };
        if (!upi.name.trim()) return { payload: "", problem: "Enter the payee name that should appear in the payment app." };
        if (upi.amount.trim() && !(/^\d+(\.\d{1,2})?$/.test(upi.amount.trim()) && Number(upi.amount) > 0)) return { payload: "", problem: "The amount must be a positive number with at most 2 decimals, or empty to let the payer type it." };
        return { payload: upiPayload(upi), problem: "" };
      }
    }
  }, [kind, url, text, wifi, vc, mail, phone, sms, upi]);

  const code = useMemo(() => {
    if (!built.payload) return { matrix: null as boolean[][] | null, error: "" };
    try { return { matrix: makeMatrix(built.payload, level), error: "" }; }
    catch { return { matrix: null, error: "That's too much data for a QR code at this error-correction level. Shorten the content or choose level L, which holds the most." }; }
  }, [built.payload, level]);

  const contrast = qrContrast(fg, bg);
  const svg = useMemo(() => (code.matrix ? qrSvg(code.matrix, { margin, fg, bg, transparent }) : ""), [code.matrix, margin, fg, bg, transparent]);
  const svgUrl = useMemo(() => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : ""), [svg]);

  useEffect(() => {
    if (code.matrix && !tracked.current) { tracked.current = true; trackEvent("file_tool_files_added", { toolId: toolId(preset), resultCount: 1 }); }
  }, [code.matrix, preset]);

  const pngBlob = async () => {
    const m = code.matrix!;
    const total = m.length + margin * 2;
    const scale = Math.max(1, Math.floor(size / total));
    const px = total * scale; // whole pixels per module keeps the edges sharp
    const c = document.createElement("canvas");
    c.width = px; c.height = px;
    const g = c.getContext("2d")!;
    if (!transparent) { g.fillStyle = bg; g.fillRect(0, 0, px, px); }
    g.fillStyle = fg;
    for (let r = 0; r < m.length; r++) for (let col = 0; col < m.length; col++) if (m[r][col]) g.fillRect((col + margin) * scale, (r + margin) * scale, scale, scale);
    return { blob: await canvasToBlob(c, "image/png"), px };
  };
  const name = kind === "wifi" ? "wifi-qr-code" : kind === "upi" ? "upi-qr-code" : "qr-code";
  const savePng = async () => { const { blob } = await pngBlob(); downloadBlob(blob, `${name}.png`); trackEvent("file_tool_download", { toolId: toolId(preset), mode: "png" }); };
  const saveSvg = () => { downloadBlob(new Blob([qrSvg(code.matrix!, { margin, fg, bg, transparent, size })], { type: "image/svg+xml" }), `${name}.svg`); trackEvent("file_tool_download", { toolId: toolId(preset), mode: "svg" }); };
  const copyText = async () => { setCopied(await copyToClipboard(built.payload)); setTimeout(() => setCopied(false), 1800); };

  const f = (id: string, label: string, value: string, onChange: (v: string) => void, extra?: { placeholder?: string; type?: string; hint?: string; optional?: boolean; auto?: string }) => (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}{extra?.optional && <span className="field__optional">optional</span>}</label>
      <input id={id} className="input" type={extra?.type ?? "text"} value={value} placeholder={extra?.placeholder} autoComplete={extra?.auto ?? "off"} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
      {extra?.hint && <span className="field__hint">{extra.hint}</span>}
    </div>
  );

  return (
    <div className="card file-tool">
      <div className="settings-grid">
        {!locked && <SelectField id="qr-kind" label="What should the QR code contain?" wide value={kind} onChange={setKind} options={KINDS} />}
        {kind === "url" && <div className="field field--wide"><label className="field__label" htmlFor="qr-url">Link</label><input id="qr-url" className="input" inputMode="url" value={url} placeholder="https://example.com" autoComplete="off" spellCheck={false} onChange={(e) => setUrl(e.target.value)} />{built.hint && <span className="field__hint">{built.hint}</span>}</div>}
        {kind === "text" && <div className="field field--wide"><label className="field__label" htmlFor="qr-text">Text</label><textarea id="qr-text" className="textarea" rows={3} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} /></div>}
        {kind === "wifi" && (<>
          {f("qr-ssid", "Network name (SSID)", wifi.ssid, (v) => setWifi({ ...wifi, ssid: v }), { placeholder: "MyHomeWiFi" })}
          {wifi.security !== "nopass" && f("qr-wpw", "Password", wifi.password, (v) => setWifi({ ...wifi, password: v }), { type: "text", hint: "Shown so you can check it. It is only used to build the code in this tab." })}
          <SelectField id="qr-sec" label="Security" value={wifi.security} onChange={(v) => setWifi({ ...wifi, security: v })} options={[{ value: "WPA", label: "WPA / WPA2 / WPA3 (most routers)" }, { value: "WEP", label: "WEP (old routers)" }, { value: "nopass", label: "No password (open network)" }]} />
          <label className="check"><input type="checkbox" checked={wifi.hidden} onChange={(e) => setWifi({ ...wifi, hidden: e.target.checked })} /> Hidden network</label>
        </>)}
        {kind === "vcard" && (<>
          {f("vc-first", "First name", vc.first, (v) => setVc({ ...vc, first: v }), { auto: "off" })}
          {f("vc-last", "Last name", vc.last, (v) => setVc({ ...vc, last: v }))}
          {f("vc-org", "Company", vc.org, (v) => setVc({ ...vc, org: v }), { optional: true })}
          {f("vc-title", "Job title", vc.title, (v) => setVc({ ...vc, title: v }), { optional: true })}
          {f("vc-phone", "Phone", vc.phone, (v) => setVc({ ...vc, phone: v }), { optional: true, placeholder: "+91 98765 43210" })}
          {f("vc-email", "Email", vc.email, (v) => setVc({ ...vc, email: v }), { optional: true, type: "email" })}
          {f("vc-url", "Website", vc.url, (v) => setVc({ ...vc, url: v }), { optional: true, placeholder: "https://" })}
          {f("vc-street", "Street address", vc.street, (v) => setVc({ ...vc, street: v }), { optional: true })}
          {f("vc-city", "City", vc.city, (v) => setVc({ ...vc, city: v }), { optional: true })}
          {f("vc-country", "Country", vc.country, (v) => setVc({ ...vc, country: v }), { optional: true })}
        </>)}
        {kind === "email" && (<>
          {f("em-to", "Email address", mail.to, (v) => setMail({ ...mail, to: v }), { type: "email", placeholder: "name@example.com" })}
          {f("em-sub", "Subject", mail.subject, (v) => setMail({ ...mail, subject: v }), { optional: true })}
          <div className="field field--wide"><label className="field__label" htmlFor="em-body">Message<span className="field__optional">optional</span></label><textarea id="em-body" className="textarea" rows={3} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} /></div>
        </>)}
        {kind === "phone" && f("ph-n", "Phone number", phone, setPhone, { placeholder: "+91 98765 43210", type: "tel", hint: "Include the country code so it dials correctly from anywhere." })}
        {kind === "sms" && (<>
          {f("sm-n", "Phone number", sms.number, (v) => setSms({ ...sms, number: v }), { type: "tel", placeholder: "+91 98765 43210" })}
          <div className="field field--wide"><label className="field__label" htmlFor="sm-m">Message<span className="field__optional">optional</span></label><textarea id="sm-m" className="textarea" rows={2} value={sms.message} onChange={(e) => setSms({ ...sms, message: e.target.value })} /></div>
        </>)}
        {kind === "upi" && (<>
          {f("up-vpa", "UPI ID (VPA)", upi.vpa, (v) => setUpi({ ...upi, vpa: v }), { placeholder: "name@bank" })}
          {f("up-name", "Payee name", upi.name, (v) => setUpi({ ...upi, name: v }), { placeholder: "Your name or shop name", hint: "Shown to the payer in their UPI app." })}
          <NumberField id="up-am" label="Amount" value={upi.amount} onChange={(v) => setUpi({ ...upi, amount: v })} min={0} step={0.01} unit="₹" optional hint="Leave empty to let the payer type the amount." />
          {f("up-note", "Note", upi.note, (v) => setUpi({ ...upi, note: v }), { optional: true, placeholder: "e.g. Invoice 1042" })}
        </>)}
      </div>
      {built.problem && <Notice kind="warn">{built.problem}</Notice>}
      {code.error && <Notice kind="error">{code.error}</Notice>}

      <details className="qr-style">
        <summary>Size, colours and error correction</summary>
        <div className="settings-grid">
          <RangeField id="qr-size" label="Download size" value={size} min={128} max={2048} step={64} suffix=" px" onChange={setSize} hint="PNG size is rounded to whole pixels per square so edges stay sharp. SVG scales to any size." />
          <RangeField id="qr-margin" label="Quiet margin" value={margin} min={0} max={10} suffix=" squares" onChange={setMargin} hint="Scanners need about 4 squares of empty border. Less can make scanning fail." />
          <SelectField id="qr-level" label="Error correction" value={level} onChange={setLevel} options={[{ value: "L", label: "L — smallest code (7% recovery)" }, { value: "M", label: "M — balanced (15%)" }, { value: "Q", label: "Q — more robust (25%)" }, { value: "H", label: "H — most robust (30%)" }]} />
          <div className="field"><label className="field__label" htmlFor="qr-fg">Code colour</label><input id="qr-fg" type="color" className="color-input" value={fg} onChange={(e) => setFg(e.target.value)} /></div>
          <div className="field"><label className="field__label" htmlFor="qr-bg">Background colour</label><input id="qr-bg" type="color" className="color-input" value={bg} onChange={(e) => setBg(e.target.value)} disabled={transparent} /></div>
          <label className="check"><input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Transparent background</label>
        </div>
        {(contrast.ratio < 4 || contrast.inverted) && <Notice kind="warn">{contrast.inverted ? "The code is lighter than its background. Many scanners can't read inverted codes; use a dark code on a light background." : `Contrast is low (${contrast.ratio.toFixed(1)}:1). Use a darker code colour or a lighter background so phones can scan it.`}</Notice>}
        {transparent && <Notice kind="info">A transparent code scans well only when it is placed on a light, plain surface.</Notice>}
      </details>

      <div className="qr-out" aria-live="polite">
        {code.matrix && svgUrl ? (
          <>
            <div className="qr-out__img" style={{ background: transparent ? "#ffffff" : bg }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
              <img src={svgUrl} alt={`QR code containing: ${built.payload.length > 120 ? built.payload.slice(0, 120) + "…" : built.payload}`} width={260} height={260} />
            </div>
            <div className="qr-out__side">
              <p className="file-row__line">{code.matrix.length} × {code.matrix.length} squares (version {(code.matrix.length - 17) / 4}) · {[...built.payload].length} characters</p>
              <div className="btn-row" style={{ marginTop: "var(--s-3)" }}>
                <button type="button" className="btn btn--primary" onClick={savePng}><Icon name="download" /> PNG</button>
                <button type="button" className="btn btn--secondary" onClick={saveSvg}><Icon name="download" /> SVG</button>
                <button type="button" className="btn btn--secondary" onClick={copyText} data-state={copied ? "done" : undefined}><Icon name={copied ? "check" : "copy"} /> {copied ? "Copied" : "Copy text"}</button>
              </div>
              <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>Test it with your phone camera before printing or sharing. {kind === "upi" ? "Check the payee name that appears in your UPI app matches." : ""}</p>
            </div>
          </>
        ) : (
          <div className="result-placeholder"><strong>Your QR code appears here</strong><span>Fill in the details above. It updates as you type.</span></div>
        )}
      </div>
    </div>
  );
}
