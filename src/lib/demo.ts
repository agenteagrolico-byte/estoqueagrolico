import type {
  DashboardData,
  InventoryDocument,
  Movement,
  StockItem,
  StockStatus,
} from "../types";

const now = new Date();
const isoDate = (days: number) => {
  const value = new Date(now);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};
const isoTime = (hoursAgo: number) =>
  new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();

let items: StockItem[] = [
  demoItem(
    "Herbicida Campo Forte",
    42,
    "L",
    86.9,
    "LT-2418",
    240,
    12,
    "Galpão A · P1",
  ),
  demoItem(
    "Fertilizante Foliar Premium",
    18,
    "UN",
    54.5,
    "FF-1026",
    24,
    20,
    "Galpão A · P3",
  ),
  demoItem(
    "Inseticida Proteção Max",
    7.5,
    "L",
    178.4,
    "IP-0881",
    12,
    5,
    "Armário controlado",
  ),
  demoItem("Adjuvante Agrícola", 3, "BD20", 315, "ADJ-904", 95, 4, "Galpão B"),
  demoItem(
    "Semente de Cobertura",
    120,
    "KG",
    12.8,
    "SC-26A",
    310,
    40,
    "Depósito seco",
  ),
  demoItem(
    "Fungicida Safra",
    6,
    "L",
    229.9,
    "FG-117",
    -8,
    2,
    "Armário controlado",
  ),
  demoItem(
    "Óleo Mineral Agrícola",
    0,
    "L",
    18.75,
    "OM-2026",
    180,
    5,
    "Galpão B",
  ),
  demoItem(
    "Corretivo Micronutrientes",
    28,
    "KG",
    31.2,
    null,
    420,
    10,
    "Galpão A · P4",
  ),
];

let movements: Movement[] = [
  movement(
    "m1",
    2,
    "entrada",
    "Herbicida Campo Forte",
    12,
    "L",
    "Recebimento de mercadoria",
  ),
  movement(
    "m2",
    8,
    "out",
    "Fertilizante Foliar Premium",
    -4,
    "UN",
    "Aplicação no talhão norte",
  ),
  movement(
    "m3",
    18,
    "entrada",
    "Semente de Cobertura",
    50,
    "KG",
    "Entrada por nota fiscal",
  ),
  movement(
    "m4",
    30,
    "set",
    "Adjuvante Agrícola",
    -1,
    "BD20",
    "Conferência de inventário",
  ),
  movement(
    "m5",
    48,
    "out",
    "Óleo Mineral Agrícola",
    -5,
    "L",
    "Uso operacional",
  ),
];

const demoDocuments = new Map<string, InventoryDocument[]>();
items.forEach((item, index) => {
  if (index < 6)
    demoDocuments.set(item.stock_item_id, [
      {
        id: `demo-doc-${index}`,
        bucket: "demo",
        object_path: "",
        file_name: `NF-demo-${String(index + 1).padStart(3, "0")}.pdf`,
        mime_type: "application/pdf",
        size_bytes: 184_320 + index * 17_240,
        source: "nota_fiscal",
        created_at: isoTime(240 - index * 8),
      },
    ]);
});

function demoItem(
  description: string,
  quantity: number,
  unit: string,
  unitPrice: number,
  batch: string | null,
  expiryDays: number,
  minimum: number,
  location: string,
): StockItem {
  const id = crypto.randomUUID();
  return {
    stock_item_id: id,
    description,
    quantity,
    unit,
    batch_number: batch,
    expires_on: isoDate(expiryDays),
    unit_price: unitPrice,
    sale_unit_price: Number((unitPrice * 1.6).toFixed(6)),
    line_total: quantity * unitPrice,
    sale_line_total: quantity * unitPrice * 1.6,
    minimum_quantity: minimum,
    location,
    notes: null,
    source_type: "AVULSO",
    source_label: "Demonstração",
    status: statusFor(quantity, minimum, expiryDays, false),
    days_to_expiry: expiryDays,
    created_at: isoTime(240),
    updated_at: isoTime(2),
  };
}

function movement(
  id: string,
  hoursAgo: number,
  type: string,
  description: string,
  delta: number,
  unit: string,
  reason: string,
): Movement {
  const viaWhatsApp = id === "m3";
  const quantityBefore = delta >= 0 ? 30 : 22;
  return {
    id,
    occurred_at: isoTime(hoursAgo),
    movement_type: type,
    description,
    quantity_delta: delta,
    unit,
    actor: viaWhatsApp ? "Usuário via WhatsApp" : "Marina AgroLico",
    actor_email: viaWhatsApp ? null : "marina@agrolico.com.br",
    actor_role: viaWhatsApp ? null : "manager",
    reason,
    source: viaWhatsApp ? "WhatsApp / NF" : "Painel web",
    stock_item_id: null,
    quantity_before: quantityBefore,
    quantity_after: quantityBefore + delta,
    batch_number: id === "m5" ? "OM-2026" : `LT-${id.toUpperCase()}`,
    expires_on: isoDate(id === "m5" ? 180 : 120),
    unit_price: id === "m3" ? 12.8 : 86.9,
    location: viaWhatsApp ? "Depósito seco" : "Galpão A",
    source_type: viaWhatsApp ? "NF" : "AVULSO",
    item_created_at: isoTime(240),
    changed_fields: type === "set" ? ["Saldo definido"] : ["Saldo"],
    reference: viaWhatsApp ? "NF 130314" : "Operação administrativa",
    channel: viaWhatsApp ? "whatsapp" : "painel",
  };
}

function statusFor(
  quantity: number,
  minimum: number,
  days: number | null,
  archived: boolean,
): StockStatus {
  if (archived) return "archived";
  if (quantity <= 0) return "out_of_stock";
  if (days !== null && days < 0) return "expired";
  if (days !== null && days <= 30) return "expiring";
  if (minimum > 0 && quantity <= minimum) return "low";
  return "ok";
}

function refresh(item: StockItem): StockItem {
  const days = item.expires_on
    ? Math.ceil(
        (new Date(`${item.expires_on}T12:00:00`).getTime() -
          new Date().setHours(12, 0, 0, 0)) /
          86_400_000,
      )
    : null;
  const archived = item.status === "archived";
  return {
    ...item,
    days_to_expiry: days,
    status: statusFor(item.quantity, item.minimum_quantity, days, archived),
    line_total: item.quantity * item.unit_price,
    sale_line_total: item.quantity * item.sale_unit_price,
    updated_at: new Date().toISOString(),
  };
}

export function getDemoDashboard(
  search: string,
  filter: string,
  page: number,
  pageSize = 12,
): DashboardData {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const refreshed = items.map(refresh);
  const filtered = refreshed.filter((item) => {
    const matches =
      !query ||
      [item.description, item.batch_number, item.location].some((value) =>
        value?.toLocaleLowerCase("pt-BR").includes(query),
      );
    const statusMatches =
      filter === "all" ||
      (filter === "active"
        ? item.status !== "archived"
        : item.status === filter);
    return matches && statusMatches;
  });
  const active = refreshed.filter((item) => item.status !== "archived");
  const start = (page - 1) * pageSize;
  return {
    summary: {
      sku_count: new Set(
        active
          .filter((item) => item.quantity > 0)
          .map((item) => `${item.description}|${item.unit}`),
      ).size,
      lot_count: active.filter((item) => item.quantity > 0).length,
      inventory_value: active.reduce((sum, item) => sum + item.line_total, 0),
      sale_inventory_value: active.reduce(
        (sum, item) => sum + item.sale_line_total,
        0,
      ),
      low_count: active.filter((item) => item.status === "low").length,
      expiring_count: active.filter((item) => item.status === "expiring")
        .length,
      expired_count: active.filter((item) => item.status === "expired").length,
      out_count: active.filter((item) => item.status === "out_of_stock").length,
    },
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    page_size: pageSize,
    page_count: Math.max(1, Math.ceil(filtered.length / pageSize)),
  };
}

export function getDemoMovements(search: string): Movement[] {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  return movements.filter(
    (item) =>
      !query ||
      [
        item.description,
        item.actor,
        item.batch_number,
        item.reason,
        item.reference,
      ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(query)),
  );
}

export function mutateDemo(payload: Record<string, unknown>) {
  const action = String(payload.action);
  if (action === "create") {
    const quantity = Number(payload.quantity || 0);
    const unitPrice = Number(payload.unit_price || 0);
    const item: StockItem = refresh({
      stock_item_id: crypto.randomUUID(),
      description: String(payload.description),
      quantity,
      unit: String(payload.unit),
      batch_number: payload.batch_number ? String(payload.batch_number) : null,
      expires_on: payload.expires_on ? String(payload.expires_on) : null,
      unit_price: unitPrice,
      sale_unit_price: Number(payload.sale_unit_price || unitPrice * 1.6),
      line_total: quantity * unitPrice,
      sale_line_total:
        quantity * Number(payload.sale_unit_price || unitPrice * 1.6),
      minimum_quantity: Number(payload.minimum_quantity || 0),
      location: payload.location ? String(payload.location) : null,
      notes: payload.notes ? String(payload.notes) : null,
      source_type: "AVULSO",
      source_label: "Demonstração",
      status: "ok",
      days_to_expiry: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    items = [item, ...items];
    addMovement(
      item,
      "create",
      quantity,
      String(payload.reason || "Cadastro pelo painel"),
    );
    return { success: true, stock_item_id: item.stock_item_id };
  }
  const index = items.findIndex(
    (item) => item.stock_item_id === payload.stock_item_id,
  );
  if (index < 0)
    return { success: false, message: "Item de demonstração não encontrado." };
  const current = items[index];
  if (action === "edit") {
    items[index] = refresh({
      ...current,
      description: String(payload.description),
      unit: String(payload.unit),
      batch_number: payload.batch_number ? String(payload.batch_number) : null,
      expires_on: payload.expires_on ? String(payload.expires_on) : null,
      unit_price: Number(payload.unit_price || 0),
      sale_unit_price: Number(payload.sale_unit_price || 0),
      minimum_quantity: Number(payload.minimum_quantity || 0),
      location: payload.location ? String(payload.location) : null,
      notes: payload.notes ? String(payload.notes) : null,
    });
    addMovement(
      items[index],
      "edit",
      0,
      String(payload.reason || "Edição demonstrativa"),
    );
  } else if (action === "adjust") {
    const amount = Number(payload.quantity || 0);
    const direction = String(payload.direction);
    const next =
      direction === "in"
        ? current.quantity + amount
        : direction === "out"
          ? current.quantity - amount
          : amount;
    if (next < 0)
      return {
        success: false,
        message: "A saída é maior que o saldo disponível.",
      };
    const delta = next - current.quantity;
    items[index] = refresh({ ...current, quantity: next });
    addMovement(items[index], direction, delta, String(payload.reason));
  } else if (action === "archive") {
    if (current.quantity !== 0)
      return {
        success: false,
        message: "Zere o saldo antes de arquivar o item.",
      };
    items[index] = {
      ...current,
      status: "archived",
      updated_at: new Date().toISOString(),
    };
    addMovement(
      items[index],
      "archive",
      0,
      String(payload.reason || "Arquivado"),
    );
  }
  return { success: true };
}

export function attachDemoDocuments(stockItemId: string, files: File[]) {
  const current = demoDocuments.get(stockItemId) ?? [];
  const additions = files.map((file) => ({
    id: crypto.randomUUID(),
    bucket: "demo",
    object_path: "",
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    source: "painel" as const,
    created_at: new Date().toISOString(),
  }));
  demoDocuments.set(stockItemId, [...additions, ...current]);
}

export function getDemoDocuments(stockItemId: string): InventoryDocument[] {
  return demoDocuments.get(stockItemId) ?? [];
}

function addMovement(
  item: StockItem,
  type: string,
  delta: number,
  reason: string,
) {
  movements = [
    {
      id: crypto.randomUUID(),
      occurred_at: new Date().toISOString(),
      movement_type: type,
      description: item.description,
      quantity_delta: delta,
      unit: item.unit,
      actor: "Você · modo demo",
      reason,
      source: "Demonstração",
      stock_item_id: item.stock_item_id,
    },
    ...movements,
  ];
}
