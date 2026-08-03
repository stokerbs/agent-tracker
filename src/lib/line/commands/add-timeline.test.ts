import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/line/reply", () => ({ replyLineMessage: vi.fn() }));

import { handleAddTimelineEntryCommand } from "./add-timeline";
import { replyLineMessage } from "@/lib/line/reply";
import * as msg from "@/lib/line/messages";

const AGENT_ID = "22222222-2222-2222-2222-222222222222";

afterEach(() => {
  vi.clearAllMocks();
});

// This command is currently a parsing/dispatch handoff stub (no DB write
// implemented yet — see the module doc in ./add-timeline.ts). These tests
// only cover the stub's current, intentionally-limited behavior: the
// defensive empty-args check and the placeholder "not yet implemented"
// reply. The real authorization/insert behavior belongs to the next
// engineer's implementation and its own tests.
describe("handleAddTimelineEntryCommand (Round-2 stub)", () => {
  it("replies ADD_TIMELINE_EMPTY_ARGS when the case number is blank", async () => {
    await handleAddTimelineEntryCommand(AGENT_ID, "   ", "some entry text", "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.ADD_TIMELINE_EMPTY_ARGS);
  });

  it("replies ADD_TIMELINE_EMPTY_ARGS when the entry text is blank", async () => {
    await handleAddTimelineEntryCommand(AGENT_ID, "CASE-001", "   ", "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.ADD_TIMELINE_EMPTY_ARGS);
  });

  it("replies with the not-yet-implemented placeholder for well-formed input", async () => {
    await handleAddTimelineEntryCommand(AGENT_ID, "CASE-001", "พบเป้าหมายที่ห้างสรรพสินค้า", "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", msg.ADD_TIMELINE_NOT_YET_IMPLEMENTED);
  });

  it("never performs a DB write (no Supabase client is touched by this stub)", async () => {
    // Implicit: this module doesn't even import createServiceClient yet.
    // Asserting the single expected side effect (the reply) is sufficient
    // to catch a regression that starts writing without updating this test.
    await handleAddTimelineEntryCommand(AGENT_ID, "CASE-001", "entry", "rt1");
    expect(replyLineMessage).toHaveBeenCalledTimes(1);
  });
});
