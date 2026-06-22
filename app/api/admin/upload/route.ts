import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const bucketName = "app-assets";

const allowedExtensions = new Set(["png", "jpg", "jpeg", "webp", "svg", "ico"]);
const allowedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const maxBytesByKind: Record<string, number> = {
  logo: 500 * 1024,
  favicon: 100 * 1024,
  icon192: 300 * 1024,
  icon512: 500 * 1024,
  splash: 1024 * 1024,
};

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, error: "Nao autenticado." },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase nao configurado." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") || "asset");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Arquivo nao enviado." },
      { status: 400 },
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const maxBytes = maxBytesByKind[kind] || 500 * 1024;

  if (!allowedExtensions.has(extension) || (file.type && !allowedTypes.has(file.type))) {
    return NextResponse.json(
      { ok: false, error: "Formato invalido. Envie PNG, JPG, WEBP, SVG ou ICO." },
      { status: 400 },
    );
  }

  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        ok: false,
        error: `Arquivo acima do limite de ${Math.round(maxBytes / 1024)} KB.`,
      },
      { status: 400 },
    );
  }

  const safeName = sanitizeFileName(file.name) || `asset.${extension}`;
  const path = `${kind}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(bucketName).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Nao foi possivel enviar o arquivo." },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);

  return NextResponse.json({
    ok: true,
    url: data.publicUrl,
    path,
  });
}
