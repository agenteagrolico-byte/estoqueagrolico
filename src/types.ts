export type Role = "manager" | "operator" | "viewer";
export type View =
  "overview" | "inventory" | "invoices" | "movements" | "access";

export type AppUser = {
  user_id: string;
  email: string | null;
  display_name: string;
  role: Role;
};

export type StockStatus =
  "ok" | "low" | "expiring" | "expired" | "out_of_stock" | "archived";

export type StockItem = {
  stock_item_id: string;
  description: string;
  quantity: number;
  unit: string;
  batch_number: string | null;
  expires_on: string | null;
  unit_price: number;
  sale_unit_price: number;
  line_total: number;
  sale_line_total: number;
  minimum_quantity: number;
  location: string | null;
  notes: string | null;
  source_type: "NF" | "AVULSO";
  source_label: string;
  status: StockStatus;
  days_to_expiry: number | null;
  created_at: string;
  updated_at: string;
};

export type Summary = {
  sku_count: number;
  lot_count: number;
  inventory_value: number;
  sale_inventory_value: number;
  low_count: number;
  expiring_count: number;
  expired_count: number;
  out_count: number;
};

export type DashboardData = {
  summary: Summary;
  items: StockItem[];
  total: number;
  page: number;
  page_size: number;
  page_count: number;
};

export type Movement = {
  id: string;
  occurred_at: string;
  movement_type: string;
  description: string;
  quantity_delta: number;
  unit: string;
  actor: string | null;
  reason: string | null;
  source: string;
  stock_item_id: string | null;
  actor_email?: string | null;
  actor_role?: "manager" | "operator" | "viewer" | null;
  quantity_before?: number | null;
  quantity_after?: number | null;
  batch_number?: string | null;
  expires_on?: string | null;
  unit_price?: number | null;
  location?: string | null;
  source_type?: "NF" | "AVULSO" | null;
  item_created_at?: string | null;
  changed_fields?: string[];
  reference?: string | null;
  channel?: "painel" | "whatsapp" | null;
};

export type InventoryDocument = {
  id: string;
  bucket: string;
  object_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  source: "painel" | "nota_fiscal";
  created_at: string;
};

export type ItemForm = {
  stock_item_id?: string;
  description: string;
  quantity: string;
  unit: string;
  batch_number: string;
  expires_on: string;
  unit_price: string;
  sale_unit_price: string;
  minimum_quantity: string;
  location: string;
  notes: string;
  reason: string;
};

export type InvoiceValidationStatus = "pending" | "approved" | "rejected";

export type InvoiceSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type InvoiceListItem = {
  id: string;
  invoice_number: string | null;
  invoice_series: string | null;
  document_type: string | null;
  issuer_name: string | null;
  issuer_tax_id: string | null;
  issued_on: string | null;
  invoice_total: number | null;
  panel_validation_status: InvoiceValidationStatus;
  workflow_status: string;
  image_partial: boolean | null;
  unreadable_count: number;
  issue_count: number;
  item_count: number;
  source_count: number;
  stocked_item_count: number;
  created_at: string;
  updated_at: string;
  panel_validated_at: string | null;
};

export type InvoiceListData = {
  summary: InvoiceSummary;
  invoices: InvoiceListItem[];
  total: number;
  page: number;
  page_size: number;
  page_count: number;
};

export type InvoiceSource = {
  id: string;
  bucket: string;
  object_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: string | number | null;
  received_at: string | null;
  created_at: string;
};

export type InvoiceHistoryEntry = {
  id: string;
  action: "save" | "approve" | "reject";
  reason: string;
  actor: string;
  created_at: string;
};

export type InvoiceDocumentFields = Record<string, unknown> & {
  id: string;
  invoice_number: string | null;
  invoice_series: string | null;
  issuer_name: string | null;
  panel_validation_status: InvoiceValidationStatus;
  workflow_status: string;
};

export type InvoiceItemFields = Record<string, unknown> & {
  id: string;
  item_index: number;
  description: string | null;
  stock_registered: boolean;
};

export type InvoiceDetail = {
  document: InvoiceDocumentFields;
  items: InvoiceItemFields[];
  sources: InvoiceSource[];
  history: InvoiceHistoryEntry[];
};
