import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing storage path" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.storage.from("medical-files").createSignedUrl(path, 3600);

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to create signed URL" }, { status: 404 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
