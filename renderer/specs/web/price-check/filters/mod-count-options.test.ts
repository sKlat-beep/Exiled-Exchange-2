import { ItemCategory, ItemRarity, ParsedItem } from "@/parser";
import type { ParsedModifier } from "@/parser/advanced-mod-desc";
import { ModifierType } from "@/parser/modifiers";
import {
  createModifierCountFilters,
  applyModifierCountMode,
} from "@/web/price-check/filters/common";
import { ItemFilters, StatFilter } from "@/web/price-check/filters/interfaces";
import { createTradeRequest } from "@/web/price-check/trade/pathofexile-trade";
import { describe, expect, it } from "vitest";
import { createTestItem } from "@specs/helper";

function modifier(generation?: "prefix" | "suffix"): ParsedModifier {
  return {
    info: {
      type: ModifierType.Explicit,
      generation,
      tags: [],
    },
    stats: [],
  };
}

function craftableRare(overrides: Partial<ParsedItem> = {}): ParsedItem {
  return {
    ...createTestItem(),
    rarity: ItemRarity.Rare,
    category: ItemCategory.BodyArmour,
    info: {
      ...createTestItem().info,
      refName: "Expert Plate",
      name: "Expert Plate",
      craftable: { category: ItemCategory.BodyArmour },
    },
    newMods: [
      modifier("prefix"),
      modifier("prefix"),
      modifier("suffix"),
    ],
    ...overrides,
  };
}

function tradeFilters(overrides: Partial<ItemFilters> = {}): ItemFilters {
  return {
    searchExact: {
      baseType: "Expert Plate",
      baseTypeTrade: "Expert Plate",
    },
    trade: {
      offline: false,
      onlineInLeague: false,
      listingType: "securable",
      listed: undefined,
      currency: undefined,
      league: "Standard",
      collapseListings: "app",
    },
    ...overrides,
  };
}

describe("modifier count modes", () => {
  it("adds no filters when off", () => {
    expect(createModifierCountFilters(craftableRare(), "off")).toEqual([]);
  });

  it("can match the same total mod count", () => {
    const filters = createModifierCountFilters(craftableRare(), "same-total");

    expect(filters).toMatchObject([
      {
        tradeId: ["pseudo.pseudo_number_of_affix_mods"],
        statRef: "# Modifiers",
        disabled: false,
        roll: { min: 3, max: 3 },
      },
    ]);
  });

  it("can match the same prefix and suffix counts", () => {
    const filters = createModifierCountFilters(
      craftableRare(),
      "same-prefix-suffix",
    );

    expect(filters).toMatchObject([
      {
        tradeId: ["pseudo.pseudo_number_of_prefix_mods"],
        statRef: "# Prefix Modifiers",
        roll: { min: 2, max: 2 },
      },
      {
        tradeId: ["pseudo.pseudo_number_of_suffix_mods"],
        statRef: "# Suffix Modifiers",
        roll: { min: 1, max: 1 },
      },
    ]);
  });

  it("can match the same open affix shape", () => {
    const filters = createModifierCountFilters(
      craftableRare(),
      "same-open-affixes",
    );

    expect(filters).toMatchObject([
      {
        tradeId: ["item.has_empty_modifier"],
        statRef: "# Empty Modifier",
        disabled: false,
        option: { value: 0 },
        roll: { min: 3, max: 3 },
      },
    ]);
  });

  it("enables the existing hidden open-affix filter when present", () => {
    const filters = createModifierCountFilters(
      craftableRare(),
      "same-open-affixes",
    );
    filters[0].disabled = true;
    filters[0].hidden = "filters.hide_empty_mod";

    applyModifierCountMode(filters, craftableRare(), "same-open-affixes");

    expect(filters[0].disabled).toBe(false);
    expect(filters[0].hidden).toBeUndefined();
    expect(filters).toHaveLength(1);
  });

  it.each([
    { rarity: ItemRarity.Unique },
    { category: ItemCategory.Map },
    { isUnidentified: true },
    { isUnmodifiable: true },
    { newMods: [modifier(undefined)] },
  ])("skips unsafe item shapes %#", (overrides) => {
    expect(
      createModifierCountFilters(craftableRare(overrides), "same-total"),
    ).toEqual([]);
  });
});

describe("trade request output", () => {
  it("serializes rare rarity", () => {
    const request = createTradeRequest(
      tradeFilters({ rarity: { value: "rare" } }),
      [],
      craftableRare(),
    );

    expect(
      request.query.filters.type_filters?.filters.rarity?.option,
    ).toBe("rare");
  });

  it("serializes total mod count", () => {
    const request = createTradeRequest(
      tradeFilters(),
      createModifierCountFilters(craftableRare(), "same-total"),
      craftableRare(),
    );

    expect(request.query.stats[0].filters).toMatchObject([
      {
        id: "pseudo.pseudo_number_of_affix_mods",
        value: { min: 3, max: 3 },
      },
    ]);
  });

  it("serializes open-affix matching", () => {
    const stats = createModifierCountFilters(
      craftableRare(),
      "same-open-affixes",
    ) as StatFilter[];

    const request = createTradeRequest(tradeFilters(), stats, craftableRare());

    expect(request.query.stats[1]).toMatchObject({
      type: "count",
      value: { min: 1, max: 1 },
      filters: [
        {
          id: "pseudo.pseudo_number_of_empty_affix_mods",
          value: { min: 3, max: 3 },
        },
      ],
    });
  });
});
