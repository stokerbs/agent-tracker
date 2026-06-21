"use client";

import { useRef, useTransition } from "react";
import { MessageSquare, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { sendClientMessage, markClientMessagesRead } from "@/app/(portal)/portal/cases/[id]/message-actions";
import { useCaseMessages } from "@/components/messages/use-case-messages";
import { TypingIndicator } from "@/components/messages/typing-indicator";
import type { CaseMessageWithSender } from "@/lib/types";

interface Props {
  caseId: string;
  messages: CaseMessageWithSender[];
  currentProfileId: string;
  currentUserName: string;
}

export function PortalMessagesClient({ caseId, messages: initialMessages, currentProfileId, currentUserName }: Props) {
  const t = useTranslations("messages");
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const { messages, typingName, notifyTyping, bottomRef, scrollToBottom, hasMore, loadOlder, loadingOlder } = useCaseMessages({
    caseId,
    initialMessages,
    currentProfileId,
    currentUserName,
    markRead: markClientMessagesRead,
  });

  function handleSubmit(formData: FormData) {
    start(async () => {
      await sendClientMessage(formData);
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
          title={t("portal.noMessages")}
          description={t("portal.noMessagesDescription")}
        />
      ) : (
        <div className="space-y-3 px-1">
          {hasMore && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                disabled={loadingOlder}
                onClick={loadOlder}
              >
                {loadingOlder ? t("loadingOlder") : t("loadOlder")}
              </Button>
            </div>
          )}
          {messages.map((msg) => {
            const isMine = msg.sender_id === currentProfileId;
            const isStaffMsg = msg.profiles?.role !== "client";

            return (
              <div
                key={msg.id}
                className={cn("flex flex-col gap-0.5", isMine ? "items-end" : "items-start")}
              >
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] text-muted-foreground">
                    {isMine ? t("you") : isStaffMsg ? t("portal.supportTeam") : (msg.profiles?.full_name ?? "Unknown")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{fmtTime(msg.created_at)}</span>
                </div>
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    isMine
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

      {/* Staff identity is hidden on the portal — show a generic label. */}
      <TypingIndicator name={typingName ? t("portal.supportTeam") : null} />

      {/* Reply */}
      <Card className="p-3">
        <form ref={formRef} action={handleSubmit} className="flex gap-2">
          <input type="hidden" name="case_id" value={caseId} />
          <textarea
            name="body"
            rows={2}
            maxLength={2000}
            onChange={notifyTyping}
            placeholder={t("portal.replyPlaceholder")}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            required
          />
          <Button type="submit" size="sm" className="self-end" disabled={pending}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
