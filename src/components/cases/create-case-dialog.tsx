"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCase } from "@/app/(dashboard)/cases/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CASE_PRIORITY_META, CASE_STATUS_META } from "@/lib/constants";

export function CreateCaseDialog({ suggestedNumber }: { suggestedNumber: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    start(async () => {
      const res = await createCase(formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("Case created");
      setOpen(false);
      router.refresh();
      if (res?.id) router.push(`/cases/${res.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New Case
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Open a new case</DialogTitle>
          <DialogDescription>
            Record the client, target and surveillance parameters.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Case Number" name="case_number" defaultValue={suggestedNumber} required />
          <Field label="Client Name" name="client_name" placeholder="Eleanor Vance" />
          <Field label="Case Type" name="case_type" placeholder="Infidelity / Insurance / Background" />
          <Field label="Target Name" name="target_name" placeholder="Daniel West" />
          <Field label="Target Phone" name="target_phone" type="tel" />
          <Field label="Target Vehicle" name="target_vehicle" placeholder="Black BMW 5 Series" />
          <Field label="License Plate" name="license_plate" placeholder="NY-8841 XR" />
          <Field label="Target Address" name="target_address" placeholder="88 Riverside Dr" />
          <Field label="Start Date" name="start_date" type="date" />
          <Field label="End Date" name="end_date" type="date" />

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue="new">
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CASE_STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select name="priority" defaultValue="medium">
              <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CASE_PRIORITY_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="Surveillance objectives, schedule, special notes…" />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create case
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
