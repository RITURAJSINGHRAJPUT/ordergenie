import { PrismaClient, RoleName, OutletType, ApiType, SyncType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encrypt } from '../src/utils/encryption';
import { DEFAULT_CRON_EXPRESSIONS } from '../src/config/constants';

const prisma = new PrismaClient();

// Outlets extracted from the Petpooja email threads (apidocs/apidocs.txt).
// `brand` groupings for the non-Aiko/Capiche/Bookends outlets are an inferred
// best guess (they share sync-code activation batches) — correct via Settings
// if the real brand structure differs.
const KNOWN_OUTLETS = [
  // salesSyncCode is an UNVERIFIED candidate (from a partially-fabricated reference doc) —
  // a live call succeeds and its restaurantid matches this outlet's RID, but the response's
  // res_name/address are Aiko (Surat)'s. Kept in so it's testable via Settings > API Explorer;
  // don't trust it for real Sales sync until confirmed against real order data.
  { name: 'Aiko (Ahmedabad)', brand: 'Aiko', rid: '134691', city: 'Ahmedabad', type: OutletType.OUTLET, salesSyncCode: 'z2ogsrb0', inventorySyncCode: null },
  { name: 'Aiko (Surat)', brand: 'Aiko', rid: '73492', city: 'Surat', type: OutletType.OUTLET, salesSyncCode: '1ce6t782', inventorySyncCode: null },
  { name: 'Bookends Mobile', brand: 'Bookends', rid: '359628', city: null, type: OutletType.OUTLET, salesSyncCode: 'yvop12cq3m', inventorySyncCode: null },
  { name: 'Capiche Ambli', brand: 'Capiche', rid: '353369', city: 'Ahmedabad', type: OutletType.OUTLET, salesSyncCode: 'qvy5ze7s0c', inventorySyncCode: null },
  { name: 'Capiche (Piplod)', brand: 'Capiche', rid: '21492', city: 'Surat', type: OutletType.OUTLET, salesSyncCode: 'ukrhzywj', inventorySyncCode: null },
  { name: 'Capiche (Vesu)', brand: 'Capiche', rid: '344447', city: 'Surat', type: OutletType.OUTLET, salesSyncCode: '4tmaivhj', inventorySyncCode: null },
  { name: 'Capiche Uni', brand: 'Capiche', rid: '419174', city: 'Ahmedabad', type: OutletType.OUTLET, salesSyncCode: 'ihtnr4a7cy', inventorySyncCode: null },
  { name: 'Ahmedabad Bakery', brand: 'KG', rid: '410700', city: 'Ahmedabad', type: OutletType.OUTLET, salesSyncCode: null, inventorySyncCode: 'eh0x8kt3d2' },
  { name: 'Ahmedabad Store', brand: 'KG', rid: '358609', city: 'Ahmedabad', type: OutletType.OUTLET, salesSyncCode: null, inventorySyncCode: '4pwgfxrzs2' },
  { name: 'Family', brand: 'KG', rid: '394370', city: null, type: OutletType.OUTLET, salesSyncCode: null, inventorySyncCode: 'x74bivacjk' },
  { name: 'KG Birthday Cake', brand: 'KG', rid: '383611', city: null, type: OutletType.OUTLET, salesSyncCode: null, inventorySyncCode: '9zrehnckm6' },
  { name: 'ODC', brand: 'KG', rid: '423523', city: null, type: OutletType.OUTLET, salesSyncCode: null, inventorySyncCode: 'jprtvkud2b' },
  { name: 'ODC Store', brand: 'KG', rid: '404029', city: null, type: OutletType.OUTLET, salesSyncCode: null, inventorySyncCode: '8okipxz7r5' },
  { name: 'Surat Bakery', brand: 'KG', rid: '343448', city: 'Surat', type: OutletType.OUTLET, salesSyncCode: null, inventorySyncCode: 'cjkf5gi2' },
  { name: 'Surat Store', brand: 'KG', rid: '117185', city: 'Surat', type: OutletType.OUTLET, salesSyncCode: null, inventorySyncCode: 'd6pbazgs' },
  { name: 'Ahmedabad Prep Kitchen', brand: 'KG', rid: '410150', city: 'Ahmedabad', type: OutletType.PREP_KITCHEN, salesSyncCode: null, inventorySyncCode: 'opw2xhc6vg' },
  { name: 'Surat Prep Kitchen', brand: 'KG', rid: '376017', city: 'Surat', type: OutletType.PREP_KITCHEN, salesSyncCode: null, inventorySyncCode: 'kv4roawcjf' },
  { name: 'Accounts Department', brand: 'Internal', rid: '451175', city: null, type: OutletType.ADMIN, salesSyncCode: null, inventorySyncCode: null },
] as const;

async function seedRolesAndAdmin() {
  // A lookup rather than a ternary chain — it was already five deep before SUPER_ADMIN.
  const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
    SUPER_ADMIN: 'Everything, including Settings — the only role that can manage users, roles and Petpooja config, and the only one that can grant page access',
    ADMIN: 'Full access to outlets, sales, purchases and reports. No Settings unless granted a specific page',
    MANAGEMENT: 'Dashboards, outlet comparison, report exports',
    OUTLET_MANAGER: 'Single assigned outlet: sales, inventory, purchase orders',
    HEAD_CHEF: 'Single assigned outlet: enter daily Opening/Actual Closing on Reconciliation only',
    VIEWER:
      'Read-only access across all outlets — no create/edit/delete, and no visibility into Users, Roles, Notifications, or Sync Schedule',
  };

  const roleRecords = await Promise.all(
    (Object.values(RoleName) as RoleName[]).map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, description: ROLE_DESCRIPTIONS[name] },
      })
    )
  );
  const adminRole = roleRecords.find((r) => r.name === 'ADMIN')!;

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@ordergenie.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: 'OrderGenie Admin',
      roleId: adminRole.id,
      isActive: true,
    },
  });

  return { roleRecords, admin };
}

async function seedOutlets() {
  const outlets = [];
  for (const o of KNOWN_OUTLETS) {
    const outlet = await prisma.outlet.upsert({
      where: { rid: o.rid },
      update: {},
      create: {
        name: o.name,
        brand: o.brand,
        rid: o.rid,
        outletType: o.type,
        city: o.city ?? undefined,
        salesSyncCode: o.salesSyncCode ?? undefined,
        inventorySyncCode: o.inventorySyncCode ?? undefined,
        isActive: true,
      },
    });
    outlets.push(outlet);
  }
  return outlets;
}

async function seedPetpoojaConfig() {
  const salesConfigured = Boolean(process.env.PETPOOJA_SALES_APP_KEY);
  const purchaseConfigured = Boolean(process.env.PETPOOJA_PURCHASE_APP_KEY);

  const rows: Array<{ apiType: ApiType; configured: boolean; appKey?: string; appSecret?: string; accessToken?: string; cookie?: string }> = [
    {
      apiType: ApiType.SALES,
      configured: salesConfigured,
      appKey: process.env.PETPOOJA_SALES_APP_KEY,
      appSecret: process.env.PETPOOJA_SALES_APP_SECRET,
      accessToken: process.env.PETPOOJA_SALES_ACCESS_TOKEN,
      cookie: process.env.PETPOOJA_SALES_COOKIE,
    },
    {
      apiType: ApiType.PURCHASE,
      configured: purchaseConfigured,
      appKey: process.env.PETPOOJA_PURCHASE_APP_KEY,
      appSecret: process.env.PETPOOJA_PURCHASE_APP_SECRET,
      accessToken: process.env.PETPOOJA_PURCHASE_ACCESS_TOKEN,
    },
    { apiType: ApiType.INVENTORY, configured: false },
    { apiType: ApiType.TRANSFER, configured: false },
  ];

  for (const row of rows) {
    await prisma.petpoojaApiConfig.upsert({
      where: { apiType: row.apiType },
      update: {},
      create: {
        apiType: row.apiType,
        isConfigured: row.configured,
        appKeyEncrypted: row.appKey ? encrypt(row.appKey) : null,
        appSecretEncrypted: row.appSecret ? encrypt(row.appSecret) : null,
        accessTokenEncrypted: row.accessToken ? encrypt(row.accessToken) : null,
        cookieEncrypted: row.cookie ? encrypt(row.cookie) : null,
        notes:
          row.apiType === 'INVENTORY' || row.apiType === 'TRANSFER'
            ? 'Endpoint/schema not yet documented by Petpooja — sync runs against a stub until configured.'
            : null,
      },
    });
  }
}

async function seedSyncSchedules() {
  const schedules: Array<{ syncType: SyncType; cron: string }> = [
    { syncType: SyncType.SALES, cron: DEFAULT_CRON_EXPRESSIONS.SALES },
    { syncType: SyncType.PURCHASE, cron: DEFAULT_CRON_EXPRESSIONS.PURCHASE },
    { syncType: SyncType.HISTORICAL, cron: DEFAULT_CRON_EXPRESSIONS.HISTORICAL },
  ];
  for (const s of schedules) {
    await prisma.syncSchedule.upsert({
      where: { syncType: s.syncType },
      update: {},
      create: { syncType: s.syncType, cronExpression: s.cron, isEnabled: true },
    });
  }
}

async function main() {
  console.log('Seeding roles + admin user...');
  const { admin } = await seedRolesAndAdmin();

  console.log('Seeding outlets...');
  await seedOutlets();

  console.log('Seeding Petpooja API config...');
  await seedPetpoojaConfig();

  console.log('Seeding sync schedules...');
  await seedSyncSchedules();

  console.log('Seeding notification settings...');
  await prisma.notificationSetting.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, lowStockAlerts: true, syncFailureAlerts: true, dailySummaryEmail: false },
  });

  console.log('Seed complete.');
  console.log(`Admin login: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
