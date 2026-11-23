import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { resolveRequestStepUpAccess } from "@/lib/auth-step-up";

export const runtime = "nodejs";

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const BUCKET = "jlpt-support-attachments";

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function identifyImage(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  if (!validUuid(messageId)) return json(400, { error: "support.attachmentError" });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_ATTACHMENT_BYTES + 65_536) return json(413, { error: "support.attachmentTooLarge" });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return json(503, { error: "support.attachmentUnavailable" });
  const storageAdmin = createSupabaseServiceClient();
  if (!storageAdmin) return json(503, { error: "support.attachmentUnavailable" });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json(401, { error: "support.signInRequired" });
  const stepUp = await resolveRequestStepUpAccess(supabase);
  if (stepUp === "required") return json(428, { error: "auth.stepUpRequired" });
  if (stepUp === "unavailable") return json(503, { error: "auth.stepUpUnavailable" });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return json(400, { error: "support.attachmentError" }); }
  const file = form.get("attachment");
  if (!(file instanceof File) || file.size < 1) return json(400, { error: "support.attachmentError" });
  if (file.size > MAX_ATTACHMENT_BYTES) return json(413, { error: "support.attachmentTooLarge" });

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = identifyImage(bytes);
  if (!mime || file.type !== mime) return json(400, { error: "support.attachmentTypeError" });

  let sanitized: Buffer;
  try {
    const imageOptions = { failOn: "warning" as const, limitInputPixels: 16_000_000 };
    const metadata = await sharp(bytes, imageOptions).metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1 || metadata.width * metadata.height > 16_000_000) {
      return json(400, { error: "support.attachmentError" });
    }
    sanitized = await sharp(bytes, imageOptions)
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  } catch {
    return json(400, { error: "support.attachmentError" });
  }
  if (sanitized.byteLength > MAX_ATTACHMENT_BYTES) return json(413, { error: "support.attachmentTooLarge" });

  const { data: reservationData, error: reservationError } = await supabase.rpc("begin_support_attachment_upload", {
    p_message_id: messageId,
    p_file_bytes: file.size,
    p_media_type: mime,
  });
  const reservation = reservationData as { id?: unknown; storage_path?: unknown; attached?: unknown } | null;
  if (reservationError || typeof reservation?.id !== "string" || typeof reservation.storage_path !== "string") {
    return json(409, { error: "support.attachmentError" });
  }
  if (reservation.attached === true) return json(200, { attached: true, alreadyAttached: true });

  const { error: uploadError } = await storageAdmin.storage.from(BUCKET).upload(reservation.storage_path, sanitized, {
    cacheControl: "300",
    contentType: "image/webp",
    upsert: true,
  });
  if (uploadError) {
    await storageAdmin.storage.from(BUCKET).remove([reservation.storage_path]);
    await supabase.rpc("clear_support_attachment_upload", { p_attachment_id: reservation.id });
    return json(503, { error: "support.attachmentError" });
  }

  const { error: completeError } = await supabase.rpc("complete_support_attachment_upload", {
    p_attachment_id: reservation.id,
    p_stored_bytes: sanitized.byteLength,
  });
  if (completeError) {
    await storageAdmin.storage.from(BUCKET).remove([reservation.storage_path]);
    await supabase.rpc("clear_support_attachment_upload", { p_attachment_id: reservation.id });
    return json(409, { error: "support.attachmentError" });
  }

  return json(201, { attached: true });
}

export async function GET(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  if (!validUuid(messageId)) return json(404, { error: "support.attachmentUnavailable" });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return json(503, { error: "support.attachmentUnavailable" });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json(401, { error: "support.signInRequired" });
  const stepUp = await resolveRequestStepUpAccess(supabase);
  if (stepUp === "required") return json(428, { error: "auth.stepUpRequired" });
  if (stepUp === "unavailable") return json(503, { error: "auth.stepUpUnavailable" });

  const { data: storagePath, error: pathError } = await supabase.rpc("get_support_attachment_storage_path", { p_message_id: messageId });
  if (pathError || typeof storagePath !== "string") return json(404, { error: "support.attachmentUnavailable" });
  const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300);
  if (signError || !data?.signedUrl) return json(404, { error: "support.attachmentUnavailable" });

  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
