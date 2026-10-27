import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Minus,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import {
  getRememberSessionPreference,
  hasSupabaseConfig,
  setRememberSessionPreference,
  supabase,
} from "./lib/supabase";
import {
  attachDemoDocuments,
  getDemoDashboard,
  getDemoDocuments,
  getDemoMovements,
  mutateDemo,
} from "./lib/demo";
import type {
  AppUser,
  DashboardData,
  InventoryDocument,
  ItemForm,
  Movement,
  StockItem,
  StockStatus,
  View,
} from "./types";
import InvoiceCenter from "./InvoiceCenter";
import {
  exportInventoryPdf,
  exportInventoryXlsx,
} from "./lib/inventory-export";
import {
  EXPIRED_SESSION_MESSAGE,
  isExpiredAuthError,
  SESSION_EXPIRED_EVENT,
} from "./lib/auth-errors";

const emptyForm: ItemForm = {
  description: "",
  quantity: "",
  unit: "UN",
  batch_number: "",
  expires_on: "",
  unit_price: "",
  sale_unit_price: "",
  minimum_quantity: "0",
  location: "",
  notes: "",
  reason: "",
};

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
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const statusLabels: Record<StockStatus, string> = {
  ok: "Em dia",
  low: "Estoque baixo",
  expiring: "Vence em breve",
  expired: "Vencido",
  out_of_stock: "Sem saldo",
  archived: "Arquivado",
};

function App() {
  const demoMode =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("demo") === "1";
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const expiringSession = useRef(false);

  const expireSession = useCallback(async () => {
    if (expiringSession.current) return;
    expiringSession.current = true;
    setAppUser(null);
    setSession(null);
    setAuthError(EXPIRED_SESSION_MESSAGE);
    setChecking(false);
    await supabase?.auth.signOut({ scope: "local" });
  }, []);

  useEffect(() => {
    if (demoMode) {
      setChecking(false);
      return;
    }
    if (!supabase) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error && isExpiredAuthError(error)) {
        void expireSession();
        return;
      }
      setSession(data.session);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        expiringSession.current = false;
        setAuthError("");
      }
    });
    return () => data.subscription.unsubscribe();
  }, [demoMode, expireSession]);

  useEffect(() => {
    if (demoMode) return;
    const handleExpiredSession = () => void expireSession();
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, [demoMode, expireSession]);

  useEffect(() => {
    if (!session || !supabase) {
      setAppUser(null);
      return;
    }
    setChecking(true);
    let active = true;
    supabase.rpc("agrolico_inventory_me_v1").then(({ data, error }) => {
      if (!active) return;
      if (error && isExpiredAuthError(error)) {
        void expireSession();
        return;
      }
      if (error) setAuthError(error.message);
      else {
        setAuthError("");
        setAppUser(data as AppUser | null);
      }
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [expireSession, session]);

  if (demoMode)
    return (
      <InventoryApp
        user={{
          user_id: "demo",
          email: "demo@agrolico.local",
          display_name: "Cliente AgroLico",
          role: "manager",
        }}
        onLogout={() => window.location.assign("/")}
        demoMode
      />
    );
  if (!hasSupabaseConfig) return <ConfigurationScreen />;
  if (checking) return <Splash />;
  if (!session) return <Login onError={setAuthError} error={authError} />;
  if (!appUser)
    return (
      <NoAccess
        email={session.user.email ?? ""}
        onLogout={() => supabase?.auth.signOut()}
        error={authError}
      />
    );
  return (
    <InventoryApp user={appUser} onLogout={() => supabase?.auth.signOut()} />
  );
}

function Splash() {
  return (
    <div className="splash">
      <img src="/logoagrolico.jpg" alt="AgroLico" />
      <LoaderCircle className="spin" />
      <span>Preparando seu estoque</span>
    </div>
  );
}

function ConfigurationScreen() {
  return (
    <main className="center-page">
      <section className="setup-card">
        <div className="brand-lockup">
          <img src="/logoagrolico.jpg" alt="AgroLico" />
          <span>Estoque</span>
        </div>
        <p className="eyebrow">Configuração inicial</p>
        <h1>Conecte o painel ao Supabase</h1>
        <p>
          Crie <code>.env.local</code> a partir de <code>.env.example</code> e
          informe apenas a URL e a chave pública do projeto.
        </p>
        <div className="code-block">
          VITE_SUPABASE_URL=...
          <br />
          VITE_SUPABASE_ANON_KEY=...
        </div>
      </section>
    </main>
  );
}

function Login({
  onError,
  error,
}: {
  onError: (message: string) => void;
  error: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(
    getRememberSessionPreference,
  );
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    onError("");
    setRememberSessionPreference(rememberSession);
    const { error: loginError } = await supabase!.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) onError("E-mail ou senha não conferem. Tente novamente.");
    setLoading(false);
  }
  return (
    <main className="login-page">
      <section className="login-story" aria-hidden="true">
        <div className="story-mark">Gestão conectada ao campo</div>
        <div>
          <p>DO RECEBIMENTO À SAÍDA</p>
          <h1>
            Seu estoque,
            <br />
            <em>sem pontos cegos.</em>
          </h1>
        </div>
        <div className="field-lines">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="brand-lockup">
            <img src="/logoagrolico.jpg" alt="AgroLico" />
            <span>Estoque</span>
          </div>
          <div>
            <p className="eyebrow">Acesso seguro</p>
            <h2>Bem-vindo de volta</h2>
            <p>Entre com o usuário autorizado no Supabase.</p>
          </div>
          <label>
            E-mail
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@agrolico.com.br"
              autoComplete="email"
            />
          </label>
          <label>
            Senha
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              autoComplete="current-password"
            />
          </label>
          <label className="remember-session">
            <input
              type="checkbox"
              checked={rememberSession}
              onChange={(e) => setRememberSession(e.target.checked)}
            />
            <span>
              <strong>Manter sempre conectado</strong>
              <small>Não pedir login novamente neste dispositivo</small>
            </span>
          </label>
          {error && (
            <div className="form-error" role="alert">
              <AlertTriangle size={17} />
              {error}
            </div>
          )}
          <button className="primary-button wide" disabled={loading}>
            {loading ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              "Entrar no painel"
            )}
            <ArrowRight size={18} />
          </button>
          <small>O acesso e todas as alterações são registrados.</small>
        </form>
      </section>
    </main>
  );
}

function NoAccess({
  email,
  onLogout,
  error,
}: {
  email: string;
  onLogout: () => void;
  error: string;
}) {
  return (
    <main className="center-page">
      <section className="setup-card">
        <ShieldCheck size={38} />
        <p className="eyebrow">Acesso pendente</p>
        <h1>Usuário ainda não autorizado</h1>
        <p>
          <strong>{email}</strong> existe no Supabase Auth, mas não está na
          equipe do estoque.
        </p>
        {error && <p className="muted">Detalhe: {error}</p>}
        <button className="secondary-button" onClick={onLogout}>
          Sair
        </button>
      </section>
    </main>
  );
}

function InventoryApp({
  user,
  onLogout,
  demoMode = false,
}: {
  user: AppUser;
  onLogout: () => void;
  demoMode?: boolean;
}) {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<"create" | "edit" | "adjust" | null>(null);
  const [selected, setSelected] = useState<StockItem | null>(null);
  const [invoiceItem, setInvoiceItem] = useState<StockItem | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    if (demoMode) {
      setData(getDemoDashboard(search, status, page));
      setMovements(getDemoMovements(search));
      setLoading(false);
      return;
    }
    const [dashboardResult, movementResult] = await Promise.all([
      supabase!.rpc("agrolico_inventory_dashboard_v1", {
        p_search: search,
        p_status: status,
        p_page: page,
        p_page_size: 12,
      }),
      supabase!.rpc("agrolico_inventory_movements_v1", {
        p_search: search,
        p_limit: 80,
      }),
    ]);
    if (dashboardResult.error) setToast(dashboardResult.error.message);
    else setData(dashboardResult.data as DashboardData);
    if (!movementResult.error)
      setMovements((movementResult.data ?? []) as Movement[]);
    setLoading(false);
  }, [demoMode, page, search, status]);

  useEffect(() => {
    const timer = setTimeout(load, 220);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const canWrite = user.role !== "viewer";
  const openEdit = (item: StockItem) => {
    setSelected(item);
    setModal("edit");
  };
  const openAdjust = (item: StockItem) => {
    setSelected(item);
    setModal("adjust");
  };
  const openInvoices = (item: StockItem) => setInvoiceItem(item);
  async function archive(item: StockItem) {
    if (item.quantity !== 0) {
      setToast("Zere o saldo antes de arquivar o item.");
      return;
    }
    if (demoMode) {
      const result = mutateDemo({
        action: "archive",
        stock_item_id: item.stock_item_id,
        reason: "Arquivado pelo painel",
      });
      if (!result.success)
        setToast(result.message ?? "Não foi possível arquivar.");
      else {
        setToast("Item arquivado na demonstração.");
        load();
      }
      return;
    }
    const { error } = await supabase!.rpc("agrolico_inventory_mutate_v1", {
      p: {
        action: "archive",
        stock_item_id: item.stock_item_id,
        reason: "Arquivado pelo painel",
      },
    });
    if (error) setToast(error.message);
    else {
      setToast("Item arquivado com rastreabilidade.");
      load();
    }
  }

  async function exportCompleteInventory(format: "xlsx" | "pdf") {
    setExporting(format);
    try {
      let complete: DashboardData;
      if (demoMode) {
        complete = getDemoDashboard("", "active", 1, 100);
      } else {
        const first = await supabase!.rpc("agrolico_inventory_dashboard_v1", {
          p_search: "",
          p_status: "active",
          p_page: 1,
          p_page_size: 100,
        });
        if (first.error) throw first.error;
        complete = first.data as DashboardData;
        if (complete.page_count > 1) {
          const remaining = await Promise.all(
            Array.from({ length: complete.page_count - 1 }, (_, index) =>
              supabase!.rpc("agrolico_inventory_dashboard_v1", {
                p_search: "",
                p_status: "active",
                p_page: index + 2,
                p_page_size: 100,
              }),
            ),
          );
          const failed = remaining.find((result) => result.error);
          if (failed?.error) throw failed.error;
          complete = {
            ...complete,
            items: [
              complete.items,
              ...remaining.map(
                (result) => (result.data as DashboardData).items,
              ),
            ].flat(),
          };
        }
      }
      const payload = {
        items: complete.items,
        summary: complete.summary,
        generatedBy: user.display_name,
      };
      if (format === "xlsx") await exportInventoryXlsx(payload);
      else await exportInventoryPdf(payload);
      setToast(`Estoque completo exportado em ${format.toUpperCase()}.`);
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o arquivo.",
      );
    } finally {
      setExporting(null);
    }
  }

  const title =
    view === "overview"
      ? "Visão geral"
      : view === "inventory"
        ? "Estoque"
        : view === "invoices"
          ? "Notas fiscais"
          : view === "movements"
            ? "Movimentações"
            : "Acesso e segurança";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logoagrolico.jpg" alt="AgroLico" />
          <div>
            <strong>AGROLICO</strong>
            <span>Gestão de estoque</span>
          </div>
        </div>
        <nav aria-label="Navegação principal">
          <NavButton
            active={view === "overview"}
            icon={<LayoutDashboard />}
            label="Visão geral"
            onClick={() => setView("overview")}
          />
          <NavButton
            active={view === "inventory"}
            icon={<Boxes />}
            label="Estoque"
            count={data?.total}
            onClick={() => setView("inventory")}
          />
          <NavButton
            active={view === "invoices"}
            icon={<FileText />}
            label="Notas fiscais"
            onClick={() => setView("invoices")}
          />
          <NavButton
            active={view === "movements"}
            icon={<ClipboardList />}
            label="Movimentações"
            onClick={() => setView("movements")}
          />
          <NavButton
            active={view === "access"}
            icon={<ShieldCheck />}
            label="Acesso"
            onClick={() => setView("access")}
          />
        </nav>
        <div className="sidebar-foot">
          <div className="user-avatar">
            {user.display_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <strong>{user.display_name}</strong>
            <span>{roleLabel(user.role)}</span>
          </div>
          <button onClick={onLogout} aria-label="Sair">
            <LogOut />
          </button>
        </div>
      </aside>
      <main id="conteudo" className="main-content">
        {demoMode && (
          <div className="demo-ribbon">
            MODO DEMONSTRAÇÃO · nenhuma alteração será gravada no Supabase
          </div>
        )}
        <header className="topbar">
          <div className="mobile-brand" aria-label="AgroLico">
            <img src="/logoagrolico.jpg" alt="" />
            <strong>AGROLICO</strong>
          </div>
          <div>
            <p className="breadcrumb">GESTÃO / {title.toUpperCase()}</p>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              onClick={load}
              aria-label="Atualizar"
            >
              <RefreshCw className={loading ? "spin" : ""} />
            </button>
            {canWrite && view !== "invoices" && view !== "access" && (
              <button
                className="primary-button"
                onClick={() => {
                  setSelected(null);
                  setModal("create");
                }}
              >
                <Plus />
                Novo item
              </button>
            )}
          </div>
        </header>

        {view !== "access" && view !== "invoices" && (
          <div className="search-row">
            <div className="search-box">
              <Search />
              <input
                aria-label={
                  view === "movements"
                    ? "Buscar nas movimentações"
                    : "Buscar no estoque"
                }
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={
                  view === "movements"
                    ? "Buscar produto, responsável, lote, NF ou motivo..."
                    : "Buscar produto, lote ou local..."
                }
              />
              {search && (
                <button aria-label="Limpar busca" onClick={() => setSearch("")}>
                  <X />
                </button>
              )}
            </div>
            {view !== "movements" && (
              <label className="filter-select">
                <SlidersHorizontal />
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="active">Itens ativos</option>
                  <option value="all">Todos</option>
                  <option value="low">Estoque baixo</option>
                  <option value="expiring">Vencendo</option>
                  <option value="expired">Vencidos</option>
                  <option value="out_of_stock">Sem saldo</option>
                  <option value="archived">Arquivados</option>
                </select>
              </label>
            )}
          </div>
        )}

        {loading && !data ? (
          <ContentSkeleton />
        ) : (
          <>
            {view === "overview" && data && (
              <Overview
                data={data}
                movements={movements}
                onNavigate={setView}
                onEdit={openEdit}
              />
            )}
            {view === "inventory" && data && (
              <InventoryTable
                data={data}
                page={page}
                onPage={setPage}
                canWrite={canWrite}
                onEdit={openEdit}
                onAdjust={openAdjust}
                onInvoices={openInvoices}
                onArchive={archive}
                onExport={exportCompleteInventory}
                exporting={exporting}
              />
            )}
            {view === "invoices" && (
              <InvoiceCenter
                user={user}
                demoMode={demoMode}
                onToast={setToast}
              />
            )}
            {view === "movements" && <MovementTable movements={movements} />}
            {view === "access" && <AccessView user={user} />}
          </>
        )}
      </main>
      <MobileDock view={view} onChange={setView} inventoryCount={data?.total} />
      {modal && (
        <ItemModal
          mode={modal}
          item={selected}
          demoMode={demoMode}
          onClose={() => setModal(null)}
          onSaved={(message) => {
            setModal(null);
            setToast(message);
            load();
          }}
        />
      )}
      {invoiceItem && (
        <InvoiceModal
          item={invoiceItem}
          demoMode={demoMode}
          onClose={() => setInvoiceItem(null)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check />
          {toast}
        </div>
      )}
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "nav-item active" : "nav-item"}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && <b>{count}</b>}
    </button>
  );
}

function MobileDock({
  view,
  onChange,
  inventoryCount,
}: {
  view: View;
  onChange: (view: View) => void;
  inventoryCount?: number;
}) {
  const items: {
    view: View;
    label: string;
    icon: React.ReactNode;
    primary?: boolean;
  }[] = [
    { view: "overview", label: "Início", icon: <LayoutDashboard /> },
    { view: "invoices", label: "Notas", icon: <FileText /> },
    { view: "inventory", label: "Estoque", icon: <Boxes />, primary: true },
    { view: "movements", label: "Histórico", icon: <ClipboardList /> },
    { view: "access", label: "Acesso", icon: <ShieldCheck /> },
  ];
  return (
    <nav className="mobile-dock" aria-label="Navegação principal">
      {items.map((item) => (
        <button
          key={item.view}
          className={`${view === item.view ? "active" : ""}${item.primary ? " primary" : ""}`}
          aria-current={view === item.view ? "page" : undefined}
          aria-label={
            item.primary && inventoryCount !== undefined
              ? `Estoque, ${inventoryCount} registros`
              : item.label
          }
          onClick={() => onChange(item.view)}
        >
          <span>
            {item.icon}
            {item.primary && inventoryCount !== undefined && (
              <b>{inventoryCount}</b>
            )}
          </span>
          <small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
}

function Overview({
  data,
  movements,
  onNavigate,
  onEdit,
}: {
  data: DashboardData;
  movements: Movement[];
  onNavigate: (view: View) => void;
  onEdit: (item: StockItem) => void;
}) {
  const alertItems = data.items
    .filter((item) =>
      ["expired", "expiring", "low", "out_of_stock"].includes(item.status),
    )
    .slice(0, 5);
  const maxQuantity = Math.max(...data.items.map((item) => item.quantity), 1);
  return (
    <div className="view-stack">
      <section className="metric-grid">
        <Metric
          label="Custo em estoque"
          value={money.format(data.summary.inventory_value)}
          detail={`${data.summary.lot_count} lotes ativos`}
          icon={<CircleDollarSign />}
          tone="dark"
        />
        <Metric
          label="Valor de venda"
          value={money.format(data.summary.sale_inventory_value)}
          detail={`Margem potencial ${money.format(data.summary.sale_inventory_value - data.summary.inventory_value)}`}
          icon={<ArrowUpRight />}
        />
        <Metric
          label="Produtos ativos"
          value={String(data.summary.sku_count)}
          detail="descrições + unidades"
          icon={<Boxes />}
        />
        <Metric
          label="Atenção agora"
          value={String(data.summary.low_count + data.summary.out_count)}
          detail={`${data.summary.out_count} sem saldo`}
          icon={<AlertTriangle />}
          tone="warning"
        />
        <Metric
          label="Próximos do vencimento"
          value={String(data.summary.expiring_count)}
          detail={`${data.summary.expired_count} já vencidos`}
          icon={<CalendarClock />}
          tone="danger"
        />
      </section>
      <section className="overview-grid">
        <article className="panel stock-map">
          <header>
            <div>
              <p className="eyebrow">Distribuição atual</p>
              <h2>Saldo por lote</h2>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("inventory")}
            >
              Ver estoque <ArrowRight />
            </button>
          </header>
          <div className="bar-list">
            {data.items.slice(0, 7).map((item) => (
              <button
                key={item.stock_item_id}
                className="bar-row"
                onClick={() => onEdit(item)}
              >
                <span className="bar-label">
                  <b>{item.description}</b>
                  <small>
                    {item.batch_number
                      ? `Lote ${item.batch_number}`
                      : item.source_label}
                  </small>
                </span>
                <span className="bar-track">
                  <i
                    style={{
                      width: `${Math.max(3, (item.quantity / maxQuantity) * 100)}%`,
                    }}
                  />
                </span>
                <strong>
                  {number.format(item.quantity)} {item.unit}
                </strong>
              </button>
            ))}
          </div>
          {!data.items.length && (
            <EmptyState label="Nenhum item encontrado com os filtros atuais." />
          )}
        </article>
        <article className="panel alerts-panel">
          <header>
            <div>
              <p className="eyebrow">Fila de atenção</p>
              <h2>O que pede ação</h2>
            </div>
            <span className="count-badge">{alertItems.length}</span>
          </header>
          <div className="alert-list">
            {alertItems.map((item) => (
              <button key={item.stock_item_id} onClick={() => onEdit(item)}>
                <StatusBadge status={item.status} />
                <div>
                  <strong>{item.description}</strong>
                  <span>{alertDetail(item)}</span>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
          {!alertItems.length && (
            <EmptyState icon={<Check />} label="Tudo em ordem por aqui." />
          )}
        </article>
      </section>
      <section className="panel recent-panel">
        <header>
          <div>
            <p className="eyebrow">Rastreabilidade</p>
            <h2>Movimentações recentes</h2>
          </div>
          <button
            className="text-button"
            onClick={() => onNavigate("movements")}
          >
            Ver histórico <ArrowRight />
          </button>
        </header>
        <MovementRows movements={movements.slice(0, 5)} />
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  tone = "",
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <article className={`metric ${tone}`}>
      <span className="metric-icon">{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function InventoryTable({
  data,
  page,
  onPage,
  canWrite,
  onEdit,
  onAdjust,
  onInvoices,
  onArchive,
  onExport,
  exporting,
}: {
  data: DashboardData;
  page: number;
  onPage: (page: number) => void;
  canWrite: boolean;
  onEdit: (item: StockItem) => void;
  onAdjust: (item: StockItem) => void;
  onInvoices: (item: StockItem) => void;
  onArchive: (item: StockItem) => void;
  onExport: (format: "xlsx" | "pdf") => void;
  exporting: "xlsx" | "pdf" | null;
}) {
  return (
    <section className="panel table-panel inventory-table-panel">
      <header>
        <div>
          <p className="eyebrow">{data.total} registros</p>
          <h2>Itens e lotes</h2>
        </div>
        <div className="inventory-header-tools">
          <div className="legend">
            <span>
              <i className="dot danger" />
              Vencido
            </span>
            <span>
              <i className="dot warning" />
              Atenção
            </span>
            <span>
              <i className="dot ok" />
              Em dia
            </span>
          </div>
          <ExportMenu onExport={onExport} exporting={exporting} />
        </div>
      </header>
      <div className="table-scroll">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Saldo</th>
              <th>Validade</th>
              <th>Custo unit.</th>
              <th>Preço de venda</th>
              <th>Valor de venda</th>
              <th>Origem</th>
              <th>Nota fiscal</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.stock_item_id}>
                <td data-label="Produto">
                  <button className="product-cell" onClick={() => onEdit(item)}>
                    <b>{item.description}</b>
                    <span>
                      {item.batch_number
                        ? `Lote ${item.batch_number}`
                        : "Sem lote"}
                      {item.location ? ` · ${item.location}` : ""}
                    </span>
                  </button>
                </td>
                <td data-label="Saldo" className="quantity-cell">
                  <strong>{number.format(item.quantity)}</strong> {item.unit}
                  <small>Mín. {number.format(item.minimum_quantity)}</small>
                </td>
                <td data-label="Validade">
                  {item.expires_on ? (
                    date.format(new Date(`${item.expires_on}T12:00:00`))
                  ) : (
                    <span className="muted">Não informada</span>
                  )}
                </td>
                <td data-label="Custo unit.">
                  {money.format(item.unit_price)}
                </td>
                <td data-label="Preço de venda">
                  <strong>{money.format(item.sale_unit_price)}</strong>
                </td>
                <td data-label="Valor de venda">
                  <strong>{money.format(item.sale_line_total)}</strong>
                </td>
                <td data-label="Origem">
                  <span className="source-tag">{item.source_label}</span>
                </td>
                <td data-label="Nota fiscal">
                  <button
                    className="document-link"
                    onClick={() => onInvoices(item)}
                  >
                    <FileText />
                    Ver nota
                  </button>
                </td>
                <td data-label="Status">
                  <StatusBadge status={item.status} />
                </td>
                <td data-label="Ações">
                  <div className="row-actions">
                    {canWrite && (
                      <>
                        <button
                          title="Movimentar saldo"
                          onClick={() => onAdjust(item)}
                        >
                          <SlidersHorizontal />
                        </button>
                        <button
                          title="Editar item"
                          onClick={() => onEdit(item)}
                        >
                          <Edit3 />
                        </button>
                        <button
                          title="Arquivar item"
                          disabled={
                            item.quantity !== 0 || item.status === "archived"
                          }
                          onClick={() => onArchive(item)}
                        >
                          <Archive />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.items.length && (
        <EmptyState label="Nenhum item corresponde à busca ou ao filtro." />
      )}
      {data.page_count > 1 && (
        <footer className="pagination">
          <span>
            Página {page} de {data.page_count}
          </span>
          <div>
            <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
              <ChevronLeft />
              Anterior
            </button>
            <button
              disabled={page >= data.page_count}
              onClick={() => onPage(page + 1)}
            >
              Próxima
              <ChevronRight />
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}

function ExportMenu({
  onExport,
  exporting,
}: {
  onExport: (format: "xlsx" | "pdf") => void;
  exporting: "xlsx" | "pdf" | null;
}) {
  const [open, setOpen] = useState(false);
  const choose = (format: "xlsx" | "pdf") => {
    setOpen(false);
    onExport(format);
  };
  return (
    <div className="export-menu">
      <button
        className="export-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={Boolean(exporting)}
        onClick={() => setOpen((value) => !value)}
      >
        {exporting ? <LoaderCircle className="spin" /> : <Download />}
        <span>
          {exporting ? `Gerando ${exporting.toUpperCase()}` : "Exportar"}
        </span>
        <ChevronDown />
      </button>
      {open && (
        <div className="export-options" role="menu">
          <button role="menuitem" onClick={() => choose("xlsx")}>
            <FileSpreadsheet />
            <span>
              <strong>Planilha Excel</strong>
              <small>Estoque completo em .xlsx</small>
            </span>
          </button>
          <button role="menuitem" onClick={() => choose("pdf")}>
            <FileText />
            <span>
              <strong>Relatório PDF</strong>
              <small>Documento visual para impressão</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function MovementTable({ movements }: { movements: Movement[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <section className="panel table-panel movement-audit">
      <header>
        <div>
          <p className="eyebrow">Histórico unificado</p>
          <h2>Entradas, saídas e ajustes</h2>
        </div>
        <span className="audit-note">
          <ShieldCheck />
          Autoria e saldos rastreados
        </span>
      </header>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Movimento</th>
              <th>Produto / lote</th>
              <th>Variação</th>
              <th>Saldo</th>
              <th>Responsável</th>
              <th>Origem</th>
              <th>
                <span className="sr-only">Detalhes</span>
              </th>
            </tr>
          </thead>
          {movements.map((m) => {
            const key = `${m.source}-${m.id}`;
            const isExpanded = expanded === key;
            return (
              <tbody
                key={key}
                className={
                  isExpanded ? "movement-group expanded" : "movement-group"
                }
              >
                <tr
                  className="movement-summary-row"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded(isExpanded ? null : key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setExpanded(isExpanded ? null : key);
                    }
                  }}
                >
                  <td className="movement-mobile-cell" colSpan={8}>
                    <MovementType type={m.movement_type} />
                    <span className="movement-mobile-main">
                      <strong>{m.description}</strong>
                      <small>
                        {dateTime.format(new Date(m.occurred_at))}
                        {m.batch_number ? ` · Lote ${m.batch_number}` : ""}
                      </small>
                    </span>
                    <b
                      className={
                        m.quantity_delta >= 0 ? "positive" : "negative"
                      }
                    >
                      {m.quantity_delta >= 0 ? "+" : ""}
                      {number.format(m.quantity_delta)} {m.unit}
                    </b>
                    <ChevronDown className="movement-mobile-chevron" />
                  </td>
                  <td data-label="Data">
                    <time>{dateTime.format(new Date(m.occurred_at))}</time>
                  </td>
                  <td data-label="Movimento">
                    <MovementType type={m.movement_type} />
                  </td>
                  <td data-label="Produto / lote">
                    <span className="movement-product">
                      <strong>{m.description}</strong>
                      <small>
                        {m.batch_number
                          ? `Lote ${m.batch_number}`
                          : "Sem lote informado"}
                      </small>
                    </span>
                  </td>
                  <td
                    data-label="Variação"
                    className={m.quantity_delta >= 0 ? "positive" : "negative"}
                  >
                    {m.quantity_delta >= 0 ? "+" : ""}
                    {number.format(m.quantity_delta)} {m.unit}
                  </td>
                  <td data-label="Saldo">{movementBalance(m)}</td>
                  <td data-label="Responsável">
                    <span className="movement-actor">
                      <strong>{m.actor || "Sistema"}</strong>
                      <small>
                        {m.actor_role
                          ? roleLabel(m.actor_role)
                          : m.channel === "whatsapp"
                            ? "Via WhatsApp"
                            : "Automação"}
                      </small>
                    </span>
                  </td>
                  <td data-label="Origem">
                    <span className="movement-source">
                      <strong>{m.reference || m.source}</strong>
                      <small>{m.source}</small>
                    </span>
                  </td>
                  <td data-label="Detalhes">
                    <button
                      className="movement-detail-toggle"
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? "Ocultar" : "Ver"} detalhes de ${m.description}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpanded(isExpanded ? null : key);
                      }}
                    >
                      <ChevronDown />
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="movement-detail-row">
                    <td colSpan={8}>
                      <MovementTrace movement={m} />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
      {!movements.length && (
        <EmptyState label="Nenhuma movimentação encontrada." />
      )}
    </section>
  );
}

function MovementRows({
  movements,
  asTable = false,
}: {
  movements: Movement[];
  asTable?: boolean;
}) {
  if (asTable)
    return (
      <>
        {movements.map((m) => (
          <tr key={`${m.source}-${m.id}`}>
            <td>{dateTime.format(new Date(m.occurred_at))}</td>
            <td>
              <MovementType type={m.movement_type} />
            </td>
            <td>
              <strong>{m.description}</strong>
            </td>
            <td className={m.quantity_delta >= 0 ? "positive" : "negative"}>
              {m.quantity_delta >= 0 ? "+" : ""}
              {number.format(m.quantity_delta)} {m.unit}
            </td>
            <td>{m.actor || "Sistema"}</td>
            <td>{m.reason || m.source}</td>
          </tr>
        ))}
      </>
    );
  return (
    <div className="movement-list">
      {movements.map((m) => (
        <div className="movement-row" key={`${m.source}-${m.id}`}>
          <MovementType type={m.movement_type} iconOnly />
          <div>
            <strong>{m.description}</strong>
            <span>{m.reason || m.source}</span>
          </div>
          <b className={m.quantity_delta >= 0 ? "positive" : "negative"}>
            {m.quantity_delta >= 0 ? "+" : ""}
            {number.format(m.quantity_delta)} {m.unit}
          </b>
          <time>{dateTime.format(new Date(m.occurred_at))}</time>
        </div>
      ))}
    </div>
  );
}

function MovementTrace({ movement: m }: { movement: Movement }) {
  return (
    <div className="movement-trace">
      <div className="trace-card">
        <span>Responsável</span>
        <strong>{m.actor || "Sistema"}</strong>
        <small>
          {[m.actor_email, m.actor_role ? roleLabel(m.actor_role) : null]
            .filter(Boolean)
            .join(" · ") ||
            (m.channel === "whatsapp"
              ? "Operação recebida pelo WhatsApp"
              : "Operação automática")}
        </small>
      </div>
      <div className="trace-card">
        <span>Saldo rastreado</span>
        <strong>{movementBalance(m)}</strong>
        <small>
          Variação de {m.quantity_delta >= 0 ? "+" : ""}
          {number.format(m.quantity_delta)} {m.unit}
        </small>
      </div>
      <div className="trace-card">
        <span>Cadastro do item</span>
        <strong>
          {m.source_type === "NF"
            ? "Originado por nota fiscal"
            : m.source_type === "AVULSO"
              ? "Cadastro avulso"
              : m.source}
        </strong>
        <small>
          {m.item_created_at
            ? `Registrado em ${dateTime.format(new Date(m.item_created_at))}`
            : "Data original não disponível"}
        </small>
      </div>
      <div className="trace-card">
        <span>Lote e validade</span>
        <strong>{m.batch_number || "Sem lote"}</strong>
        <small>
          {m.expires_on
            ? `Validade ${date.format(new Date(`${m.expires_on}T12:00:00`))}`
            : "Validade não informada"}
        </small>
      </div>
      <div className="trace-card">
        <span>Valor e localização</span>
        <strong>
          {m.unit_price != null
            ? money.format(m.unit_price) + " / " + m.unit
            : "Preço não informado"}
        </strong>
        <small>{m.location || "Localização não informada"}</small>
      </div>
      <div className="trace-card trace-wide">
        <span>Motivo e campos afetados</span>
        <strong>{m.reason || "Sem motivo adicional"}</strong>
        <div className="trace-chips">
          {(m.changed_fields?.length
            ? m.changed_fields
            : [movementLabel(m.movement_type)]
          ).map((field) => (
            <i key={field}>{field}</i>
          ))}
        </div>
      </div>
      <div className="trace-card trace-id">
        <span>Referência de auditoria</span>
        <code>{m.id}</code>
        <small>
          {m.channel === "whatsapp"
            ? "Canal WhatsApp · identificadores pessoais protegidos"
            : "Canal painel web"}
        </small>
      </div>
    </div>
  );
}

function movementBalance(movement: Movement) {
  if (movement.quantity_before == null || movement.quantity_after == null)
    return "—";
  return `${number.format(movement.quantity_before)} → ${number.format(movement.quantity_after)} ${movement.unit}`;
}

function MovementType({
  type,
  iconOnly = false,
}: {
  type: string;
  iconOnly?: boolean;
}) {
  const incoming = ["entrada", "create", "restore"].includes(
    type.toLowerCase(),
  );
  const icon = incoming ? (
    <ArrowDownLeft />
  ) : type === "edit" ? (
    <Edit3 />
  ) : (
    <ArrowUpRight />
  );
  return (
    <span className={`movement-type ${incoming ? "in" : "out"}`}>
      {icon}
      {!iconOnly && movementLabel(type)}
    </span>
  );
}

function AccessView({ user }: { user: AppUser }) {
  return (
    <div className="access-grid">
      <section className="panel access-hero">
        <ShieldCheck />
        <p className="eyebrow">SESSÃO AUTENTICADA</p>
        <h2>{user.display_name}</h2>
        <p>{user.email}</p>
        <span className="role-chip">{roleLabel(user.role)}</span>
      </section>
      <section className="panel permissions">
        <p className="eyebrow">Permissões da função</p>
        <h2>O que este acesso permite</h2>
        <ul>
          {permissionList(user.role).map((text) => (
            <li key={text}>
              <Check />
              {text}
            </li>
          ))}
        </ul>
      </section>
      <section className="panel security-copy">
        <Settings />
        <h2>Segurança por padrão</h2>
        <p>
          O navegador não acessa as tabelas diretamente. Cada operação passa por
          uma função protegida no Supabase, valida sua função e grava autoria,
          horário e valores anteriores e posteriores.
        </p>
      </section>
    </div>
  );
}

function ItemModal({
  mode,
  item,
  demoMode,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit" | "adjust";
  item: StockItem | null;
  demoMode: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<ItemForm>(() =>
    item
      ? {
          stock_item_id: item.stock_item_id,
          description: item.description,
          quantity: mode === "adjust" ? "" : String(item.quantity),
          unit: item.unit,
          batch_number: item.batch_number ?? "",
          expires_on: item.expires_on ?? "",
          unit_price: String(item.unit_price),
          sale_unit_price: String(item.sale_unit_price),
          minimum_quantity: String(item.minimum_quantity),
          location: item.location ?? "",
          notes: item.notes ?? "",
          reason: "",
        }
      : emptyForm,
  );
  const [direction, setDirection] = useState<"in" | "out" | "set">("in");
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof ItemForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const updateCost = (value: string) =>
    setForm((prev) => {
      const followsSuggestion =
        !prev.sale_unit_price ||
        Math.abs(
          Number(prev.sale_unit_price) - Number(prev.unit_price || 0) * 1.6,
        ) < 0.000001;
      return {
        ...prev,
        unit_price: value,
        sale_unit_price: followsSuggestion
          ? String(Number((Number(value || 0) * 1.6).toFixed(6)))
          : prev.sale_unit_price,
      };
    });
  function selectInvoices(files: FileList | null) {
    const selected = Array.from(files ?? []);
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    const invalid = selected.find(
      (file) => !allowed.includes(file.type) || file.size > 10 * 1024 * 1024,
    );
    if (invalid) {
      setInvoiceFiles([]);
      setError(
        `O arquivo ${invalid.name} precisa ser PDF, JPG, PNG ou WebP e ter no máximo 10 MB.`,
      );
      return;
    }
    if (selected.length > 5) {
      setInvoiceFiles([]);
      setError("Envie no máximo 5 arquivos por item.");
      return;
    }
    setError("");
    setInvoiceFiles(selected);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload =
      mode === "adjust"
        ? {
            action: "adjust",
            stock_item_id: item!.stock_item_id,
            direction,
            quantity: Number(form.quantity),
            reason: form.reason,
          }
        : {
            action: mode,
            stock_item_id: item?.stock_item_id,
            description: form.description,
            quantity: Number(form.quantity || 0),
            unit: form.unit,
            batch_number: form.batch_number || null,
            expires_on: form.expires_on || null,
            unit_price: Number(form.unit_price || 0),
            sale_unit_price: Number(
              form.sale_unit_price ||
                (Number(form.unit_price || 0) * 1.6).toFixed(6),
            ),
            minimum_quantity: Number(form.minimum_quantity || 0),
            location: form.location || null,
            notes: form.notes || null,
            reason: form.reason || null,
          };
    const { data, error: rpcError } = demoMode
      ? { data: mutateDemo(payload), error: null }
      : await supabase!.rpc("agrolico_inventory_mutate_v1", { p: payload });
    if (rpcError || !data?.success)
      setError(
        rpcError?.message || data?.message || "Não foi possível salvar.",
      );
    else {
      const stockItemId = data.stock_item_id || item?.stock_item_id;
      if (invoiceFiles.length && stockItemId) {
        try {
          if (demoMode) attachDemoDocuments(stockItemId, invoiceFiles);
          else await uploadInventoryDocuments(stockItemId, invoiceFiles);
        } catch (uploadError) {
          setError(
            `O item foi salvo, mas a nota não foi anexada: ${uploadError instanceof Error ? uploadError.message : "erro no envio"}`,
          );
          setSaving(false);
          return;
        }
      }
      onSaved(
        mode === "create"
          ? `Item adicionado${invoiceFiles.length ? " com a nota fiscal" : ""}.`
          : mode === "edit"
            ? `Dados do item atualizados${invoiceFiles.length ? " e nota anexada" : ""}.`
            : "Saldo movimentado com sucesso.",
      );
    }
    setSaving(false);
  }
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header>
          <div>
            <p className="eyebrow">
              {mode === "create"
                ? "Novo registro"
                : mode === "edit"
                  ? "Cadastro completo"
                  : "Entrada ou saída"}
            </p>
            <h2 id="modal-title">
              {mode === "create"
                ? "Adicionar item"
                : mode === "edit"
                  ? "Detalhes do item"
                  : item?.description}
            </h2>
          </div>
          <button aria-label="Fechar" onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          {mode === "adjust" ? (
            <>
              <div className="segmented">
                <button
                  type="button"
                  className={direction === "in" ? "active" : ""}
                  onClick={() => setDirection("in")}
                >
                  <Plus />
                  Entrada
                </button>
                <button
                  type="button"
                  className={direction === "out" ? "active" : ""}
                  onClick={() => setDirection("out")}
                >
                  <Minus />
                  Saída
                </button>
                <button
                  type="button"
                  className={direction === "set" ? "active" : ""}
                  onClick={() => setDirection("set")}
                >
                  <SlidersHorizontal />
                  Definir saldo
                </button>
              </div>
              <div className="current-balance">
                Saldo atual{" "}
                <strong>
                  {number.format(item?.quantity ?? 0)} {item?.unit}
                </strong>
              </div>
              <label>
                Quantidade
                <input
                  required
                  min="0"
                  step="0.0001"
                  type="number"
                  value={form.quantity}
                  onChange={(e) => update("quantity", e.target.value)}
                />
              </label>
              <label>
                Motivo da movimentação
                <textarea
                  required
                  value={form.reason}
                  onChange={(e) => update("reason", e.target.value)}
                  placeholder="Ex.: contagem física, perda, recebimento..."
                />
              </label>
            </>
          ) : (
            <div className="form-grid">
              <label className="span-2">
                Descrição do produto
                <input
                  required
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </label>
              {mode === "create" && (
                <label>
                  Quantidade inicial
                  <input
                    required
                    min="0"
                    step="0.0001"
                    type="number"
                    value={form.quantity}
                    onChange={(e) => update("quantity", e.target.value)}
                  />
                </label>
              )}
              <label>
                Unidade
                <input
                  required
                  value={form.unit}
                  onChange={(e) => update("unit", e.target.value.toUpperCase())}
                  placeholder="UN, KG, L..."
                />
              </label>
              <label>
                Lote
                <input
                  value={form.batch_number}
                  onChange={(e) => update("batch_number", e.target.value)}
                />
              </label>
              <label>
                Validade
                <input
                  type="date"
                  value={form.expires_on}
                  onChange={(e) => update("expires_on", e.target.value)}
                />
              </label>
              <label>
                Custo unitário
                <input
                  required
                  min="0"
                  step="0.000001"
                  type="number"
                  value={form.unit_price}
                  onChange={(e) => updateCost(e.target.value)}
                />
              </label>
              <label>
                Preço de venda
                <input
                  required
                  min="0"
                  step="0.000001"
                  type="number"
                  value={form.sale_unit_price}
                  onChange={(e) => update("sale_unit_price", e.target.value)}
                />
                <small>Sugerido: 60% acima do custo; pode ser editado.</small>
              </label>
              <label>
                Estoque mínimo
                <input
                  required
                  min="0"
                  step="0.0001"
                  type="number"
                  value={form.minimum_quantity}
                  onChange={(e) => update("minimum_quantity", e.target.value)}
                />
              </label>
              <label className="span-2">
                Localização
                <input
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder="Ex.: Galpão A · Prateleira 3"
                />
              </label>
              <label className="span-2">
                Observações
                <textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </label>
              <label className="span-2 upload-field">
                <span>
                  Nota fiscal do item <small>opcional</small>
                </span>
                <span className="upload-drop">
                  <UploadCloud />
                  <strong>
                    {invoiceFiles.length
                      ? `${invoiceFiles.length} arquivo(s) selecionado(s)`
                      : "Clique para selecionar a nota"}
                  </strong>
                  <small>PDF, JPG, PNG ou WebP · até 10 MB por arquivo</small>
                  <input
                    type="file"
                    multiple
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => selectInvoices(e.target.files)}
                  />
                </span>
                {invoiceFiles.length > 0 && (
                  <span className="selected-files">
                    {invoiceFiles.map((file) => (
                      <span key={`${file.name}-${file.size}`}>
                        <Paperclip />
                        {file.name}
                        <b>{formatBytes(file.size)}</b>
                      </span>
                    ))}
                  </span>
                )}
              </label>
              {mode === "edit" && (
                <label className="span-2">
                  Motivo da edição
                  <textarea
                    required
                    value={form.reason}
                    onChange={(e) => update("reason", e.target.value)}
                    placeholder="Explique o que está sendo corrigido"
                  />
                </label>
              )}
            </div>
          )}
          {error && (
            <div className="form-error" role="alert">
              <AlertTriangle />
              {error}
            </div>
          )}
          <footer>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={saving}>
              {saving && <LoaderCircle className="spin" />}Salvar alteração
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

async function uploadInventoryDocuments(stockItemId: string, files: File[]) {
  const { data: authData, error: authError } = await supabase!.auth.getUser();
  if (authError || !authData.user)
    throw new Error("sessão expirada; entre novamente");
  for (const file of files) {
    const safeName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .slice(-120);
    const objectPath = `${authData.user.id}/${stockItemId}/${crypto.randomUUID()}-${safeName}`;
    const { error: storageError } = await supabase!.storage
      .from("agrolico-inventory-documents")
      .upload(objectPath, file, { contentType: file.type, upsert: false });
    if (storageError) throw new Error(storageError.message);
    const { error: attachError } = await supabase!.rpc(
      "agrolico_inventory_attach_document_v1",
      {
        p: {
          stock_item_id: stockItemId,
          storage_bucket: "agrolico-inventory-documents",
          storage_object_path: objectPath,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        },
      },
    );
    if (attachError) {
      await supabase!.storage
        .from("agrolico-inventory-documents")
        .remove([objectPath]);
      throw new Error(attachError.message);
    }
  }
}

function InvoiceModal({
  item,
  demoMode,
  onClose,
}: {
  item: StockItem;
  demoMode: boolean;
  onClose: () => void;
}) {
  const [documents, setDocuments] = useState<InventoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<InventoryDocument | null>(null);
  useEffect(() => {
    let active = true;
    async function loadDocuments() {
      if (demoMode) {
        if (active) {
          setDocuments(getDemoDocuments(item.stock_item_id));
          setLoading(false);
        }
        return;
      }
      const { data, error: rpcError } = await supabase!.rpc(
        "agrolico_inventory_documents_v1",
        { p_stock_item_id: item.stock_item_id },
      );
      if (!active) return;
      if (rpcError) setError(rpcError.message);
      else setDocuments((data ?? []) as InventoryDocument[]);
      setLoading(false);
    }
    loadDocuments();
    return () => {
      active = false;
    };
  }, [demoMode, item.stock_item_id]);

  async function openDocument(document: InventoryDocument) {
    if (demoMode) {
      setPreview(document);
      return;
    }
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    const { data, error: signedError } = await supabase!.storage
      .from(document.bucket)
      .createSignedUrl(document.object_path, 300);
    if (signedError || !data?.signedUrl) {
      tab?.close();
      setError(signedError?.message || "Não foi possível abrir a nota.");
      return;
    }
    if (tab) tab.location.href = data.signedUrl;
    else window.location.assign(data.signedUrl);
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal invoice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-title"
      >
        <header>
          <div>
            <p className="eyebrow">Documentos do estoque</p>
            <h2 id="invoice-title">Notas do item</h2>
            <p className="modal-subtitle">{item.description}</p>
          </div>
          <button aria-label="Fechar" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="invoice-content">
          {loading ? (
            <div className="invoice-loading">
              <LoaderCircle className="spin" />
              Buscando documentos...
            </div>
          ) : error ? (
            <div className="form-error">
              <AlertTriangle />
              {error}
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              label="Nenhuma nota fiscal vinculada a este item."
            />
          ) : (
            <div className="invoice-list">
              {documents.map((document) => (
                <article
                  className="invoice-row"
                  key={`${document.bucket}-${document.id}`}
                >
                  <span className="invoice-icon">
                    {document.mime_type?.startsWith("image/") ? (
                      <FileImage />
                    ) : (
                      <FileText />
                    )}
                  </span>
                  <div>
                    <strong>{document.file_name}</strong>
                    <span>
                      {document.source === "nota_fiscal"
                        ? "Nota recebida pelo AgroLico"
                        : "Anexo enviado pelo painel"}{" "}
                      ·{" "}
                      {document.size_bytes
                        ? formatBytes(document.size_bytes)
                        : "tamanho não informado"}
                    </span>
                    <small>
                      Vinculada em{" "}
                      {dateTime.format(new Date(document.created_at))}
                    </small>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => openDocument(document)}
                  >
                    <Download />
                    Abrir nota
                  </button>
                </article>
              ))}
            </div>
          )}
          {preview && (
            <div className="demo-invoice">
              <span className="demo-watermark">DEMONSTRAÇÃO</span>
              <div className="demo-invoice-head">
                <img src="/logoagrolico.jpg" alt="" />
                <div>
                  <small>Documento fiscal de exemplo</small>
                  <strong>{preview.file_name}</strong>
                </div>
              </div>
              <div className="demo-invoice-data">
                <span>
                  Produto<strong>{item.description}</strong>
                </span>
                <span>
                  Quantidade
                  <strong>
                    {number.format(item.quantity)} {item.unit}
                  </strong>
                </span>
                <span>
                  Valor do estoque
                  <strong>{money.format(item.line_total)}</strong>
                </span>
              </div>
              <p>
                Esta visualização existe apenas no modo demonstração. No painel
                autenticado, o documento original é aberto por um link privado
                temporário.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: StockStatus }) {
  return (
    <span className={`status status-${status}`}>
      <i />
      {statusLabels[status]}
    </span>
  );
}
function EmptyState({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ?? <Eye />}
      <span>{label}</span>
    </div>
  );
}
function ContentSkeleton() {
  return (
    <div className="skeleton-grid">
      <i />
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}
function roleLabel(role: string) {
  return role === "manager"
    ? "Gestor"
    : role === "operator"
      ? "Operador"
      : "Visualizador";
}
function movementLabel(type: string) {
  const labels: Record<string, string> = {
    create: "Cadastro",
    entrada: "Entrada",
    in: "Entrada",
    out: "Saída",
    edit: "Edição",
    archive: "Arquivamento",
    restore: "Restauração",
    set: "Ajuste de saldo",
    venda: "Venda",
    perda: "Perda",
    devolucao: "Devolução",
    correcao: "Correção",
    ajuste_manual: "Ajuste manual",
  };
  return labels[type.toLowerCase()] ?? type;
}
function alertDetail(item: StockItem) {
  if (item.status === "expired")
    return `Venceu há ${Math.abs(item.days_to_expiry ?? 0)} dias`;
  if (item.status === "expiring") return `Vence em ${item.days_to_expiry} dias`;
  if (item.status === "low")
    return `${number.format(item.quantity)} ${item.unit} · mínimo ${number.format(item.minimum_quantity)}`;
  return "Saldo zerado";
}
function permissionList(role: string) {
  if (role === "manager")
    return [
      "Visualizar todo o estoque e histórico",
      "Cadastrar, editar e movimentar itens",
      "Arquivar itens sem saldo",
      "Gerenciar usuários diretamente no Supabase",
    ];
  if (role === "operator")
    return [
      "Visualizar todo o estoque e histórico",
      "Cadastrar, editar e movimentar itens",
      "Arquivar itens sem saldo",
    ];
  return ["Visualizar todo o estoque", "Consultar movimentações e alertas"];
}

export default App;
