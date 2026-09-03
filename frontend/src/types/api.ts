export type Role = 'ADMIN' | 'MANAGEMENT' | 'OUTLET_MANAGER' | 'HEAD_CHEF' | 'VIEWER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  outletId: string | null;
  outletName?: string | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
  message?: string;
}

export interface Outlet {
  id: string;
  name: string;
  brand: string;
  rid: string;
  outletType: 'OUTLET' | 'PREP_KITCHEN' | 'ADMIN';
  city: string | null;
  isActive: boolean;
  salesSyncCode: string | null;
  inventorySyncCode: string | null;
}

export interface DashboardKpis {
  todaySales: number;
  todayOrders: number;
  yesterdaySales: number;
  monthlySales: number;
  monthlyOrders: number;
  averageBill: number;
  discounts: number;
  taxes: number;
  inventoryValue: number;
  purchaseOrders: number;
  lowStockItems: number;
}

export interface DashboardCharts {
  salesTrend: { date: string; amount: number }[];
  outletComparison: { outletId: string; outletName: string; revenue: number }[];
  topSellingItems: { itemName: string; quantity: number; revenue: number }[];
  hourlySales: { hour: number; amount: number }[];
  paymentBreakdown: { paymentMode: string; amount: number }[];
}

export interface DashboardData {
  kpis: DashboardKpis;
  charts: DashboardCharts;
}

export interface SaleRow {
  id: string;
  invoiceNumber: string;
  outletId: string;
  outletName: string;
  date: string;
  time: string;
  customer: string | null;
  gross: number;
  discount: number;
  tax: number;
  net: number;
  paymentMode: string;
}

export interface SaleDetail extends SaleRow {
  customerPhone: string | null;
  orderType: string | null;
  items: {
    itemName: string;
    category: string | null;
    quantity: number;
    price: number;
    discount: number;
    tax: number;
    total: number;
  }[];
}

export interface ItemSalesRow {
  itemName: string;
  category: string | null;
  quantitySold: number;
  revenue: number;
  averagePrice: number;
  discount: number;
  tax: number;
}

export type ClassAItemType = 'ITEM' | 'CATEGORY';

export interface ClassAItem {
  id: string;
  brand: string;
  type: ClassAItemType;
  value: string;
  createdAt: string;
}

export interface ClassAItemSummaryRow {
  key: string;
  itemName: string;
  category: string | null;
  quantitySold: number;
  revenue: number;
  averagePrice: number;
}

export type WastageReason = 'EXPIRED' | 'SPOILED' | 'PREP_ERROR' | 'DROPPED_DAMAGED' | 'OTHER';

export interface WastageEntry {
  id: string;
  outletId: string;
  outletName: string;
  itemName: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  reason: WastageReason;
  notes: string | null;
  reportedByName: string | null;
  wastageDate: string;
}

export interface InventoryRow {
  id: string;
  outletId: string;
  outletName: string;
  itemName: string;
  category: string | null;
  store: string | null;
  unit: string | null;
  openingStock: number;
  purchasedQty: number;
  consumedQty: number;
  closingStock: number;
  currentStock: number;
  stockValue: number;
  isLowStock: boolean;
  stockDate: string;
  source: 'PETPOOJA' | 'STUB' | 'MANUAL';
}

export interface InventoryDetail extends InventoryRow {
  history: { transactionType: string; quantity: number; unit: string | null; transactionDate: string }[];
}

export interface PredictedSaleRow {
  itemName: string;
  stockDate: string;
  predictedQty: number;
  source: string;
}

export interface SoldOutRow {
  itemName: string;
  stockDate: string;
  soldQty: number;
  missedQty: number;
  ratio: number | null;
  hasEntry: boolean;
}

export interface ReconciliationRow {
  itemName: string;
  classAItemId: string;
  unit: string | null;
  hasManualEntry: boolean;
  openingAutoFilled: boolean;
  opening: number;
  actualClosing: number;
  salesToday: number;
  predictedSales: number;
  poToday: number;
  poNextDay: number;
  factualClosingAI: number;
  nextDayOpening: number;
  salesVariance: number;
  wastage: number;
  stockDate: string;
}

export type PurchaseOrderStatus = 'DRAFT' | 'PENDING' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderRow {
  id: string;
  poNumber: string;
  vendorName: string;
  outletId: string;
  outletName: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  orderDate: string;
  expectedDate: string | null;
  petpoojaCreatedAt: string | null;
}

export interface PurchaseOrderItemsByDay {
  date: string;
  items: { itemName: string; unit: string | null; quantity: number }[];
}

export interface PurchaseOrderDetail extends PurchaseOrderRow {
  vendor: { id: string; name: string; contactPerson: string | null; phone: string | null } | null;
  invoiceNumber: string | null;
  taxAmount: number;
  receivedDate: string | null;
  items: {
    itemName: string;
    quantity: number;
    unit: string | null;
    rate: number;
    amount: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    receivedQty: number;
    pendingQty: number;
  }[];
}

export type WebhookOutcome = 'SUCCESS' | 'REJECTED';

export interface PurchaseOrderWebhookLogRow {
  id: string;
  receivedAt: string;
  outletId: string | null;
  outletName: string | null;
  petpoojaPurchaseId: string | null;
  poNumber: string | null;
  menuSharingCode: string | null;
  outcome: WebhookOutcome;
  httpStatusCode: number;
  failureReason: string | null;
  status: PurchaseOrderStatus | null;
  writeResult: string | null;
}

export interface PurchaseOrderWebhookLogDetail extends PurchaseOrderWebhookLogRow {
  rawPayload: unknown;
  currentPurchaseOrder:
    | { id: string; poNumber: string; status: PurchaseOrderStatus; orderDate: string; updatedAt: string }
    | { pruned: true; id: string }
    | null;
}

export interface OutletOverviewRow {
  id: string;
  name: string;
  brand: string;
  rid: string;
  city: string | null;
  outletType: string;
  todaySales: number;
  todayOrders: number;
  inventoryValue: number;
  openPurchaseOrders: number;
}

export interface OutletComparisonRow {
  id: string;
  name: string;
  brand: string;
  revenue: number;
  orders: number;
  averageBill: number;
  growthPercent: number | null;
}

export type ApiType = 'SALES' | 'PURCHASE' | 'INVENTORY' | 'TRANSFER';

export interface ApiConfigRow {
  id: string;
  apiType: ApiType;
  isConfigured: boolean;
  appKeyMasked: string | null;
  accessTokenMasked: string | null;
  hasCookie: boolean;
  lastVerifiedAt: string | null;
  notes: string | null;
  updatedAt: string;
}

export type SyncType = 'SALES' | 'INVENTORY' | 'PURCHASE' | 'HISTORICAL' | 'TRANSFER';

export interface SyncScheduleRow {
  id: string;
  syncType: SyncType;
  cronExpression: string;
  isEnabled: boolean;
  lastRunAt: string | null;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  roleId: string;
  outletId: string | null;
  outletName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface RoleRow {
  id: string;
  name: Role;
  description: string | null;
}

export interface NotificationSettings {
  lowStockAlerts: boolean;
  syncFailureAlerts: boolean;
  dailySummaryEmail: boolean;
}

export interface SyncLogRow {
  id: string;
  syncType: SyncType;
  triggerType: 'CRON' | 'MANUAL';
  outletId: string | null;
  outletName: string | null;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  startedAt: string;
  completedAt: string | null;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage: string | null;
}

export interface PredictionSummary {
  totalRows: number;
  minStockDate: string | null;
  maxStockDate: string | null;
  sources: string[];
}

export interface PredictionImportLogRow {
  id: string;
  fileName: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  startedAt: string;
  completedAt: string | null;
  rowsCreated: number;
  rowsUpdated: number;
  sheetsProcessed: number;
  sheetsSkipped: { sheet: string; reason: string }[];
  errorMessage: string | null;
  triggeredByName: string | null;
}

export interface PredictionImportResult {
  logId: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  rowsCreated: number;
  rowsUpdated: number;
  sheetsProcessed: number;
  sheetsSkipped: { sheet: string; reason: string }[];
  errorMessage: string | null;
}

// --- Petpooja API Explorer ---

export type ExplorerApiType = 'orders' | 'purchase' | 'transfer';

export interface ExplorerOutletResult {
  outletId: string;
  outletName: string;
  count: number;
  error?: string;
}

export interface ExplorerOrderItem {
  name: string;
  category: string | null;
  quantity: number;
  rate: number;
  discount: number;
  amount: number;
}

export interface ExplorerOrderRecord {
  outletId: string;
  outletName: string;
  orderId: string;
  date: string | null;
  orderType: string | null;
  paymentType: string | null;
  status: string | null;
  total: number;
  items: ExplorerOrderItem[];
}

export interface ExplorerPurchaseItem {
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  rate: number;
  discount: number;
  amount: number;
}

export interface ExplorerPurchaseRecord {
  outletId: string;
  outletName: string;
  purchaseId: string;
  type: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  supplierName: string | null;
  total: number;
  payment: string | null;
  status: string | null;
  items: ExplorerPurchaseItem[];
}

export interface ExplorerTransferRecord {
  outletId: string;
  outletName: string;
  raw: unknown;
}

export interface ExplorerResult {
  apiType: ExplorerApiType;
  recordCount: number;
  outletsRequested: number;
  outletsWithData: number;
  apiCallCount: number;
  elapsedMs: number;
  totalValue: number;
  perOutlet: ExplorerOutletResult[];
  records: ExplorerOrderRecord[] | ExplorerPurchaseRecord[] | ExplorerTransferRecord[];
}
