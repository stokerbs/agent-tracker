import { describe, it, expect } from "vitest";
import { findBannedPhrases } from "./compliance";

describe("findBannedPhrases", () => {
  it("flags unlawful-access phrases and passes lawful copy", () => {
    expect(findBannedPhrases("我们可以提供开房记录和手机定位")).toEqual(["开房记录", "手机定位"]);
    expect(findBannedPhrases("我们通过公开登记与实地走访核实事实")).toEqual([]);
  });

  it("allows refusals that name the forbidden data", () => {
    expect(findBannedPhrases("我们不提供开房记录")).toEqual([]);
    expect(findBannedPhrases("任何机构都无法获取通话记录")).toEqual([]);
    expect(findBannedPhrases("我们不提供开房记录，也无法获取通话记录。任何合法机构都不能查询银行流水。")).toEqual([]);
    expect(findBannedPhrases("泰国法律禁止手机定位他人")).toEqual([]);
  });

  it("does not let a negation in one clause excuse an offer in the next", () => {
    expect(findBannedPhrases("我们不提供开房记录。但我们提供手机定位")).toEqual(["手机定位"]);
    expect(findBannedPhrases("我们不提供手机定位，但可以查开房记录")).toEqual(["开房记录"]);
    expect(findBannedPhrases("不用担心，我们提供开房记录")).toEqual(["开房记录"]);
    expect(findBannedPhrases("我们通过非法手段获取开房记录")).toEqual(["开房记录"]);
  });

  it("catches traditional-script variants (mapped to simplified) and honours their refusals", () => {
    expect(findBannedPhrases("我們可以提供開房記錄")).toEqual(["开房记录"]);
    expect(findBannedPhrases("提供通話記錄與銀行流水")).toEqual(["通话记录", "银行流水"]);
    expect(findBannedPhrases("我們不提供開房記錄")).toEqual([]);
  });

  it("catches spaced / punctuated spellings", () => {
    expect(findBannedPhrases("开 房 · 记录可以查")).toEqual(["开房记录"]);
    expect(findBannedPhrases("开房、记录")).toEqual(["开房记录"]);
  });
});
