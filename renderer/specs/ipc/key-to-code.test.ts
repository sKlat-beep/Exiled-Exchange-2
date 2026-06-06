import { describe, expect, it } from "vitest";
import {
  hotkeyToString,
  mergeTwoHotkeys,
  normalizeHotkey,
  normalizeKeyName,
} from "@ipc/KeyToCode";

describe("hotkey normalization", () => {
  it("normalizes legacy tilde names to Backquote", () => {
    expect(normalizeKeyName("Tilde")).toBe("Backquote");
    expect(normalizeKeyName("Grave")).toBe("Backquote");
    expect(normalizeKeyName("`")).toBe("Backquote");
    expect(normalizeHotkey("Shift + Tilde")).toMatchObject({
      isValid: true,
      value: "Shift + Backquote",
      accelerator: "Shift+`",
    });
  });

  it("keeps valid hotkeys canonical", () => {
    expect(hotkeyToString(["Backquote"], false, true, false)).toBe(
      "Shift + Backquote",
    );
    expect(mergeTwoHotkeys("Ctrl + C", "Alt")).toBe("Ctrl + Alt + C");
  });

  it("rejects unknown keys and missing non-modifier keys", () => {
    expect(normalizeHotkey("Shift + UnknownKey")).toMatchObject({
      isValid: false,
    });
    expect(normalizeHotkey("Shift +")).toMatchObject({
      isValid: false,
    });
    expect(normalizeHotkey("Shift")).toMatchObject({
      isValid: false,
    });
  });
});
