import { describe, it, expect } from "vitest";
import { findBannedPhrases } from "./compliance";

describe("findBannedPhrases", () => {
  it("flags unlawful-access phrases and passes lawful copy", () => {
    expect(findBannedPhrases("我们可以提供开房记录和手机定位")).toEqual(["开房记录", "手机定位"]);
    expect(findBannedPhrases("我们通过公开登记与实地走访核实事实")).toEqual([]);
  });
});
