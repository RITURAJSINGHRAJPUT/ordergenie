# Add recipe rules for four Capiche drink mixers

## Context

Reconciliation tracks four bottled mixers as Capiche ingredients — Gunsberg Ginger Beer 300ml, Gunsberg Ginger Ale 300ml, Perrier Sparkling Water 300ml and Schweppes Ginger Ale 300ml. All four already exist as `ClassAItem` rows, so they appear on the reconciliation dashboard, but none has a `ReconciliationRecipe` rule. Nobody buys a "mixer" — they buy a cocktail — so with no rule the system sees zero consumption: Closing (AI) never drops, and every bottle actually used shows up as unexplained wastage.

This adds the four rules that derive mixer consumption from cocktail sales, exactly as Big/Small Pizza Dough derive dough consumption from pizza sales.

## Verified against the Railway production database

- All four ingredient names exist as `ClassAItem` ITEM rows under brand **Capiche**. No Class A Item work is needed.
- Only the three existing dough rules are in `ReconciliationRecipe`. None of the four drinks has a rule yet.
- The six trigger items are punched with these exact names, all-time: `Moscow Mule`, `Ginger Ale`, `Perrier`, `Jamun Jamun`, `Basil Smash`, `Melon Fresca`. All sell across all four Capiche outlets.
- **Spelling correction:** the POS name is `Melon Fresca`, not "Melon Frescca".
- No sold item is named after any of the four ingredients, so `applyRecipesToSalesMap` overwriting `salesByItem[ingredientName]` discards nothing real.

## The rules to create

Brand `Capiche`, `qtyPerMatch` 1 for all (one cocktail consumes one bottle), `triggerType` **`ITEM_NAMES`** (exact, case-insensitive) for all four:

| ingredientName | triggerValues |
|---|---|
| Gunsberg Ginger Beer 300ml | `Moscow Mule` |
| Gunsberg Ginger Ale 300ml | `Ginger Ale` |
| Perrier Sparkling Water 300ml | `Perrier` |
| Schweppes Ginger Ale 300ml | `Jamun Jamun`, `Basil Smash`, `Melon Fresca` |
| 250ml Kinley Soda | `Mint Mojito` |

**Why exact match, not `NAME_CONTAINS`.** The doughs use substring matching because a size fragment like "15 Inch" cleanly identifies 42 pizza variants. Here substring matching is actively unsafe: `basil` also matches `Tomato Basil Soup (Regular)` and `Tomato Basil Soup (Jain)`, which are real Capiche items and contain no Schweppes. `perrier` and `ginger ale` would likewise swallow any future menu item carrying those words. Since only the first matching rule applies per item, a bad match fails silently rather than erroring.

## Implementation

There is no admin UI or API for `ReconciliationRecipe` — the only writer in the repo is `backend/scripts/migrate-classA-to-railway.ts`. The existing dough rules were inserted by hand and exist only in the database, which is why they appear nowhere in version control.

Add **`backend/scripts/add-drink-recipes.ts`**, following the Prisma shape used in `migrate-classA-to-railway.ts`:

- Define the four rules as a literal array.
- For each, check for an existing rule with the same `brand` + `ingredientName` and skip it if present. `ReconciliationRecipe` has **no unique constraint**, so `createMany({ skipDuplicates: true })` will not de-duplicate and a second run would silently double every rule — the guard must be an explicit `findFirst`.
- Log created vs skipped per rule.
- Take the target database from `DATABASE_URL` so the same script runs against local and Railway.

Run it against Railway, then against local once that database is back up, so the two stay in step.

Per the standing preference, also copy this plan to an in-repo file (`PLAN.md`) as part of the change.

## Verification

1. **Rows landed, exactly once:** `SELECT brand, "ingredientName", "triggerType", "triggerValues", "qtyPerMatch" FROM "ReconciliationRecipe" ORDER BY "ingredientName";` — expect 8 rows (3 dough + 5 new), no duplicates. Re-run the script and confirm it reports all five skipped and the count stays at 8.
2. **Derived figures are correct.** For Capiche (Vesu), the mixer "Sales" column should equal these known trigger quantities:

   | Date | Ginger Beer | Gunsberg Ginger Ale | Schweppes | Perrier | Kinley Soda |
   |---|---|---|---|---|---|
   | 2026-10-03 | 4 | 5 | 11 | 0 | 7 |
   | 2026-10-04 | 5 | 7 | 13 | 0 | 16 |
   | 2026-10-06 | 3 | 2 | 6 | 0 | 6 |
   | 2026-10-07 | 4 | 3 | 8 | 0 | 2 |

   Load the Capiche (Vesu) reconciliation tab for 2026-10-04 and confirm the five rows read 5 / 7 / 13 / 0 / 16.
3. **No false match on soup:** Schweppes on a day with `Tomato Basil Soup` sales must equal only the three cocktails' total, excluding soup. 2026-10-04 at Vesu is the check — 13, not 13 + soup.
4. **No regression:** Big/Small Pizza Dough figures on the same day are unchanged.
5. **Downstream:** confirm Closing (AI) for the mixers now decreases by the derived quantity and wastage is no longer inflated by it.

## Notes

- Aiko also sells items named `Perrier` and `Ginger Ale`, but has no mixer Class A Items and gets no rules. Recipe rules are brand-scoped and sales are read per outlet, so the Capiche rules cannot reach Aiko's sales. Flagging only in case Aiko should track these too — out of scope here.
- `qtyPerMatch` of 1 assumes one bottle per cocktail. If a Moscow Mule actually pours half a bottle, change that rule's value to 0.5; the field is a decimal and needs no code change.
- Production currently holds only 2026-10-03 to 2026-10-07 of sales, so the trigger names are confirmed against five days. If a cocktail is later renamed or a variant is added (e.g. "Moscow Mule (Large)"), the exact-match rule will stop counting it silently — worth re-checking the names after any menu change.
