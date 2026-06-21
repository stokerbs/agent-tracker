"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CaseMessageWithSender } from "@/lib/types";

const TYPING_TIMEOUT_MS = 3500;
const TYPING_THROTTLE_MS = 1500;
export const MESSAGE_PAGE_SIZE = 50;

const SELECT = "*, profiles(id, full_name, role)";

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
 * Scalability: the initial window is the most recent MESSAGE_PAGE_SIZE messages
 * (bounded server-side). On a realtime INSERT we fetch ONLY the new rows since
 * the latest we hold and append them — not the whole thread — so per-message
 * cost is O(new) rather than O(all). Older history loads on demand via loadOlder.
 *
 * Also broadcasts/receives ephemeral "typing" events on the same channel, and
 * auto-scrolls + marks read when a new inbound message lands.
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
  const [hasMore, setHasMore] = useState(initialMessages.length >= MESSAGE_PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentAt = useRef(0);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror of messages for use inside stable callbacks/subscriptions.
  const messagesRef = useRef(initialMessages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Re-sync when the server re-renders (e.g. after a server action + refresh).
  useEffect(() => {
    setMessages(initialMessages);
    setHasMore(initialMessages.length >= MESSAGE_PAGE_SIZE);
  }, [initialMessages]);

  // Mark read + scroll on first mount.
  useEffect(() => {
    void markRead(caseId);
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  function mergeAppend(prev: CaseMessageWithSender[], incoming: CaseMessageWithSender[]) {
    const seen = new Set(prev.map((m) => m.id));
    const added = incoming.filter((m) => !seen.has(m.id));
    return added.length ? [...prev, ...added] : prev;
  }

  useEffect(() => {
    // Fetch only messages newer than the latest we already hold, then append.
    async function appendNew() {
      const current = messagesRef.current;
      const latest = current[current.length - 1]?.created_at;
      let q = supabase
        .from("case_messages")
        .select(SELECT)
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      // gte + id-dedupe is robust against identical-timestamp rows.
      if (latest) q = q.gte("created_at", latest);
      const { data } = await q;
      const incoming = (data ?? []) as CaseMessageWithSender[];
      if (incoming.length === 0) return;

      const known = new Set(current.map((m) => m.id));
      const trulyNew = incoming.filter((m) => !known.has(m.id));
      if (trulyNew.length === 0) return;

      setMessages((prev) => mergeAppend(prev, trulyNew));

      const newest = trulyNew[trulyNew.length - 1];
      if (newest && newest.sender_id !== currentProfileId) {
        void markRead(caseId);
        requestAnimationFrame(() =>
          bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        );
      }
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
        () => appendNew(),
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

  // Load the previous page of older messages and prepend.
  const loadOlder = useCallback(async () => {
    if (loadingOlder) return;
    const current = messagesRef.current;
    const earliest = current[0]?.created_at;
    if (!earliest) return;
    setLoadingOlder(true);
    try {
      const { data } = await supabase
        .from("case_messages")
        .select(SELECT)
        .eq("case_id", caseId)
        .lt("created_at", earliest)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);
      const older = ((data ?? []) as CaseMessageWithSender[]).reverse(); // ascending
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = older.filter((m) => !seen.has(m.id));
        return add.length ? [...add, ...prev] : prev;
      });
      setHasMore(older.length >= MESSAGE_PAGE_SIZE);
    } finally {
      setLoadingOlder(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, loadingOlder]);

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

  return { messages, typingName, notifyTyping, bottomRef, scrollToBottom, hasMore, loadOlder, loadingOlder };
}
