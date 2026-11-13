// Optional fully-automatic sending through the WhatsApp Cloud API (Meta).
// The browser generates the PDF and posts it here; we upload it to WhatsApp's
// own media storage and send it. Nothing is saved in Supabase.
import { requireUser } from "@/lib/server/auth";
import { connection } from "next/server";
import { money, pdfName, waNumber } from "@/lib/format";
import { BadRequest, errorResponse, supabase } from "@/lib/server/supabase";
import { readShopRow } from "@/lib/server/shop";
import { normalizeBill } from "@/lib/server/validate";

const cfg = () => ({
  token: process.env.WHATSAPP_TOKEN || "",
  phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  template: process.env.WHATSAPP_TEMPLATE_NAME || "",
  lang: process.env.WHATSAPP_TEMPLATE_LANG || "en",
  version: process.env.WHATSAPP_API_VERSION || "v23.0",
});
const enabled = () => Boolean(cfg().token && cfg().phoneId);

// GET /api/whatsapp — tells the UI whether automatic sending is configured
export async function GET() {
  await connection();
  try {
    await requireUser();
    return Response.json({ enabled: enabled() });
  } catch (err) {
    return errorResponse(err);
  }
}

async function graph(path: string, init: RequestInit) {
  const { token, version } = cfg();
  const res = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.error_user_msg || json?.error?.message || `WhatsApp API error ${res.status}`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  return json;
}

// POST /api/whatsapp — multipart: billId, file (application/pdf)
export async function POST(req: Request) {
  try {
    await requireUser();
    if (!enabled()) throw new BadRequest("WhatsApp Cloud API is not configured in .env.local.");
    const { phoneId, template, lang } = cfg();

    const form = await req.formData();
    const billId = Number(form.get("billId"));
    const file = form.get("file");
    if (!Number.isInteger(billId)) throw new BadRequest("Missing bill id.");
    if (!(file instanceof File) || file.type !== "application/pdf") throw new BadRequest("Missing PDF.");
    if (file.size > 10 * 1024 * 1024) throw new BadRequest("PDF is too large.");

    // The phone number always comes from the database, never from the request.
    const { data, error } = await supabase().from("bills").select("*").eq("id", billId).single();
    if (error) throw error;
    const bill = normalizeBill(data);
    const shop = await readShopRow();
    const filename = pdfName(bill);
    const to = waNumber(bill.phone);

    // 1) Upload the PDF to WhatsApp's media store (kept by Meta, not by us).
    const upload = new FormData();
    upload.append("messaging_product", "whatsapp");
    upload.append("type", "application/pdf");
    upload.append("file", file, filename);
    const media = await graph(`${phoneId}/media`, { method: "POST", body: upload });

    // 2) Send it.
    const caption = `Invoice #${bill.invoice_no} — ${money(bill.total)}${shop.name ? ` — ${shop.name}` : ""}`;
    const message = template
      ? {
          // Business-initiated message: needs an approved template whose HEADER is a document.
          // If the template body has variables, they are: {{1}} customer, {{2}} invoice no, {{3}} total.
          type: "template",
          template: {
            name: template,
            language: { code: lang },
            components: [
              { type: "header", parameters: [{ type: "document", document: { id: media.id, filename } }] },
              ...(process.env.WHATSAPP_TEMPLATE_BODY_PARAMS === "false" ? [] : [{
                type: "body",
                parameters: [
                  { type: "text", text: bill.name },
                  { type: "text", text: String(bill.invoice_no) },
                  { type: "text", text: money(bill.total) },
                ],
              }]),
            ],
          },
        }
      : {
          // Plain document: only delivered if the customer messaged you in the last 24 hours.
          type: "document",
          document: { id: media.id, filename, caption },
        };

    const sent = await graph(`${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...message }),
    });
    return Response.json({ ok: true, to, messageId: sent?.messages?.[0]?.id ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}
