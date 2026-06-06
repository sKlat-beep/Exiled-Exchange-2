import {
  ItemCategory,
  itemIsModifiable,
  ItemRarity,
  ParsedItem,
} from "@/parser";
import { ModifierType } from "@/parser/modifiers";
import type { PriceCheckModifierCountMode } from "@/web/overlay/widgets";
import {
  FilterTag,
  ItemHasEmptyModifier,
  StatFilter,
} from "./interfaces";

type EmptyModifierInfo = {
  empty: ItemHasEmptyModifier;
  counts: Record<ItemHasEmptyModifier, number>;
};

export function maxUsefulItemLevel(category: ItemCategory | undefined) {
  const itemLevelCaps: Partial<Record<ItemCategory, number>> = {
    [ItemCategory.Wand]: 81,
    [ItemCategory.Staff]: 81,
    [ItemCategory.Relic]: 80,
    [ItemCategory.Tablet]: 1,
    [ItemCategory.Jewel]: 1,
    [ItemCategory.Map]: 1,
  };

  const maxUsefulItemLevel = category ? (itemLevelCaps[category] ?? 82) : 82;
  return maxUsefulItemLevel;
}

export function likelyFinishedItem(item: ParsedItem) {
  return (
    item.rarity === ItemRarity.Unique ||
    item.statsByType.some((calc) => calc.type === ModifierType.Crafted) ||
    item.quality === 20 || // quality > 20 can be used for selling bases, quality < 20 drops sometimes
    !itemIsModifiable(item)
  );
}

export function hasCraftingValue(item: ParsedItem) {
  return (
    itemIsModifiable(item) &&
    // Base useful crafting item (synth and influence not in poe2 yet though)
    (item.isSynthesised ||
      item.isFractured ||
      item.influences.length ||
      // Clusters (deprecated)
      item.category === ItemCategory.ClusterJewel ||
      // Jewels
      (item.category === ItemCategory.Jewel &&
        item.rarity === ItemRarity.Magic) ||
      // High ilvl (minus 15, seems like low ilevel ones still kinda sell?)
      item.itemLevel! >= maxUsefulItemLevel(item.category) - 15 ||
      // is exceptional item
      (item.augmentSockets &&
        item.augmentSockets.current > item.augmentSockets.normal) ||
      (item.quality && item.quality > 20))
  );
}

export function explicitModifierCount(item: ParsedItem) {
  const randomMods = item.newMods.filter(
    (mod) =>
      mod.info.type === ModifierType.Explicit ||
      mod.info.type === ModifierType.Fractured ||
      mod.info.type === ModifierType.Veiled ||
      mod.info.type === ModifierType.Desecrated,
  );
  if (randomMods.length === 0) {
    return { prefixes: 0, suffixes: 0, total: 0 };
  }

  const prefixes = randomMods.filter(
    (mod) => mod.info.generation === "prefix",
  ).length;
  const suffixes = randomMods.filter(
    (mod) => mod.info.generation === "suffix",
  ).length;

  return {
    prefixes,
    suffixes,
    total: prefixes + suffixes,
  };
}

export function createModifierCountFilters(
  item: ParsedItem,
  mode: PriceCheckModifierCountMode,
): StatFilter[] {
  if (!canMatchModifierCounts(item) || mode === "off") {
    return [];
  }

  const { prefixes, suffixes, total } = explicitModifierCount(item);
  if (mode === "same-total") {
    return [
      createExactPseudoFilter(
        ["pseudo.pseudo_number_of_affix_mods"],
        "# Modifiers",
        total,
      ),
    ];
  }

  if (mode === "same-prefix-suffix") {
    return [
      createExactPseudoFilter(
        ["pseudo.pseudo_number_of_prefix_mods"],
        "# Prefix Modifiers",
        prefixes,
      ),
      createExactPseudoFilter(
        ["pseudo.pseudo_number_of_suffix_mods"],
        "# Suffix Modifiers",
        suffixes,
      ),
    ];
  }

  const emptyModifier = getEmptyModifierInfo(item);
  return emptyModifier ? [createEmptyModifierFilter(emptyModifier, false)] : [];
}

export function applyModifierCountMode(
  filters: StatFilter[],
  item: ParsedItem,
  mode: PriceCheckModifierCountMode,
) {
  if (mode === "off" || !canMatchModifierCounts(item)) {
    return;
  }

  if (mode === "same-open-affixes") {
    const existing = filters.find(
      (filter) => filter.tradeId[0] === "item.has_empty_modifier",
    );
    if (existing) {
      existing.disabled = false;
      existing.hidden = undefined;
      return;
    }
  }

  filters.push(...createModifierCountFilters(item, mode));
}

export function getEmptyModifierInfo(
  item: ParsedItem,
): EmptyModifierInfo | false {
  if (!itemIsModifiable(item) || item.category === ItemCategory.Map) {
    return false;
  }

  if (item.rarity === ItemRarity.Magic) {
    const { prefixes: magicPrefixes, suffixes: magicSuffixes } =
      explicitModifierCount(item);
    if (magicPrefixes && magicSuffixes) {
      return false;
    }
    if (magicPrefixes > 0) {
      return {
        empty: ItemHasEmptyModifier.Suffix,
        counts: {
          [ItemHasEmptyModifier.Prefix]: 0,
          [ItemHasEmptyModifier.Suffix]: 1,
          [ItemHasEmptyModifier.Any]: 1,
        },
      };
    } else if (magicSuffixes > 0) {
      return {
        empty: ItemHasEmptyModifier.Prefix,
        counts: {
          [ItemHasEmptyModifier.Prefix]: 1,
          [ItemHasEmptyModifier.Suffix]: 0,
          [ItemHasEmptyModifier.Any]: 1,
        },
      };
    }
    return false;
  }

  if (item.rarity !== ItemRarity.Rare) {
    return false;
  }

  const { prefixes, suffixes, total } = explicitModifierCount(item);
  const maxAmount = itemMaxModifiersBySlot(item);

  if (total !== maxAmount[ItemHasEmptyModifier.Any] && total !== 0) {
    const empty =
      suffixes === maxAmount[ItemHasEmptyModifier.Suffix]
        ? ItemHasEmptyModifier.Prefix
        : prefixes === maxAmount[ItemHasEmptyModifier.Prefix]
          ? ItemHasEmptyModifier.Suffix
          : ItemHasEmptyModifier.Any;

    const counts = {
      [ItemHasEmptyModifier.Any]: maxAmount[ItemHasEmptyModifier.Any] - total,
      [ItemHasEmptyModifier.Prefix]:
        maxAmount[ItemHasEmptyModifier.Prefix] - prefixes,
      [ItemHasEmptyModifier.Suffix]:
        maxAmount[ItemHasEmptyModifier.Suffix] - suffixes,
    };

    return {
      empty,
      counts,
    };
  }

  return false;
}

export function createEmptyModifierFilter(
  emptyModifier: EmptyModifierInfo,
  disabled: boolean,
): StatFilter {
  const roll = emptyModifier.counts[emptyModifier.empty];
  return {
    tradeId: ["item.has_empty_modifier"],
    text: "# Empty Modifier",
    statRef: "# Empty Modifier",
    disabled,
    tag: FilterTag.Pseudo,
    sources: [],
    option: {
      value: emptyModifier.empty,
    },
    additionalInfo: {
      emptyModifierInfo: emptyModifier.counts,
    },
    roll: exactRoll(roll),
  };
}

function canMatchModifierCounts(item: ParsedItem) {
  return (
    !item.isUnidentified &&
    !item.isUnmodifiable &&
    item.rarity !== ItemRarity.Unique &&
    item.category !== ItemCategory.Map &&
    itemIsModifiable(item) &&
    hasKnownModifierGeneration(item)
  );
}

function hasKnownModifierGeneration(item: ParsedItem) {
  return item.newMods
    .filter(
      (mod) =>
        mod.info.type === ModifierType.Explicit ||
        mod.info.type === ModifierType.Fractured ||
        mod.info.type === ModifierType.Veiled ||
        mod.info.type === ModifierType.Desecrated,
    )
    .every(
      (mod) =>
        mod.info.generation === "prefix" || mod.info.generation === "suffix",
    );
}

function createExactPseudoFilter(
  tradeId: string[],
  text: string,
  value: number,
): StatFilter {
  return {
    tradeId,
    text,
    statRef: text,
    disabled: false,
    tag: FilterTag.Pseudo,
    sources: [],
    roll: exactRoll(value),
  };
}

function exactRoll(value: number): NonNullable<StatFilter["roll"]> {
  return {
    value,
    min: value,
    max: value,
    default: { min: value, max: value },
    dp: false,
    isNegated: false,
  };
}

function itemMaxModifiersBySlot(item: ParsedItem) {
  let base;
  switch (item.category) {
    case ItemCategory.Jewel:
    case ItemCategory.Tablet:
    case ItemCategory.Relic:
    case ItemCategory.SanctumRelic:
      base = 2;
      break;
    default:
      base = 3;
      break;
  }

  const maxAmount = [2 * base, base, base];
  // Some jewellery bases move slots between prefixes and suffixes.
  if (
    item.info.refName === "Dusk Amulet" ||
    item.info.refName === "Dusk Ring"
  ) {
    maxAmount[ItemHasEmptyModifier.Prefix] += 1;
    maxAmount[ItemHasEmptyModifier.Suffix] -= 1;
  } else if (
    item.info.refName === "Gloam Amulet" ||
    item.info.refName === "Gloam Ring"
  ) {
    maxAmount[ItemHasEmptyModifier.Prefix] -= 1;
    maxAmount[ItemHasEmptyModifier.Suffix] += 1;
  } else if (
    item.info.refName === "Penumbra Amulet" ||
    item.info.refName === "Penumbra Ring"
  ) {
    maxAmount[ItemHasEmptyModifier.Prefix] += 2;
    maxAmount[ItemHasEmptyModifier.Suffix] -= 2;
  } else if (
    item.info.refName === "Tenebrous Amulet" ||
    item.info.refName === "Tenebrous Ring"
  ) {
    maxAmount[ItemHasEmptyModifier.Prefix] -= 2;
    maxAmount[ItemHasEmptyModifier.Suffix] += 2;
  }

  return maxAmount;
}
