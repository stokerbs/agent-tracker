import { describe, expect, it } from "vitest";
import {
  ASSISTANT_LAUNCHER_DELAY_MS,
  DESKTOP_MIN_WIDTH,
  exitIntentMode,
  isDesktop,
  isExitMouseOut,
  shouldAutoOpenFab,
  shouldShowAssistantLauncher,
} from "./overlay-policy";

describe("overlay policy", () => {
  it("desktop threshold matches Tailwind lg (1024)", () => {
    expect(DESKTOP_MIN_WIDTH).toBe(1024);
    expect(isDesktop(1024)).toBe(true);
    expect(isDesktop(1023)).toBe(false);
    expect(isDesktop(NaN)).toBe(false);
    expect(isDesktop(0)).toBe(false);
  });

  it("contact FAB auto-opens only on desktop and only once per session", () => {
    expect(shouldAutoOpenFab({ viewportWidth: 1440, alreadyShown: false })).toBe(true);
    expect(shouldAutoOpenFab({ viewportWidth: 1440, alreadyShown: true })).toBe(false);
    expect(shouldAutoOpenFab({ viewportWidth: 390, alreadyShown: false })).toBe(false);
    expect(shouldAutoOpenFab({ viewportWidth: 768, alreadyShown: false })).toBe(false);
  });

  it("exit-intent is mouse-only on desktop; never a timer on mobile", () => {
    expect(exitIntentMode({ viewportWidth: 1440, finePointer: true, alreadyShown: false })).toBe("mouse");
    expect(exitIntentMode({ viewportWidth: 1440, finePointer: true, alreadyShown: true })).toBe("off");
    // Touch laptop / tablet in landscape: wide but coarse pointer → off.
    expect(exitIntentMode({ viewportWidth: 1280, finePointer: false, alreadyShown: false })).toBe("off");
    expect(exitIntentMode({ viewportWidth: 390, finePointer: false, alreadyShown: false })).toBe("off");
    expect(exitIntentMode({ viewportWidth: 390, finePointer: true, alreadyShown: false })).toBe("off");
  });

  it("recognises a mouse-out toward the browser chrome", () => {
    expect(isExitMouseOut({ clientY: 0, relatedTarget: null })).toBe(true);
    expect(isExitMouseOut({ clientY: -5, relatedTarget: null })).toBe(true);
    expect(isExitMouseOut({ clientY: 10, relatedTarget: null })).toBe(false);
    expect(isExitMouseOut({ clientY: 0, relatedTarget: {} })).toBe(false);
  });

  it("assistant launcher waits for interaction or the grace period", () => {
    expect(shouldShowAssistantLauncher({ interacted: false, elapsedMs: 0 })).toBe(false);
    expect(shouldShowAssistantLauncher({ interacted: true, elapsedMs: 0 })).toBe(true);
    expect(shouldShowAssistantLauncher({ interacted: false, elapsedMs: ASSISTANT_LAUNCHER_DELAY_MS - 1 })).toBe(false);
    expect(shouldShowAssistantLauncher({ interacted: false, elapsedMs: ASSISTANT_LAUNCHER_DELAY_MS })).toBe(true);
    expect(ASSISTANT_LAUNCHER_DELAY_MS).toBe(6000);
  });
});
