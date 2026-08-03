import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/line/reply", () => ({ replyLineMessage: vi.fn() }));

import { handleIntelCommand } from "./intel";
import { createServiceClient } from "@/lib/supabase/server";
import { replyLineMessage } from "@/lib/line/reply";
import * as msg from "@/lib/line/messages";

const AGENT_ID = "22222222-2222-2222-2222-222222222222";

afterEach(() => {
  vi.clearAllMocks();
});

describe("handleIntelCommand (Round 4 — stub wiring only)", () => {
  it("replies with the placeholder stub message for a normal case-number arg", async () => {
    await handleIntelCommand(AGENT_ID, "CASE-2026-0042", "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.INTEL_COMMAND_STUB);
    expect(replyLineMessage).toHaveBeenCalledTimes(1);
  });

  it("replies with the same placeholder stub message for empty/whitespace-only args", async () => {
    await handleIntelCommand(AGENT_ID, "   ", "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.INTEL_COMMAND_STUB);
    expect(replyLineMessage).toHaveBeenCalledTimes(1);
  });

  it("never touches the database — no Supabase client is ever created", async () => {
    await handleIntelCommand(AGENT_ID, "CASE-2026-0042", "rt1");
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});
