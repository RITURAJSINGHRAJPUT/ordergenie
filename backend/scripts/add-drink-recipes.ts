import { PrismaClient, RecipeTriggerType } from '@prisma/client';

/**
 * Usage: npx tsx scripts/add-drink-recipes.ts [db-url]
 *
 * Mixers are never sold as themselves, so their consumption is derived from the cocktails
 * that pour them. Exact names rather than substrings: "basil" would also match
 * "Tomato Basil Soup", and a wrong match fails silently instead of erroring.
 */
const DB_URL = process.argv[2];
const prisma = new PrismaClient(DB_URL ? { datasources: { db: { url: DB_URL } } } : undefined);

const BRAND = 'Capiche';

const RULES = [
  { ingredientName: 'Gunsberg Ginger Beer 300ml', triggerValues: ['Moscow Mule'] },
  { ingredientName: 'Gunsberg Ginger Ale 300ml', triggerValues: ['Ginger Ale'] },
  { ingredientName: 'Perrier Sparkling Water 300ml', triggerValues: ['Perrier'] },
  { ingredientName: 'Schweppes Ginger Ale 300ml', triggerValues: ['Jamun Jamun', 'Basil Smash', 'Melon Fresca'] },
  { ingredientName: '250ml Kinley Soda', triggerValues: ['Mint Mojito'] },
];

async function main() {
  for (const rule of RULES) {
    // ReconciliationRecipe has no unique constraint, so skipDuplicates can't guard this.
    const existing = await prisma.reconciliationRecipe.findFirst({
      where: { brand: BRAND, ingredientName: rule.ingredientName },
    });

    if (existing) {
      console.log(`skipped  ${rule.ingredientName} — rule already exists`);
      continue;
    }

    await prisma.reconciliationRecipe.create({
      data: {
        brand: BRAND,
        ingredientName: rule.ingredientName,
        triggerType: RecipeTriggerType.ITEM_NAMES,
        triggerValues: rule.triggerValues,
        qtyPerMatch: 1,
      },
    });
    console.log(`created  ${rule.ingredientName} <- ${rule.triggerValues.join(', ')}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
