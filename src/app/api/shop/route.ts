import { connection } from "next/server";
import { errorResponse, supabase } from "@/lib/server/supabase";
import { readShopRow, toShop } from "@/lib/server/shop";
import { parseShop } from "@/lib/server/validate";

// GET /api/shop — shop details shown in the header and on every invoice
export async function GET() {
  await connection();
  try {
    return Response.json(toShop(await readShopRow()));
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT /api/shop — save shop details (the logo has its own route)
export async function PUT(req: Request) {
  try {
    const shop = parseShop(await req.json());
    const { data, error } = await supabase()
      .from("shop_settings")
      .upsert({ id: 1, ...shop, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return Response.json(toShop(data));
  } catch (err) {
    return errorResponse(err);
  }
}
