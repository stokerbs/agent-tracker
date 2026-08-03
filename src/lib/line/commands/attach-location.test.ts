import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/line/reply", () => ({ replyLineMessage: vi.fn() }));

import { handleAttachLocationCommand } from "./attach-location";
import { replyLineMessage } from "@/lib/line/reply";
import { ATTACH_LOCATION_STUB } from "@/lib/line/messages";

const AGENT_ID = "22222222-2222-2222-2222-222222222222";
const CASE_ID = "case-1";
const ENTRY_ID = "entry-1";

afterEach(() => vi.clearAllMocks());

describe("handleAttachLocationCommand (Round 3 stub)", () => {
  it("replies with the ATTACH_LOCATION_STUB placeholder", async () => {
    await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, 13.75, 100.5, "123 Main St", "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", ATTACH_LOCATION_STUB);
    expect(replyLineMessage).toHaveBeenCalledTimes(1);
  });

  it("replies with the same placeholder when address is null", async () => {
    await handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, 13.75, 100.5, null, "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", ATTACH_LOCATION_STUB);
  });

  it("does not throw regardless of input shape", async () => {
    await expect(
      handleAttachLocationCommand(AGENT_ID, CASE_ID, ENTRY_ID, 13.75, 100.5, null, "rt1"),
    ).resolves.toBeUndefined();
  });
});
