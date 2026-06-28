import { NextResponse } from "next/server";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { reportError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS, INTAKE_STAGING_PREFIX, INTAKE_MAX_FILES } from "@/lib/constants";
import {
  FileValidationError,
  validateImageUpload,
  validateDocumentUpload,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/security/file-validation";
import { analyzeIntake, type IntakeFilePart } from "@/lib/ai/case-intake";
import type { IntakeStagedFile } from "@/lib/types";

// Multi-file + large-PDF Claude calls can run well past the default limit.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_TEXT_SIZE = 1024 * 1024; // 1 MB for text/plain

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "No files provided" }, { status: 400 });
  if (files.length > INTAKE_MAX_FILES) {
    return NextResponse.json({ error: `Too many files (max ${INTAKE_MAX_FILES})` }, { status: 400 });
  }

  // Validate every file up front so we never stage a bad upload.
  for (const file of files) {
    try {
      if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        await validateImageUpload(file);
      } else if (file.type === "application/pdf") {
        await validateDocumentUpload(file);
      } else if (file.type === "text/plain") {
        if (file.size > MAX_TEXT_SIZE) {
          return NextResponse.json({ error: `${file.name}: text file too large` }, { status: 400 });
        }
      } else {
        return NextResponse.json(
          { error: `${file.name}: unsupported type. Convert HEIC/DOCX/DOC to PDF or JPG first.` },
          { status: 400 },
        );
      }
    } catch (err) {
      if (err instanceof FileValidationError) {
        return NextResponse.json({ error: `${file.name}: ${err.message}` }, { status: 400 });
      }
      throw err;
    }
  }

  const supabase = await createClient();
  const intakeId = crypto.randomUUID();
  const staged: IntakeStagedFile[] = [];
  const parts: IntakeFilePart[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const path = `${INTAKE_STAGING_PREFIX}/${intakeId}/${crypto.randomUUID()}-${safeName(file.name)}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKETS.evidence)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (upErr) {
      return NextResponse.json({ error: "Upload failed — please try again" }, { status: 500 });
    }

    staged.push({ name: file.name, path, mime_type: file.type, size: file.size });
    parts.push(
      file.type === "text/plain"
        ? { name: file.name, mimeType: file.type, text: buffer.toString("utf-8") }
        : { name: file.name, mimeType: file.type, base64: buffer.toString("base64") },
    );
  }

  try {
    const extraction = await analyzeIntake(parts);
    return NextResponse.json({ intakeId, files: staged, extraction });
  } catch (err) {
    reportError(err, "intake:analyze");
    // Best-effort cleanup of staged files on AI failure.
    await supabase.storage.from(BUCKETS.evidence).remove(staged.map((s) => s.path));
    return NextResponse.json({ error: "AI analysis failed — please try again" }, { status: 502 });
  }
}
