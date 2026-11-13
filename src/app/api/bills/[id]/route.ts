import { requireUser } from "@/lib/server/auth";
import { BadRequest, errorResponse, supabase } from "@/lib/server/supabase";
import { BILL_COLUMNS, normalizeBill, parseBill } from "@/lib/server/validate";

function billId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new BadRequest("Invalid bill id.");
  return id;
}

// PUT /api/bills/:id — update a bill
export async function PUT(req: Request, ctx: RouteContext<"/api/bills/[id]">) {
  try {
    await requireUser();
    const id = billId((await ctx.params).id);
    const bill = parseBill(await req.json());
    const { data, error } = await supabase()
      .from("bills")
      .update({ ...bill, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(BILL_COLUMNS)
      .single();
    if (error) throw error;
    return Response.json(normalizeBill(data as Record<string, unknown>));
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/bills/:id
export async function DELETE(_req: Request, ctx: RouteContext<"/api/bills/[id]">) {
  try {
    await requireUser();
    const id = billId((await ctx.params).id);
    const { error } = await supabase().from("bills").delete().eq("id", id);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
