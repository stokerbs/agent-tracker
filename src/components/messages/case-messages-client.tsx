"use client";

import { useRef, useTransition } from "react";
import { Lock, MessageSquare, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { sendMessage, markMessagesRead } from "@/app/(dashboard)/cases/[id]/message-actions";
import { useCaseMessages } from "@/components/messages/use-case-messages";
import { TypingIndicator } from "@/components/messages/typing-indicator";
import type { CaseMessageWithSender } from "@/lib/types";

interface Props {
  caseId: string;
  messages: CaseMessageWithSender[];
  currentProfileId: string;
  currentUserName: string;
}

export function CaseMessagesClient({ caseId, messages: initialMessages, currentProfileId, currentUserName }: Props) {
  const t = useTranslations("messages");
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const { messages, typingName, notifyTyping, bottomRef, scrollToBottom } = useCaseMessages({
    caseId,
    initialMessages,
    currentProfileId,
    currentUserName,
    markRead: markMessagesRead,
  });

  function handleSubmit(formData: FormData) {
    start(async () => {
      await sendMessage(formData);
      formRef.current?.reset();
      scrollToBottom();
    });
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Bangkok",
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Thread */}
      {messages.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title={t("noMessages")}
          description={t("noMessagesDescription")}
        />
      ) : (
        <div className="space-y-3 px-1">
          {messages.map((msg) => {
            const isMine = msg.sender_id === currentProfileId;
            const isClient = msg.profiles?.role === "client";
            const senderName = msg.profiles?.full_name ?? "Unknown";

            return (
              <div
                key={msg.id}
                className={cn("flex flex-col gap-0.5", isMine ? "items-end" : "items-start")}
              >
                {/* Meta row */}
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] text-muted-foreground">
                    {isMine ? t("you") : senderName}
                  </span>
                  {isClient && (
                    <Badge variant="outline" className="h-3.5 px-1 py-0 text-[9px] leading-none">
                      {t("clientBadge")}
                    </Badge>
                  )}
                  {msg.is_internal && (
                    <span className="flex items-center gap-0.5 text-[9px] text-amber-600 dark:text-amber-400">
                      <Lock className="h-2.5 w-2.5" />
                      {t("internal")}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{fmtTime(msg.created_at)}</span>
                </div>

                {/* Bubble */}
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    msg.is_internal
                      ? "rounded-tl-sm border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                      : isMine
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-muted text-foreground",
                  )}
                >
                  {msg.body}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      <TypingIndicator name={typingName} />

      {/* Compose */}
      <Card className="p-3">
        <form ref={formRef} action={handleSubmit} className="space-y-2">
          <input type="hidden" name="case_id" value={caseId} />
          <textarea
            name="body"
            rows={3}
            maxLength={2000}
            onChange={notifyTyping}
            placeholder={t("composePlaceholder")}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            required
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                name="is_internal"
                value="true"
                className="h-3.5 w-3.5 accent-amber-500"
              />
              <Lock className="h-3 w-3 text-amber-500" />
              {t("internalToggle")}
            </label>
            <Button type="submit" size="sm" disabled={pending}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {t("send")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
