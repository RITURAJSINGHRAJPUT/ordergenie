export interface PetpoojaCredentials {
  appKey: string;
  appSecret: string;
  accessToken: string;
  cookie?: string;
}

// ---------- Sales / Orders API (generic_get_orders) ----------
// Real response shape confirmed by a live call: { code, success, message, order_json: [...] }
// — NOT the flat `orders`/`data` array assumed from the docs summary alone.

export interface PetpoojaOrderItem {
  categoryid?: string;
  categoryname?: string;
  name?: string;
  itemid?: string;
  price?: string | number;
  quantity?: string | number;
  total?: string | number;
  total_discount?: string | number;
  total_tax?: string | number;
  [key: string]: unknown;
}

export interface PetpoojaOrderRecord {
  Restaurant?: { restaurantid?: string; res_name?: string; restID?: string };
  Customer?: { name?: string; phone?: string };
  Order: {
    orderID: string;
    refId?: string;
    order_type?: string;
    payment_type?: string;
    discount_total?: string | number;
    tax_total?: string | number;
    core_total?: string | number;
    total?: string | number;
    created_on?: string;
    order_date?: string;
    status?: string;
    [key: string]: unknown;
  };
  Tax?: Array<{ title?: string; amount?: string | number }>;
  Discount?: unknown[];
  OrderItem: PetpoojaOrderItem[];
}

export interface PetpoojaOrdersResponse {
  code?: string;
  success?: string | boolean;
  message?: string;
  order_json?: PetpoojaOrderRecord[];
}

// ---------- Purchase API (get_purchase) ----------
// Real response shape: { code, success, message, restID, purchases: [] | "" }
// `purchases` records also cover internal inventory transfers — see mapper for
// the is_transfer_only / receiver_type discriminator confirmed by a live call.

export interface PetpoojaPurchaseItem {
  itemname?: string;
  qty?: string | number;
  price?: string | number;
  amount?: string | number;
  discount?: string | number;
  lbl_unit?: string;
  tax1_label?: string;
  tax2_label?: string;
  tax3_label?: string;
  tax1_amount?: string | number;
  tax2_amount?: string | number;
  tax3_amount?: string | number;
  [key: string]: unknown;
}

export interface PetpoojaPurchaseParty {
  sender_name?: string;
  sender_contact?: string;
  receiver_name?: string;
  receiver_contact?: string;
  receiver_gst?: string;
  receiver_type?: string;
}

export interface PetpoojaPurchaseRecord {
  purchase_id: string;
  // Linked Purchase Order ID if this purchase/invoice was raised against a PO
  // (null/absent if it's a standalone purchase with no PO). See purchaseSync.service.ts —
  // this is how an invoice gets matched back to the PENDING PurchaseOrder row the
  // PO webhook already created, instead of spawning a disconnected duplicate row.
  po_id?: string | null;
  type?: string;
  invoice_number?: string;
  invoice_date?: string;
  total?: string | number;
  total_tax?: string | number;
  action_status?: string;
  payment?: string;
  created_on?: string;
  receiver_id?: string;
  receiver_type?: string;
  restaurant_details?: {
    sender?: PetpoojaPurchaseParty;
    receiver?: PetpoojaPurchaseParty;
    is_transfer_only?: string;
    reference_number?: string;
    po_invoice_number?: string;
  };
  item_details?: PetpoojaPurchaseItem[];
  [key: string]: unknown;
}

export interface PetpoojaPurchaseResponse {
  code?: string;
  success?: string | boolean;
  message?: string;
  restID?: string;
  purchases?: PetpoojaPurchaseRecord[] | '';
}

// ---------- Purchase Order Webhook (API 8) ----------
// Reversed direction: Petpooja POSTs this to a URL we provide, whenever a PO is
// saved inside Petpooja's own PO module (i.e. before it becomes a real purchase
// invoice reachable via get_purchase). Shape per Petpooja's Inventory API docs.

export interface PetpoojaPurchaseOrderWebhookItem {
  itemname?: string;
  qty?: number | string;
  price?: number | string;
  amount?: number | string;
  lbl_unit?: string;
  hsn_code?: string;
  sap_code?: string;
  description?: string;
  tax1?: number | string; // CGST rate
  tax2?: number | string; // SGST rate
  tax3?: number | string; // IGST rate
  tax4?: number | string; // CESS rate
  tax1_amount?: number | string;
  tax2_amount?: number | string;
  tax3_amount?: number | string;
  tax4_amount?: number | string;
  [key: string]: unknown;
}

export interface PetpoojaPurchaseOrderWebhookParty {
  sender_gst?: string;
  sender_city?: string;
  sender_name?: string;
  sender_state?: string;
  sender_address?: string;
  sender_contact?: string;
  receiver_gst?: string;
  receiver_name?: string;
  receiver_type?: string;
  receiver_email?: string | null;
  receiver_address?: string;
  receiver_contact?: string | null;
  receiver_pin_code?: string;
}

export interface PetpoojaPurchaseOrderWebhookData {
  id: string;
  menuSharingCode?: string;
  receiverType?: string;
  deliveryDate?: string;
  poNumber: string;
  totalTax?: string | number;
  total?: string | number;
  roundOff?: string | number;
  itemDetails?: PetpoojaPurchaseOrderWebhookItem[];
  restDetails?: {
    sender?: PetpoojaPurchaseOrderWebhookParty;
    receiver?: PetpoojaPurchaseOrderWebhookParty;
  };
  status?: string;
  [key: string]: unknown;
}

export interface PetpoojaPurchaseOrderWebhookPayload {
  menuSharingCode: string;
  // Petpooja confirmed they've removed these from the PO webhook push entirely —
  // no longer sent, no longer verified (see petpoojaWebhook.controller.ts). Kept
  // optional rather than deleted in case a stray/legacy delivery still includes them.
  app_key?: string;
  app_secret?: string;
  access_token?: string;
  data: PetpoojaPurchaseOrderWebhookData;
}
