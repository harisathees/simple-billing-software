import "server-only";
import type { Shop } from "@/lib/types";
import { supabase } from "./supabase";

type ShopRow = Omit<Shop, "logo_url"> & { logo_path: string | null; updated_at?: string };

export async function readShopRow(): Promise<ShopRow> {
  const { data, error } = await supabase().from("shop_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return (data ?? {
    name: "", slogan: "", address: "", phone: "", email: "", website: "", terms: "", logo_path: null,
  }) as ShopRow;
}

/** The logo is served through our own /api/shop/logo route (same origin), so the
 *  PDF renderer can draw it without cross-origin issues. `v` busts the browser cache. */
export function toShop(row: ShopRow): Shop {
  const { logo_path, ...rest } = row;
  return {
    name: rest.name ?? "", slogan: rest.slogan ?? "", address: rest.address ?? "",
    phone: rest.phone ?? "", email: rest.email ?? "", website: rest.website ?? "", terms: rest.terms ?? "",
    logo_url: logo_path ? `/api/shop/logo?v=${encodeURIComponent(logo_path)}` : null,
  };
}
