import { normalizeHotkey, normalizeKeyName } from "@ipc/KeyToCode";

type HotkeyConfig = {
  overlayKey: string;
  commands?: Array<{ hotkey: string | null }>;
  widgets: Array<Record<string, any>>;
};

export function normalizeConfigHotkeys(config: HotkeyConfig) {
  const fullHotkeyFields = [
    "hotkeyLocked",
    "wikiKey",
    "poedbKey",
    "craftOfExileKey",
    "stashSearchKey",
    "samePricedKey",
    "logItemKey",
    "toggleKey",
    "resetKey",
    "ocrGemsKey",
  ];

  const normalizeFullHotkey = (value: unknown) => {
    if (typeof value !== "string") return value;
    const normalized = normalizeHotkey(value);
    return normalized.isValid ? normalized.value : value;
  };

  const normalizeSingleKey = (value: unknown) => {
    if (typeof value !== "string") return value;
    return normalizeKeyName(value);
  };

  config.overlayKey = normalizeFullHotkey(config.overlayKey) as string;

  for (const command of config.commands ?? []) {
    command.hotkey = normalizeFullHotkey(command.hotkey) as string | null;
  }

  for (const widget of config.widgets) {
    if (widget.wmType === "price-check") {
      widget.hotkey = normalizeSingleKey(widget.hotkey) as string | null;
      widget.hotkeyLocked = normalizeFullHotkey(widget.hotkeyLocked) as
        | string
        | null;
    }

    for (const field of fullHotkeyFields) {
      if (field in widget) {
        widget[field] = normalizeFullHotkey(widget[field]);
      }
    }

    if (widget.wmType === "stash-search") {
      for (const entry of widget.entries ?? []) {
        entry.hotkey = normalizeFullHotkey(entry.hotkey) as string | null;
      }
    }
  }
}
