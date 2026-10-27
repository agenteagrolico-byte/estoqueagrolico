import type { StockItem, Summary } from "../types";

type InventoryExportData = {
  items: StockItem[];
  summary: Summary;
  generatedBy: string;
};

const forest = "173D27";
const forestLight = "2D7040";
const paper = "F7F9F3";
const line = "DCE4D8";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const date = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
});
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

const statusLabels: Record<StockItem["status"], string> = {
  ok: "Em dia",
  low: "Estoque baixo",
  expiring: "Vence em breve",
  expired: "Vencido",
  out_of_stock: "Sem saldo",
  archived: "Arquivado",
};

function filename(extension: "xlsx" | "pdf") {
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  return `estoque-agrolico-${stamp}.${extension}`;
}

function formatDate(value: string | null) {
  return value ? date.format(new Date(`${value}T12:00:00`)) : "Não informada";
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function logoDataUrl() {
  const response = await fetch("/logoagrolico.jpg");
  if (!response.ok)
    throw new Error("Não foi possível carregar o logotipo da AgroLico.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Não foi possível preparar o logotipo."));
    reader.readAsDataURL(blob);
  });
}

export async function exportInventoryXlsx({
  items,
  summary,
  generatedBy,
}: InventoryExportData) {
  const [{ Workbook }, logo] = await Promise.all([
    import("exceljs"),
    logoDataUrl(),
  ]);
  const workbook = new Workbook();
  workbook.creator = "AgroLico - Gestão de estoque";
  workbook.company = "AgroLico";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Estoque atual", {
    views: [{ state: "frozen", ySplit: 10 }],
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  sheet.columns = [
    { key: "description", width: 34 },
    { key: "quantity", width: 13 },
    { key: "unit", width: 10 },
    { key: "batch", width: 16 },
    { key: "expiry", width: 15 },
    { key: "unitPrice", width: 16 },
    { key: "total", width: 17 },
    { key: "minimum", width: 14 },
    { key: "location", width: 24 },
    { key: "source", width: 17 },
    { key: "status", width: 18 },
    { key: "notes", width: 30 },
    { key: "updatedAt", width: 19 },
  ];

  const imageId = workbook.addImage({ base64: logo, extension: "jpeg" });
  sheet.addImage(imageId, {
    tl: { col: 0.18, row: 0.2 },
    ext: { width: 74, height: 74 },
  });
  sheet.mergeCells("C1:M2");
  sheet.getCell("C1").value = "RELATÓRIO DE ESTOQUE ATUAL";
  sheet.getCell("C1").font = {
    name: "Arial",
    size: 21,
    bold: true,
    color: { argb: `FF${forest}` },
  };
  sheet.getCell("C1").alignment = { vertical: "middle" };
  sheet.mergeCells("C3:M3");
  sheet.getCell("C3").value = "AGROLICO · GESTÃO CONECTADA AO CAMPO";
  sheet.getCell("C3").font = {
    name: "Arial",
    size: 10,
    bold: true,
    color: { argb: `FF${forestLight}` },
  };
  sheet.mergeCells("C4:M4");
  sheet.getCell("C4").value =
    `Gerado em ${dateTime.format(new Date())} por ${generatedBy}`;
  sheet.getCell("C4").font = {
    name: "Arial",
    size: 9,
    color: { argb: "FF647267" },
  };
  sheet.getRow(1).height = 28;
  sheet.getRow(2).height = 28;
  sheet.getRow(3).height = 19;
  sheet.getRow(4).height = 19;

  const summaries = [
    [
      "A6:C6",
      "A7:C7",
      "Valor em estoque",
      money.format(summary.inventory_value),
    ],
    ["D6:F6", "D7:F7", "Produtos ativos", String(summary.sku_count)],
    ["G6:I6", "G7:I7", "Lotes com saldo", String(summary.lot_count)],
    [
      "J6:M6",
      "J7:M7",
      "Alertas",
      String(
        summary.low_count +
          summary.expiring_count +
          summary.expired_count +
          summary.out_count,
      ),
    ],
  ];
  summaries.forEach(([labelRange, valueRange, label, value]) => {
    sheet.mergeCells(labelRange);
    sheet.mergeCells(valueRange);
    const labelCell = sheet.getCell(labelRange.split(":")[0]);
    const valueCell = sheet.getCell(valueRange.split(":")[0]);
    labelCell.value = label;
    valueCell.value = value;
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${forest}` },
    };
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${paper}` },
    };
    labelCell.font = {
      name: "Arial",
      size: 9,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    valueCell.font = {
      name: "Arial",
      size: 15,
      bold: true,
      color: { argb: `FF${forest}` },
    };
    labelCell.alignment = valueCell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    [labelCell, valueCell].forEach((cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: `FF${line}` } } };
    });
  });
  sheet.getRow(6).height = 22;
  sheet.getRow(7).height = 30;

  const headers = [
    "Produto",
    "Quantidade",
    "Unidade",
    "Lote",
    "Validade",
    "Preço unitário",
    "Valor total",
    "Estoque mínimo",
    "Localização",
    "Origem",
    "Status",
    "Observações",
    "Última atualização",
  ];
  const headerRow = sheet.getRow(10);
  headerRow.values = headers;
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${forest}` },
    };
    cell.font = {
      name: "Arial",
      size: 9,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  items.forEach((item, index) => {
    const row = sheet.addRow([
      item.description,
      item.quantity,
      item.unit,
      item.batch_number || "Sem lote",
      formatDate(item.expires_on),
      item.unit_price,
      item.line_total,
      item.minimum_quantity,
      item.location || "Não informada",
      item.source_label,
      statusLabels[item.status],
      item.notes || "",
      dateTime.format(new Date(item.updated_at)),
    ]);
    row.height = 23;
    row.eachCell((cell) => {
      cell.font = { name: "Arial", size: 9, color: { argb: `FF${forest}` } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 ? "FFF7F9F3" : "FFFFFFFF" },
      };
      cell.border = { bottom: { style: "hair", color: { argb: `FF${line}` } } };
    });
    row.getCell(2).numFmt = "#,##0.0000";
    row.getCell(6).numFmt = "R$ #,##0.00";
    row.getCell(7).numFmt = "R$ #,##0.00";
    row.getCell(8).numFmt = "#,##0.0000";
    const statusCell = row.getCell(11);
    statusCell.font = {
      name: "Arial",
      size: 9,
      bold: true,
      color: {
        argb:
          item.status === "expired"
            ? "FF9A3C31"
            : item.status === "ok"
              ? `FF${forestLight}`
              : "FF855B00",
      },
    };
  });

  sheet.autoFilter = { from: "A10", to: `M${Math.max(10, 10 + items.length)}` };
  sheet.getRow(10).eachCell((cell) => {
    cell.protection = { locked: true };
  });
  sheet.headerFooter.oddFooter =
    "&LAgroLico · Gestão de estoque&CRelatório confidencial&R&P de &N";
  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename("xlsx"),
  );
}

export async function exportInventoryPdf({
  items,
  summary,
  generatedBy,
}: InventoryExportData) {
  const [{ jsPDF }, autoTableModule, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    logoDataUrl(),
  ]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  doc.setProperties({
    title: "Estoque atual AgroLico",
    subject: "Relatório completo do estoque atual",
    author: "AgroLico",
  });

  const drawHeader = () => {
    doc.setFillColor(23, 61, 39);
    doc.rect(0, 0, 297, 24, "F");
    doc.setFillColor(180, 214, 0);
    doc.rect(0, 0, 4, 24, "F");
    doc.addImage(logo, "JPEG", 10, 3, 18, 18);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("RELATÓRIO DE ESTOQUE ATUAL", 34, 10);
    doc.setTextColor(215, 229, 215);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `AGROLICO · Gerado em ${dateTime.format(new Date())} por ${generatedBy}`,
      34,
      16,
    );
  };

  drawHeader();
  const summaryCards = [
    ["VALOR EM ESTOQUE", money.format(summary.inventory_value)],
    ["PRODUTOS ATIVOS", String(summary.sku_count)],
    ["LOTES COM SALDO", String(summary.lot_count)],
    [
      "ALERTAS",
      String(
        summary.low_count +
          summary.expiring_count +
          summary.expired_count +
          summary.out_count,
      ),
    ],
  ];
  summaryCards.forEach(([label, value], index) => {
    const x = 10 + index * 70;
    doc.setFillColor(247, 249, 243);
    doc.setDrawColor(220, 228, 216);
    doc.roundedRect(x, 29, 65, 15, 2, 2, "FD");
    doc.setTextColor(80, 100, 86);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(label, x + 4, 34.5);
    doc.setTextColor(23, 61, 39);
    doc.setFontSize(11);
    doc.text(value, x + 4, 41);
  });

  autoTable(doc, {
    startY: 49,
    margin: { top: 29, right: 8, bottom: 14, left: 8 },
    head: [
      [
        "Produto",
        "Quantidade",
        "Un.",
        "Lote",
        "Validade",
        "Preço unit.",
        "Valor",
        "Mínimo",
        "Localização",
        "Origem",
        "Status",
        "Observações",
      ],
    ],
    body: items.map((item) => [
      item.description,
      number.format(item.quantity),
      item.unit,
      item.batch_number || "—",
      formatDate(item.expires_on),
      money.format(item.unit_price),
      money.format(item.line_total),
      number.format(item.minimum_quantity),
      item.location || "—",
      item.source_label,
      statusLabels[item.status],
      item.notes || "—",
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6.4,
      cellPadding: 1.7,
      textColor: [28, 58, 39],
      lineColor: [220, 228, 216],
      lineWidth: 0.15,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [23, 61, 39],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.5,
      minCellHeight: 7,
    },
    alternateRowStyles: { fillColor: [247, 249, 243] },
    columnStyles: {
      0: { cellWidth: 37 },
      1: { cellWidth: 16, halign: "right" },
      2: { cellWidth: 10 },
      3: { cellWidth: 17 },
      4: { cellWidth: 17 },
      5: { cellWidth: 19, halign: "right" },
      6: { cellWidth: 19, halign: "right" },
      7: { cellWidth: 14, halign: "right" },
      8: { cellWidth: 27 },
      9: { cellWidth: 18 },
      10: { cellWidth: 20 },
      11: { cellWidth: 34 },
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) drawHeader();
    },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(180, 214, 0);
    doc.line(8, 198, 289, 198);
    doc.setTextColor(83, 103, 89);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      "AgroLico · Gestão de estoque · Documento gerado a partir do estoque atual",
      8,
      203,
    );
    doc.text(`Página ${page} de ${pages}`, 289, 203, { align: "right" });
  }

  doc.save(filename("pdf"));
}
