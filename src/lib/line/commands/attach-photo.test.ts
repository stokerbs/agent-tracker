import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/line/reply", () => ({ replyLineMessage: vi.fn() }));

import { handleAttachPhotoCommand } from "./attach-photo";
import { replyLineMessage } from "@/lib/line/reply";
import { ATTACH_PHOTO_STUB } from "@/lib/line/messages";

const AGENT_ID = "22222222-2222-2222-2222-222222222222";
const CASE_ID = "case-1";
const ENTRY_ID = "entry-1";
const MESSAGE_ID = "line-message-id-1";

afterEach(() => vi.clearAllMocks());

describe("handleAttachPhotoCommand (Round 3 stub)", () => {
  it("replies with the ATTACH_PHOTO_STUB placeholder", async () => {
    await handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1");
    expect(replyLineMessage).toHaveBeenCalledWith("rt1", ATTACH_PHOTO_STUB);
    expect(replyLineMessage).toHaveBeenCalledTimes(1);
  });

  it("does not throw and only replies once regardless of input shape", async () => {
    await expect(
      handleAttachPhotoCommand(AGENT_ID, CASE_ID, ENTRY_ID, MESSAGE_ID, "rt1"),
    ).resolves.toBeUndefined();
    expect(replyLineMessage).toHaveBeenCalledTimes(1);
  });
});
