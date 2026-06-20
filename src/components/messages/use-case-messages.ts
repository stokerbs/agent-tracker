"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CaseMessageWithSender } from "@/lib/types";

const TYPING_TIMEOUT_MS = 3500;
const TYPING_THROTTLE_MS = 1500;

interface Options {
  caseId: string;
  initialMessages: CaseMessageWithSender[];
  currentProfileId: string;
  currentUserName: string;
  markRead: (caseId: string) => Promise<void> | void;
}

interface TypingPayload {
  profileId: string;
  name: string;
}

/**
 * Live case-message thread.
 *
 * - Subscribes to INSERTs on case_messages for this case and re-fetches the
 *   thread (RLS keeps clients from ever receiving internal notes).
 * - Broadcasts/receives ephemeral "typing" events on the same channel.
 * - Auto-scrolls and marks the thread read when a new inbound message lands.
 *
 * Matches the codebase realtime convention (see emergency-feed.tsx):
 * channel -> postgres_changes -> re-fetch.
 */
export function useCaseMessages({
  caseId,
  initialMessages,
  currentProfileId,
  currentUserName,
  markRead,
}: Options) {
  const supabase = createClient();
  const [messages, setMessages] = useState<CaseMessageWithSender[]>(initialMessages);
  const [typingName, setTypingName] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentAt = useRef(0);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownCount = useRef(initialMessages.length);

  // Re-sync when the server re-renders (e.g. after a server action + refresh).
  useEffect(() => {
    setMessages(initialMessages);
    knownCount.current = initialMessages.length;
  }, [initialMessages]);

  // Mark read + scroll on first mount.
  useEffect(() => {
    void markRead(caseId);
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    async function reload() {
      const { data } = await supabase
        .from("case_messages")
        .select("*, profiles(id, full_name, role)")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });

      const fresh = (data ?? []) as CaseMessageWithSender[];
      setMessages(fresh);

      // New inbound message while the thread is open: scroll + mark read.
      if (fresh.length > knownCount.current) {
        const newest = fresh[fresh.length - 1];
        if (newest && newest.sender_id !== currentProfileId) {
          void markRead(caseId);
          requestAnimationFrame(() =>
            bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
          );
        }
      }
      knownCount.current = fresh.length;
    }

    const channel = supabase
      .channel(`case-messages:${caseId}`, {
        config: { broadcast: { self: false } },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "case_messages",
          filter: `case_id=eq.${caseId}`,
        },
        () => reload(),
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as TypingPayload;
        if (!p || p.profileId === currentProfileId) return;
        setTypingName(p.name);
        if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
        typingClearTimer.current = setTimeout(() => setTypingName(null), TYPING_TIMEOUT_MS);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, currentProfileId]);

  // Throttled "I am typing" broadcast.
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentAt.current < TYPING_THROTTLE_MS) return;
    lastTypingSentAt.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { profileId: currentProfileId, name: currentUserName } satisfies TypingPayload,
    });
  }, [currentProfileId, currentUserName]);

  // After the local user sends, jump to the bottom.
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
    );
  }, []);

  return { messages, typingName, notifyTyping, bottomRef, scrollToBottom };
}
