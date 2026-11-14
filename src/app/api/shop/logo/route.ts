import { requireUser } from "@/lib/server/auth";
import { connection } from "next/server";
import { BadRequest, errorResponse, LOGO_BUCKET, supabase } from "@/lib/server/supabase";
import { readShopRow, toShop } from "@/lib/server/shop";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// GET /api/shop/logo — stream the logo from the Supabase bucket (same-origin for the PDF)
export async function GET() {
  await connection();
  try {
    await requireUser();
    const { logo_path } = await readShopRow();
    if (!logo_path) return new Response("No logo", { status: 404 });
    const { data, error } = await supabase().storage.from(LOGO_BUCKET).download(logo_path);
    if (error) throw error;
    return new Response(data, {
      headers: {
        "Content-Type": data.type || "image/png",
        // Logged-in users only, so never in shared/CDN caches. URL includes ?v=<path>,
        // so a new logo gets a new URL and the browser copy can be kept.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/shop/logo — upload a new logo (multipart field "file")
export async function POST(req: Request) {
  try {
    await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new BadRequest("No file uploaded.");
    const ext = TYPES[file.type];
    if (!ext) throw new BadRequest("Logo must be a PNG, JPG or WebP image.");
    if (file.size > MAX_BYTES) throw new BadRequest("Logo must be smaller than 2 MB.");

    const db = supabase();
    const path = `logo/${Date.now()}.${ext}`;

    const up = await db.storage.from(LOGO_BUCKET).upload(path, file, { contentType: file.type });
    if (up.error) throw up.error;

    const { data, error } = await db
      .from("shop_settings")
      .upsert({ id: 1, logo_path: path, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) {
      await db.storage.from(LOGO_BUCKET).remove([path]);
      throw error;
    }
    // Soft delete: the previous logo file is kept in the bucket (never erased).
    return Response.json(toShop(data));
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/shop/logo — stop using the logo (the file itself is kept)
export async function DELETE() {
  try {
    await requireUser();
    const db = supabase();
    const { data, error } = await db
      .from("shop_settings")
      .upsert({ id: 1, logo_path: null, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    // Soft delete: only unlinked from the shop; the file stays in the bucket.
    return Response.json(toShop(data));
  } catch (err) {
    return errorResponse(err);
  }
}
