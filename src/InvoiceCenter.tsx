import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  LoaderCircle,
  PencilLine,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import type {
  AppUser,
  InvoiceDetail,
  InvoiceDocumentFields,
  InvoiceItemFields,
  InvoiceListData,
  InvoiceListItem,
  InvoiceSource,
  InvoiceValidationStatus,
} from "./types";

type FieldKind =
  | "text"
  | "date"
  | "datetime"
  | "number"
  | "textarea"
  | "select"
  | "boolean"
  | "array"
  | "json";
type FieldDefinition = {
  key: string;
  label: string;
  kind?: FieldKind;
  wide?: boolean;
  options?: Array<{ value: string; label: string }>;
  stockCritical?: boolean;
};

const headerGroups: Array<{
  title: string;
  subtitle: string;
  fields: FieldDefinition[];
}> = [
  {
    title: "Identificação fiscal",
    subtitle: "Dados que identificam o documento no DANFE.",
    fields: [
      {
        key: "document_type",
        label: "Tipo do documento",
        kind: "select",
        options: ["", "NFE", "NFCE", "NFSE", "CFE_SAT", "OTHER"].map(
          (value) => ({ value, label: value || "Não informado" }),
        ),
      },
      { key: "document_model", label: "Modelo" },
      { key: "invoice_number", label: "Número da nota" },
      { key: "invoice_series", label: "Série" },
      { key: "issued_on", label: "Data de emissão", kind: "date" },
      { key: "operation_nature", label: "Natureza da operação", wide: true },
      {
        key: "operation_direction",
        label: "Direção impressa",
        kind: "select",
        options: [
          { value: "", label: "Não informada" },
          { value: "0", label: "0 · Entrada" },
          { value: "1", label: "1 · Saída" },
        ],
      },
      { key: "order_reference", label: "Referência do pedido" },
      { key: "access_key", label: "Chave de acesso validada", wide: true },
      {
        key: "access_key_raw",
        label: "Chave exatamente como foi lida",
        wide: true,
      },
    ],
  },
  {
    title: "Emitente e destinatário",
    subtitle: "Partes identificadas durante a leitura.",
    fields: [
      { key: "issuer_name", label: "Razão social do emitente", wide: true },
      { key: "issuer_tax_id", label: "CNPJ/CPF do emitente" },
      { key: "recipient_name", label: "Nome do destinatário", wide: true },
      { key: "recipient_tax_id", label: "CNPJ/CPF do destinatário" },
      {
        key: "delivery_address",
        label: "Endereço de entrega",
        kind: "textarea",
        wide: true,
      },
      { key: "carrier_name", label: "Transportadora", wide: true },
    ],
  },
  {
    title: "Totais da nota",
    subtitle: "Valores financeiros extraídos do documento.",
    fields: [
      { key: "products_total", label: "Total dos produtos", kind: "number" },
      { key: "invoice_total", label: "Total da nota", kind: "number" },
      { key: "freight_total", label: "Frete", kind: "number" },
      { key: "discount_total", label: "Desconto", kind: "number" },
      { key: "other_expenses_total", label: "Outras despesas", kind: "number" },
      { key: "insurance_total", label: "Seguro", kind: "number" },
    ],
  },
  {
    title: "Autorização e observações",
    subtitle: "Metadados complementares da leitura.",
    fields: [
      { key: "authorization_protocol", label: "Protocolo de autorização" },
      {
        key: "authorization_at_local",
        label: "Data/hora da autorização",
        kind: "datetime",
      },
      {
        key: "additional_info",
        label: "Informações adicionais",
        kind: "textarea",
        wide: true,
      },
      { key: "image_partial", label: "Imagem parcial", kind: "boolean" },
      {
        key: "unreadable_fields",
        label: "Campos ilegíveis",
        kind: "array",
        wide: true,
      },
      {
        key: "review_issues",
        label: "Pendências de revisão",
        kind: "array",
        wide: true,
      },
    ],
  },
];

const itemFields: FieldDefinition[] = [
  { key: "line_number", label: "Linha" },
  { key: "supplier_product_code", label: "Código do fornecedor" },
  { key: "gtin", label: "GTIN / código de barras" },
  { key: "description", label: "Descrição", wide: true, stockCritical: true },
  { key: "quantity", label: "Quantidade", kind: "number", stockCritical: true },
  { key: "unit", label: "Unidade", stockCritical: true },
  { key: "batch_number", label: "Lote", stockCritical: true },
  { key: "expires_on", label: "Validade", kind: "date", stockCritical: true },
  {
    key: "unit_price",
    label: "Preço unitário",
    kind: "number",
    stockCritical: true,
  },
  {
    key: "line_total",
    label: "Total da linha",
    kind: "number",
    stockCritical: true,
  },
  { key: "discount_amount", label: "Desconto", kind: "number" },
  { key: "freight_amount", label: "Frete", kind: "number" },
  { key: "other_expenses_amount", label: "Outras despesas", kind: "number" },
  { key: "ncm", label: "NCM" },
  { key: "cfop", label: "CFOP" },
  { key: "icms_base", label: "Base de ICMS", kind: "number" },
  { key: "icms_amount", label: "Valor do ICMS", kind: "number" },
  { key: "icms_rate", label: "Alíquota de ICMS (%)", kind: "number" },
  { key: "ipi_amount", label: "Valor do IPI", kind: "number" },
  { key: "ipi_rate", label: "Alíquota de IPI (%)", kind: "number" },
  {
    key: "additional_info",
    label: "Informações adicionais",
    kind: "textarea",
    wide: true,
  },
  {
    key: "unreadable_fields",
    label: "Campos ilegíveis",
    kind: "array",
    wide: true,
  },
  {
    key: "review_issues",
    label: "Pendências do item",
    kind: "array",
    wide: true,
  },
  {
    key: "tax_details",
    label: "Detalhes tributários adicionais (JSON)",
    kind: "json",
    wide: true,
  },
];

const statusCopy: Record<InvoiceValidationStatus, string> = {
  pending: "Pendente",
  approved: "Validada",
  rejected: "Rejeitada",
};

const date = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
});
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function InvoiceCenter({
  user,
  demoMode,
  onToast,
}: {
  user: AppUser;
  demoMode: boolean;
  onToast: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceValidationStatus | "all">(
    "pending",
  );
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InvoiceListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    if (demoMode) {
      setData(demoInvoiceList(search, status, page));
      setLoading(false);
      return;
    }
    const { data: result, error } = await supabase!.rpc(
      "agrolico_inventory_invoices_v1",
      {
        p_search: search,
        p_status: status,
        p_page: page,
        p_page_size: 20,
      },
    );
    if (error) onToast(error.message);
    else setData(result as InvoiceListData);
    setLoading(false);
  }, [demoMode, onToast, page, search, status]);

  useEffect(() => {
    const timer = setTimeout(load, 220);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="invoice-center view-stack">
      <section
        className="invoice-summary-grid"
        aria-label="Resumo das notas fiscais"
      >
        <InvoiceMetric
          label="Pendentes"
          value={data?.summary.pending ?? 0}
          tone="pending"
          icon={<Clock3 />}
          onClick={() => {
            setStatus("pending");
            setPage(1);
          }}
        />
        <InvoiceMetric
          label="Validadas"
          value={data?.summary.approved ?? 0}
          tone="approved"
          icon={<FileCheck2 />}
          onClick={() => {
            setStatus("approved");
            setPage(1);
          }}
        />
        <InvoiceMetric
          label="Rejeitadas"
          value={data?.summary.rejected ?? 0}
          tone="rejected"
          icon={<XCircle />}
          onClick={() => {
            setStatus("rejected");
            setPage(1);
          }}
        />
        <InvoiceMetric
          label="Total recebido"
          value={data?.summary.total ?? 0}
          icon={<FileText />}
          onClick={() => {
            setStatus("all");
            setPage(1);
          }}
        />
      </section>

      <section
        className="invoice-toolbar"
        aria-label="Filtros das notas fiscais"
      >
        <div className="search-box">
          <Search />
          <input
            aria-label="Buscar notas fiscais"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar número, fornecedor, CNPJ ou chave..."
          />
          {search && (
            <button aria-label="Limpar busca" onClick={() => setSearch("")}>
              <X />
            </button>
          )}
        </div>
        <label className="filter-select">
          <ShieldCheck />
          <select
            aria-label="Filtrar validação"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as InvoiceValidationStatus | "all");
              setPage(1);
            }}
          >
            <option value="pending">Pendentes de validação</option>
            <option value="approved">Validadas</option>
            <option value="rejected">Rejeitadas</option>
            <option value="all">Todas as notas</option>
          </select>
        </label>
      </section>

      <section className="panel invoice-table-panel">
        <header>
          <div>
            <p className="eyebrow">CENTRAL FISCAL</p>
            <h2>Notas recebidas pelo AgroLico</h2>
          </div>
          <span className="audit-note">
            <ShieldCheck />
            Leitura original preservada
          </span>
        </header>
        {loading && !data ? (
          <div className="invoice-loading">
            <LoaderCircle className="spin" />
            Buscando notas fiscais...
          </div>
        ) : !data?.invoices.length ? (
          <div className="invoice-empty">
            <FileText />
            <strong>Nenhuma nota encontrada</strong>
            <span>
              Ajuste o filtro ou aguarde o recebimento de uma nova nota pelo
              WhatsApp.
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Nota fiscal</th>
                  <th>Fornecedor</th>
                  <th>Emissão</th>
                  <th>Itens</th>
                  <th>Valor</th>
                  <th>Pendências</th>
                  <th>
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onOpen={() => setSelectedId(invoice.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.page_count > 1 && (
          <footer className="pagination">
            <span>
              Página {data.page} de {data.page_count} · {data.total} notas
            </span>
            <div>
              <button
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft />
                Anterior
              </button>
              <button
                disabled={page >= data.page_count}
                onClick={() => setPage((value) => value + 1)}
              >
                Próxima
                <ChevronRight />
              </button>
            </div>
          </footer>
        )}
      </section>
      {selectedId && (
        <InvoiceReviewModal
          documentId={selectedId}
          user={user}
          demoMode={demoMode}
          onClose={() => setSelectedId(null)}
          onChanged={() => {
            load();
            onToast("Central de notas fiscais atualizada.");
          }}
        />
      )}
    </div>
  );
}

function InvoiceMetric({
  label,
  value,
  tone = "",
  icon,
  onClick,
}: {
  label: string;
  value: number;
  tone?: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={`invoice-metric ${tone}`} onClick={onClick}>
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </button>
  );
}

function InvoiceRow({
  invoice,
  onOpen,
}: {
  invoice: InvoiceListItem;
  onOpen: () => void;
}) {
  const pendingCount =
    invoice.unreadable_count +
    invoice.issue_count +
    (invoice.image_partial ? 1 : 0);
  return (
    <tr
      className="invoice-click-row"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      tabIndex={0}
    >
      <td className="invoice-mobile-cell" colSpan={8}>
        <span className="invoice-mobile-topline">
          <strong>NF {invoice.invoice_number || "sem número"}</strong>
          <InvoiceStatus status={invoice.panel_validation_status} />
        </span>
        <span className="invoice-mobile-supplier">
          {invoice.issuer_name || "Emitente não identificado"}
        </span>
        <span className="invoice-mobile-meta">
          <small>
            {invoice.issued_on
              ? date.format(new Date(`${invoice.issued_on}T12:00:00`))
              : "Sem data"}
          </small>
          <small>{invoice.item_count} itens</small>
          <b>
            {invoice.invoice_total == null
              ? "Sem valor"
              : money.format(invoice.invoice_total)}
          </b>
          {pendingCount > 0 && <em>{pendingCount} pendência(s)</em>}
        </span>
        <ChevronRight className="invoice-mobile-chevron" />
      </td>
      <td data-label="Status">
        <InvoiceStatus status={invoice.panel_validation_status} />
      </td>
      <td data-label="Nota fiscal">
        <span className="invoice-identity">
          <strong>NF {invoice.invoice_number || "sem número"}</strong>
          <small>
            {invoice.document_type || "Documento fiscal"}
            {invoice.invoice_series ? ` · Série ${invoice.invoice_series}` : ""}
          </small>
        </span>
      </td>
      <td data-label="Fornecedor">
        <span className="invoice-identity">
          <strong>{invoice.issuer_name || "Emitente não identificado"}</strong>
          <small>{formatTaxId(invoice.issuer_tax_id)}</small>
        </span>
      </td>
      <td data-label="Emissão">
        {invoice.issued_on ? (
          date.format(new Date(`${invoice.issued_on}T12:00:00`))
        ) : (
          <span className="muted">Não informada</span>
        )}
      </td>
      <td data-label="Itens">
        <strong>{invoice.item_count}</strong>
        <small className="table-subline">
          {invoice.stocked_item_count} no estoque
        </small>
      </td>
      <td data-label="Valor">
        <strong>
          {invoice.invoice_total == null
            ? "—"
            : money.format(invoice.invoice_total)}
        </strong>
      </td>
      <td data-label="Pendências">
        {pendingCount ? (
          <span className="issue-pill">
            <AlertTriangle />
            {pendingCount}
          </span>
        ) : (
          <span className="clear-pill">
            <Check />
            Conferida
          </span>
        )}
      </td>
      <td data-label="Abrir">
        <button
          className="invoice-open"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          aria-label={`Abrir NF ${invoice.invoice_number || "sem número"}`}
        >
          <ChevronRight />
        </button>
      </td>
    </tr>
  );
}

function InvoiceReviewModal({
  documentId,
  user,
  demoMode,
  onClose,
  onChanged,
}: {
  documentId: string;
  user: AppUser;
  demoMode: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [documentForm, setDocumentForm] =
    useState<InvoiceDocumentFields | null>(null);
  const [itemsForm, setItemsForm] = useState<InvoiceItemFields[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = demoMode
      ? { data: demoInvoiceDetail(documentId), error: null }
      : await supabase!.rpc("agrolico_inventory_invoice_detail_v1", {
          p_document_id: documentId,
        });
    if (result.error) setError(result.error.message);
    else {
      const loaded = result.data as InvoiceDetail;
      setDetail(loaded);
      setDocumentForm(structuredClone(loaded.document));
      setItemsForm(structuredClone(loaded.items));
      setOpenItems(new Set(loaded.items.length ? [loaded.items[0].id] : []));
      setDirty(false);
    }
    setLoading(false);
  }, [demoMode, documentId]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  const pending = documentForm?.panel_validation_status === "pending";
  const canEdit = pending && user.role !== "viewer";
  const canReview = pending && user.role === "manager";
  const totalItems = useMemo(
    () =>
      itemsForm.reduce((sum, item) => sum + Number(item.line_total || 0), 0),
    [itemsForm],
  );

  function updateDocument(key: string, value: unknown) {
    setDocumentForm((current) =>
      current ? { ...current, [key]: value } : current,
    );
    setDirty(true);
  }
  function updateItem(id: string, key: string, value: unknown) {
    setItemsForm((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    );
    setDirty(true);
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    if (!documentForm || reason.trim().length < 5) {
      setError("Informe o motivo da correção com pelo menos 5 caracteres.");
      return;
    }
    let preparedItems: InvoiceItemFields[];
    try {
      preparedItems = itemsForm.map((item) => ({
        ...item,
        tax_details:
          typeof item.tax_details === "string"
            ? JSON.parse(item.tax_details || "{}")
            : item.tax_details,
      }));
    } catch {
      setError(
        "Os detalhes tributários precisam estar em formato JSON válido.",
      );
      return;
    }
    setSaving(true);
    if (demoMode) {
      setDetail((current) =>
        current
          ? {
              ...current,
              document: documentForm,
              items: preparedItems,
              history: [
                {
                  id: crypto.randomUUID(),
                  action: "save",
                  reason,
                  actor: user.display_name,
                  created_at: new Date().toISOString(),
                },
                ...current.history,
              ],
            }
          : current,
      );
      setDirty(false);
      setReason("");
      setSaving(false);
      onChanged();
      return;
    }
    const { data: result, error: rpcError } = await supabase!.rpc(
      "agrolico_inventory_update_invoice_v1",
      {
        p: {
          document_id: documentId,
          reason,
          document: documentForm,
          items: preparedItems,
        },
      },
    );
    if (rpcError || !result?.success)
      setError(
        rpcError?.message ||
          result?.message ||
          "Não foi possível salvar a nota.",
      );
    else {
      setReason("");
      await load();
      onChanged();
    }
    setSaving(false);
  }

  async function review(action: "approve" | "reject") {
    setError("");
    if (dirty) {
      setError("Salve as correções antes de concluir a validação.");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Informe uma justificativa com pelo menos 5 caracteres.");
      return;
    }
    setSaving(true);
    if (demoMode) {
      setDocumentForm((current) =>
        current
          ? {
              ...current,
              panel_validation_status:
                action === "approve" ? "approved" : "rejected",
            }
          : current,
      );
      setSaving(false);
      onChanged();
      return;
    }
    const { data: result, error: rpcError } = await supabase!.rpc(
      "agrolico_inventory_review_invoice_v1",
      { p: { document_id: documentId, action, reason } },
    );
    if (rpcError || !result?.success) {
      const blockers = Array.isArray(result?.blockers)
        ? ` ${result.blockers.join("; ")}.`
        : "";
      setError(
        (rpcError?.message ||
          result?.message ||
          "Não foi possível revisar a nota.") + blockers,
      );
    } else {
      await load();
      onChanged();
    }
    setSaving(false);
  }

  async function openSource(source: InvoiceSource) {
    if (demoMode) {
      setError("No modo demonstração o documento original não é aberto.");
      return;
    }
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    const { data, error: signedError } = await supabase!.storage
      .from(source.bucket)
      .createSignedUrl(source.object_path, 300);
    if (signedError || !data?.signedUrl) {
      tab?.close();
      setError(signedError?.message || "Não foi possível abrir o documento.");
      return;
    }
    if (tab) tab.location.href = data.signedUrl;
    else window.location.assign(data.signedUrl);
  }

  return (
    <div className="invoice-review-backdrop" role="presentation">
      <section
        className="invoice-review-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
      >
        <header className="invoice-review-head">
          <div>
            <p className="eyebrow">REVISÃO FISCAL</p>
            <h2 id="review-title">
              NF {documentForm?.invoice_number || "sem número"}
            </h2>
            <span>
              {documentForm?.issuer_name || "Emitente ainda não identificado"}
            </span>
          </div>
          <div className="review-head-actions">
            {documentForm && (
              <InvoiceStatus status={documentForm.panel_validation_status} />
            )}
            <button aria-label="Fechar revisão" onClick={onClose}>
              <X />
            </button>
          </div>
        </header>
        {loading ? (
          <div className="invoice-loading">
            <LoaderCircle className="spin" />
            Carregando todos os campos da nota...
          </div>
        ) : error && !detail ? (
          <div className="invoice-fatal">
            <AlertTriangle />
            <strong>Não foi possível abrir a nota</strong>
            <span>{error}</span>
            <button className="secondary-button" onClick={onClose}>
              Fechar
            </button>
          </div>
        ) : documentForm && detail ? (
          <form className="invoice-review-body" onSubmit={save}>
            <aside className="invoice-evidence">
              <div className="evidence-title">
                <FileText />
                <div>
                  <strong>Documento original</strong>
                  <span>{detail.sources.length} arquivo(s) preservado(s)</span>
                </div>
              </div>
              <div className="evidence-list">
                {detail.sources.map((source) => (
                  <button
                    type="button"
                    key={source.id}
                    onClick={() => openSource(source)}
                  >
                    <span>
                      <FileText />
                    </span>
                    <div>
                      <strong>{source.file_name}</strong>
                      <small>
                        {source.mime_type || "arquivo fiscal"} ·{" "}
                        {formatSize(source.size_bytes)}
                      </small>
                    </div>
                    <Download />
                  </button>
                ))}
                {!detail.sources.length && (
                  <p>Nenhum arquivo original foi localizado para esta nota.</p>
                )}
              </div>
              <div className="evidence-facts">
                <span>
                  Extraída em
                  <strong>{formatDateTime(documentForm.extracted_at)}</strong>
                </span>
                <span>
                  Atualizada em
                  <strong>{formatDateTime(documentForm.updated_at)}</strong>
                </span>
                <span>
                  Fluxo do estoque
                  <strong>
                    {workflowLabel(String(documentForm.workflow_status || ""))}
                  </strong>
                </span>
                <span>
                  Soma atual dos itens
                  <strong>{money.format(totalItems)}</strong>
                </span>
              </div>
              <div className="original-note">
                <ShieldCheck />
                <p>
                  <strong>A leitura original não é sobrescrita.</strong> As
                  correções alteram os campos estruturados e geram uma versão de
                  auditoria com autor, data, motivo, antes e depois.
                </p>
              </div>
              {!!detail.history.length && (
                <div className="review-history">
                  <h3>Histórico da revisão</h3>
                  {detail.history.map((entry) => (
                    <article key={entry.id}>
                      <i className={entry.action} />
                      <div>
                        <strong>
                          {historyLabel(entry.action)} · {entry.actor}
                        </strong>
                        <span>{entry.reason}</span>
                        <small>
                          {dateTime.format(new Date(entry.created_at))}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </aside>

            <main className="invoice-fields">
              {!canEdit && (
                <div className="locked-banner">
                  <ShieldCheck />
                  <div>
                    <strong>Nota protegida contra alterações</strong>
                    <span>
                      {user.role === "viewer"
                        ? "Seu perfil é somente leitura."
                        : "Esta nota já recebeu uma decisão de validação."}
                    </span>
                  </div>
                </div>
              )}
              {headerGroups.map((group) => (
                <FieldSection
                  key={group.title}
                  title={group.title}
                  subtitle={group.subtitle}
                >
                  {group.fields.map((field) => (
                    <InvoiceField
                      key={field.key}
                      field={field}
                      value={documentForm[field.key]}
                      disabled={!canEdit}
                      onChange={(value) => updateDocument(field.key, value)}
                    />
                  ))}
                </FieldSection>
              ))}

              <section className="invoice-form-section invoice-items-section">
                <header>
                  <div>
                    <p className="eyebrow">ITENS EXTRAÍDOS</p>
                    <h3>{itemsForm.length} itens na nota</h3>
                  </div>
                  <span>
                    {itemsForm.filter((item) => item.stock_registered).length}{" "}
                    já movimentaram estoque
                  </span>
                </header>
                <div className="invoice-item-list">
                  {itemsForm.map((item) => {
                    const expanded = openItems.has(item.id);
                    return (
                      <article
                        className={
                          expanded
                            ? "invoice-item-card open"
                            : "invoice-item-card"
                        }
                        key={item.id}
                      >
                        <button
                          type="button"
                          className="invoice-item-summary"
                          onClick={() =>
                            setOpenItems((current) => {
                              const next = new Set(current);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            })
                          }
                        >
                          <b>{String(item.item_index).padStart(2, "0")}</b>
                          <span>
                            <strong>
                              {String(item.description || "Item sem descrição")}
                            </strong>
                            <small>
                              {String(item.quantity ?? "—")}{" "}
                              {String(item.unit || "")} ·{" "}
                              {item.line_total == null
                                ? "sem valor"
                                : money.format(Number(item.line_total))}
                            </small>
                          </span>
                          {item.stock_registered && (
                            <em>
                              <ShieldCheck />
                              No estoque
                            </em>
                          )}
                          <ChevronDown />
                        </button>
                        {expanded && (
                          <div className="invoice-item-fields">
                            {item.stock_registered && (
                              <div className="stock-lock-note">
                                <ShieldCheck />
                                Campos que afetam o estoque estão bloqueados
                                porque este item já foi movimentado.
                              </div>
                            )}
                            {itemFields.map((field) => (
                              <InvoiceField
                                key={field.key}
                                field={field}
                                value={item[field.key]}
                                disabled={
                                  !canEdit ||
                                  (!!field.stockCritical &&
                                    item.stock_registered)
                                }
                                onChange={(value) =>
                                  updateItem(item.id, field.key, value)
                                }
                              />
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="review-decision">
                <label>
                  Motivo da correção ou decisão
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    disabled={!pending || user.role === "viewer"}
                    placeholder="Ex.: valores conferidos com o DANFE original"
                  />
                </label>
                {error && (
                  <div className="form-error" role="alert">
                    <AlertTriangle />
                    {error}
                  </div>
                )}
                <footer>
                  <div>
                    {dirty && (
                      <span className="unsaved">
                        <PencilLine />
                        Existem alterações não salvas
                      </span>
                    )}
                  </div>
                  <div>
                    {canReview && (
                      <button
                        type="button"
                        className="reject-button"
                        disabled={saving}
                        onClick={() => review("reject")}
                      >
                        <XCircle />
                        Rejeitar
                      </button>
                    )}
                    {canEdit && (
                      <button
                        className="secondary-button"
                        disabled={saving || !dirty}
                      >
                        {saving ? (
                          <LoaderCircle className="spin" />
                        ) : (
                          <PencilLine />
                        )}
                        Salvar correções
                      </button>
                    )}
                    {canReview && (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={saving || dirty}
                        onClick={() => review("approve")}
                      >
                        <FileCheck2 />
                        Validar nota
                      </button>
                    )}
                  </div>
                </footer>
              </section>
            </main>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function FieldSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="invoice-form-section">
      <header>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="invoice-form-grid">{children}</div>
    </section>
  );
}

function InvoiceField({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FieldDefinition;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const className = field.wide ? "invoice-field wide" : "invoice-field";
  const stringValue =
    field.kind === "json" && typeof value !== "string"
      ? JSON.stringify(value ?? {}, null, 2)
      : field.kind === "array" && Array.isArray(value)
        ? value.join("\n")
        : value == null
          ? ""
          : String(value);
  if (
    field.kind === "textarea" ||
    field.kind === "array" ||
    field.kind === "json"
  )
    return (
      <label className={className}>
        {field.label}
        <textarea
          disabled={disabled}
          rows={field.kind === "json" ? 6 : 3}
          value={stringValue}
          onChange={(event) =>
            onChange(
              field.kind === "array"
                ? event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                : event.target.value,
            )
          }
        />
      </label>
    );
  if (field.kind === "select")
    return (
      <label className={className}>
        {field.label}
        <select
          disabled={disabled}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  if (field.kind === "boolean")
    return (
      <label className={className}>
        {field.label}
        <select
          disabled={disabled}
          value={value == null ? "" : String(value)}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : event.target.value === "true",
            )
          }
        >
          <option value="">Não informado</option>
          <option value="false">Não · documento completo</option>
          <option value="true">Sim · imagem parcial</option>
        </select>
      </label>
    );
  const type =
    field.kind === "date"
      ? "date"
      : field.kind === "datetime"
        ? "datetime-local"
        : field.kind === "number"
          ? "number"
          : "text";
  const normalized =
    type === "datetime-local" && stringValue
      ? stringValue.slice(0, 16)
      : stringValue;
  return (
    <label className={className}>
      {field.label}
      <input
        disabled={disabled}
        type={type}
        step={type === "number" ? "any" : undefined}
        value={normalized}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function InvoiceStatus({ status }: { status: InvoiceValidationStatus }) {
  return (
    <span className={`invoice-status ${status}`}>
      <i />
      {statusCopy[status]}
    </span>
  );
}

function formatTaxId(value: string | null) {
  return value || "Documento não informado";
}
function formatDateTime(value: unknown) {
  return value ? dateTime.format(new Date(String(value))) : "Não informado";
}
function formatSize(value: string | number | null) {
  const bytes = Number(value || 0);
  if (!bytes) return "tamanho não informado";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function workflowLabel(status: string) {
  return status === "approved"
    ? "Registrada no estoque"
    : status === "rejected"
      ? "Rejeitada no fluxo"
      : "Pendente no fluxo";
}
function historyLabel(action: string) {
  return action === "approve"
    ? "Nota validada"
    : action === "reject"
      ? "Nota rejeitada"
      : "Campos corrigidos";
}

const demoDocument: InvoiceDocumentFields = {
  id: "demo-invoice-1",
  document_type: "NFE",
  document_model: "55",
  access_key: "35261012345678000123550010001303141123456789",
  access_key_raw: "35261012345678000123550010001303141123456789",
  recipient_tax_id: "12.345.678/0001-90",
  recipient_name: "AgroLico Insumos Agrícolas",
  operation_nature: "Venda de mercadoria adquirida de terceiros",
  operation_direction: 1,
  issuer_tax_id: "45.678.901/0001-22",
  issuer_name: "Distribuidora Safra Forte Ltda.",
  invoice_number: "130314",
  invoice_series: "1",
  issued_on: "2026-10-24",
  products_total: 18450,
  invoice_total: 18910,
  freight_total: 460,
  discount_total: 0,
  other_expenses_total: 0,
  insurance_total: 0,
  delivery_address: "Rodovia Rural, km 12 · Fazenda AgroLico",
  carrier_name: "TransCampo Logística",
  order_reference: "PED-2048",
  additional_info: "Mercadoria destinada a uso agrícola.",
  authorization_protocol: "135260001234567",
  authorization_at_local: "2026-10-24T14:32:00",
  image_partial: false,
  unreadable_fields: [],
  review_issues: [],
  panel_validation_status: "pending",
  workflow_status: "pending",
  reviewed_at: null,
  created_at: "2026-10-24T17:35:00Z",
  updated_at: "2026-10-24T17:35:00Z",
  extracted_at: "2026-10-24T17:34:00Z",
  panel_validated_at: null,
};
const demoItems: InvoiceItemFields[] = [
  {
    id: "demo-item-1",
    item_index: 1,
    line_number: "1",
    supplier_product_code: "HERB-20L",
    gtin: "7891234567890",
    description: "Herbicida Campo Forte",
    quantity: 12,
    unit: "L",
    batch_number: "LT-M1",
    expires_on: "2027-02-23",
    unit_price: 86.9,
    line_total: 1042.8,
    discount_amount: 0,
    freight_amount: 30,
    other_expenses_amount: 0,
    ncm: "38089329",
    cfop: "5102",
    icms_base: 1042.8,
    icms_amount: 187.7,
    icms_rate: 18,
    ipi_amount: 0,
    ipi_rate: 0,
    tax_details: { origem: "0", cst: "00" },
    additional_info: null,
    unreadable_fields: [],
    review_issues: [],
    stock_registered: false,
  },
  {
    id: "demo-item-2",
    item_index: 2,
    line_number: "2",
    supplier_product_code: "FERT-25",
    gtin: null,
    description: "Fertilizante Foliar Premium",
    quantity: 18,
    unit: "UN",
    batch_number: "FF-1026",
    expires_on: "2027-06-30",
    unit_price: 967.07,
    line_total: 17407.2,
    discount_amount: 0,
    freight_amount: 430,
    other_expenses_amount: 0,
    ncm: "31059090",
    cfop: "5102",
    icms_base: 17407.2,
    icms_amount: 3133.3,
    icms_rate: 18,
    ipi_amount: 0,
    ipi_rate: 0,
    tax_details: {},
    additional_info: null,
    unreadable_fields: [],
    review_issues: [],
    stock_registered: true,
  },
];
function demoInvoiceDetail(id: string): InvoiceDetail {
  return {
    document: { ...demoDocument, id },
    items: structuredClone(demoItems),
    sources: [
      {
        id: "source-1",
        bucket: "agrolico-nfs",
        object_path: "demo/nf-130314.pdf",
        file_name: "NF-130314.pdf",
        mime_type: "application/pdf",
        size_bytes: 842120,
        received_at: "2026-10-24T17:33:00Z",
        created_at: "2026-10-24T17:33:00Z",
      },
    ],
    history: [],
  };
}
function demoInvoiceList(
  search: string,
  status: InvoiceValidationStatus | "all",
  page: number,
): InvoiceListData {
  const base: InvoiceListItem[] = [
    {
      id: demoDocument.id,
      invoice_number: "130314",
      invoice_series: "1",
      document_type: "NFE",
      issuer_name: String(demoDocument.issuer_name),
      issuer_tax_id: String(demoDocument.issuer_tax_id),
      issued_on: String(demoDocument.issued_on),
      invoice_total: Number(demoDocument.invoice_total),
      panel_validation_status: "pending",
      workflow_status: "pending",
      image_partial: false,
      unreadable_count: 0,
      issue_count: 0,
      item_count: 2,
      source_count: 1,
      stocked_item_count: 1,
      created_at: String(demoDocument.created_at),
      updated_at: String(demoDocument.updated_at),
      panel_validated_at: null,
    },
  ];
  const query = search.toLocaleLowerCase("pt-BR");
  const invoices = base.filter(
    (item) =>
      (status === "all" || item.panel_validation_status === status) &&
      `${item.invoice_number} ${item.issuer_name} ${item.issuer_tax_id}`
        .toLocaleLowerCase("pt-BR")
        .includes(query),
  );
  return {
    summary: { total: 5, pending: 2, approved: 2, rejected: 1 },
    invoices,
    total: invoices.length,
    page,
    page_size: 20,
    page_count: 1,
  };
}
