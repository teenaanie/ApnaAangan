import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const base = siteUrl() || new URL(request.url).origin;
  return NextResponse.redirect(`${base}/`, { status: 303 });
}
