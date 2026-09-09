"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STUDIO_MODELS } from "@/lib/studio/constants";
import { updateAiProvider } from "./actions";

type Provider = "anthropic" | "openai";

export function AiProviderForm({ initialProvider, initialModel }: { initialProvider: Provider; initialModel: string }) {
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [model, setModel] = useState(initialModel);
  const [pending, start] = useTransition();
  const modelMeta = STUDIO_MODELS.find((m) => m.id === model);

  function save() {
    start(async () => {
      try {
        const res = await updateAiProvider({ provider, model });
        if (res.ok) toast.success("บันทึกการตั้งค่า AI แล้ว");
        else toast.error(res.error);
      } catch {
        toast.error("ไม่มีสิทธิ์หรือเซสชันหมดอายุ");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as Provider)} disabled={pending}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
              <SelectItem value="openai">OpenAI — ยังไม่รองรับใน V1</SelectItem>
            </SelectContent>
          </Select>
          {provider === "openai" && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              OpenAI มีเฉพาะ interface — ทุกคำสั่ง AI จะตอบว่า &quot;ยังไม่ได้ติดตั้ง&quot; จนกว่าจะเปลี่ยนกลับเป็น Anthropic
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>โมเดล</Label>
          <Select value={model} onValueChange={setModel} disabled={pending || provider !== "anthropic"}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="เลือกโมเดล" />
            </SelectTrigger>
            <SelectContent>
              {STUDIO_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {modelMeta && <p className="text-xs text-muted-foreground">{modelMeta.hint}</p>}
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending} size="sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}
