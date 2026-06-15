"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadEvidence } from "@/app/(dashboard)/evidence/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EvidenceUploader({ caseId }: { caseId: string }) {
  const [pending, start] = useTransition();
  const [fileName, setFileName] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function onSubmit(formData: FormData) {
    start(async () => {
      const res = await uploadEvidence(formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("Evidence uploaded");
      formRef.current?.reset();
      setFileName("");
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="space-y-3 rounded-lg border bg-card p-4"
    >
      <input type="hidden" name="case_id" value={caseId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="file">File (JPEG, PNG, WebP or PDF)</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" placeholder="Photo / Vehicle / Document" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" placeholder="Context for this evidence…" />
      </div>
      <div className="flex items-center justify-between">
        <span className="truncate text-xs text-muted-foreground">{fileName}</span>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload
        </Button>
      </div>
    </form>
  );
}
