import { describe, expect, it } from "vitest";
import { normalizeConfigHotkeys } from "@/web/config-hotkeys";

describe("config hotkey migration", () => {
  it("normalizes stored tilde hotkeys without changing valid hotkeys", () => {
    const config = {
      overlayKey: "Shift + Tilde",
      commands: [{ hotkey: "Ctrl + Grave" }],
      widgets: [
        {
          wmType: "price-check",
          hotkey: "Tilde",
          hotkeyLocked: "Ctrl + Alt + D",
        },
        { wmType: "item-check", wikiKey: "Alt + Tilde" },
        { wmType: "library", logItemKey: "Shift + Grave" },
        { wmType: "delve-grid", toggleKey: "Ctrl + `" },
        {
          wmType: "stash-search",
          entries: [{ hotkey: "Shift + Tilde" }],
        },
        { wmType: "timer", toggleKey: "Alt + Tilde" },
        { wmType: "item-search", ocrGemsKey: "Ctrl + Grave" },
      ],
    };

    normalizeConfigHotkeys(config);

    expect(config.overlayKey).toBe("Shift + Backquote");
    expect(config.commands.at(0)?.hotkey).toBe("Ctrl + Backquote");
    expect(config.widgets.at(0)?.hotkey).toBe("Backquote");
    expect(config.widgets.at(0)?.hotkeyLocked).toBe("Ctrl + Alt + D");
    expect(config.widgets.at(1)?.wikiKey).toBe("Alt + Backquote");
    expect(config.widgets.at(2)?.logItemKey).toBe("Shift + Backquote");
    expect(config.widgets.at(3)?.toggleKey).toBe("Ctrl + Backquote");
    expect(config.widgets.at(4)?.entries?.at(0)?.hotkey).toBe(
      "Shift + Backquote",
    );
    expect(config.widgets.at(5)?.toggleKey).toBe("Alt + Backquote");
    expect(config.widgets.at(6)?.ocrGemsKey).toBe("Ctrl + Backquote");
  });
});
