import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  LayoutGrid,
  List,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import type {
  CheckResult,
  CustomerApproval,
  OrderStatus,
  ServiceOrder,
} from "./types";
import { useStore } from "./store";
import { useOrders } from "./orderStore";
import {
  changeStatus,
  isOverdue,
  matchingOrders,
  orderListCsv,
  orderStatuses,
  registerApproval,
  relatedCustomerOrders,
  setOrderCheck,
  syncOrderBudget,
  withHistory,
} from "./orders";
import { money, total } from "./services";
const dateTime = (value: string) => new Date(value).toLocaleString("pt-BR");
const dateLabel = (value: string) =>
  value ? value.split("-").reverse().join("/") : "Sem prazo definido";
const closed = (order: ServiceOrder) =>
  ["Entregue", "Cancelado"].includes(order.status);
function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function loadWorkspace(order: ServiceOrder) {
  useStore.setState({
    quote: structuredClone(order.quote),
    diagnoses: structuredClone(order.diagnoses),
    explosion: 0,
    selected: order.quote.items[0]?.componentId || "main-camera",
  });
}
export function CreateOrderButton() {
  const { quote, diagnoses } = useStore();
  const { orders, create, save } = useOrders();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const existing = orders.find((order) => order.quote.id === quote.id);
  return (
    <div className="create-order">
      <div>
        <strong>
          {existing
            ? `Vinculado à ${existing.number}`
            : "Do orçamento para a ordem de serviço"}
        </strong>
        <p>Guarde o diagnóstico deste aparelho e acompanhe o reparo.</p>
      </div>
      <button
        className="primary"
        onClick={() => {
          try {
            const order = existing ? syncExisting() : create(quote, diagnoses);
            navigate(`/ordens?os=${order.id}`);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Não foi possível criar a ordem de serviço.",
            );
          }
        }}
      >
        <ClipboardCheck size={17} />
        {existing ? "Atualizar e abrir OS" : "Criar ordem de serviço"}
      </button>
      {error && (
        <p role="alert" className="order-error">
          {error}
        </p>
      )}
    </div>
  );
  function syncExisting() {
    const updated = syncOrderBudget(existing!, quote, diagnoses);
    save(updated);
    return updated;
  }
}
function Checklist({
  order,
  phase,
  onError,
}: {
  order: ServiceOrder;
  phase: "before" | "after";
  onError: (error: string) => void;
}) {
  const save = useOrders((s) => s.save);
  const label = phase === "before" ? "Antes do reparo" : "Após o reparo";
  const checks = order[phase];
  return (
    <section className="order-checklist">
      <h3>
        <ClipboardCheck size={16} />
        {label}{" "}
        <span>
          {checks.filter((check) => check.result !== "Não verificado").length}/
          {checks.length}
        </span>
      </h3>
      {checks.map((check) => (
        <FormField key={check.id} label={check.name}>
          <select
            disabled={closed(order)}
            aria-label={`${label}: ${check.name}`}
            value={check.result}
            onChange={(e) => {
              try {
                const result = e.target.value as CheckResult;
                save(setOrderCheck(order, phase, check.id, result));
                onError("");
              } catch (error) {
                onError(
                  error instanceof Error
                    ? error.message
                    : "Não foi possível salvar o checklist.",
                );
              }
            }}
          >
            {(
              [
                "Não verificado",
                "Funcionando",
                "Com falha",
                "Não se aplica",
              ] as CheckResult[]
            ).map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </FormField>
      ))}
    </section>
  );
}
function OrderDetails({
  order,
  onSelect,
}: {
  order: ServiceOrder;
  onSelect: (id: string) => void;
}) {
  const { orders, save } = useOrders();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fields, setFields] = useState({
    technician: order.technician,
    dueDate: order.dueDate,
    serialNumber: order.serialNumber,
    accessories: order.accessories,
    condition: order.condition,
    internalNotes: order.internalNotes,
  });
  const [approval, setApproval] = useState<CustomerApproval["state"]>(
    order.approval.state,
  );
  const [approvalNote, setApprovalNote] = useState(order.approval.note);
  useEffect(() => {
    setFields({
      technician: order.technician,
      dueDate: order.dueDate,
      serialNumber: order.serialNumber,
      accessories: order.accessories,
      condition: order.condition,
      internalNotes: order.internalNotes,
    });
    setApproval(order.approval.state);
    setApprovalNote(order.approval.note);
    setError("");
    setNotice("");
  }, [order.id]);
  const act = (fn: () => ServiceOrder, message: string) => {
    try {
      save(fn());
      setError("");
      setNotice(message);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível salvar a alteração.",
      );
      setNotice("");
    }
  };
  const customerHistory = relatedCustomerOrders(order, orders);
  return (
    <article className="order-details">
      <div className="order-detail-heading">
        <div>
          <span className="eyebrow">ATENDIMENTO / {order.number}</span>
          <h2>{order.quote.customer.name}</h2>
          <p>{order.quote.device}</p>
        </div>
        <span className={`status-pill ${isOverdue(order) ? "overdue" : ""}`}>
          {isOverdue(order) ? "Prazo vencido" : order.status}
        </span>
      </div>
      <div className="order-summary">
        <span>
          Criada em <strong>{dateTime(order.createdAt)}</strong>
        </span>
        <span>
          Telefone{" "}
          <strong>{order.quote.customer.phone || "Não informado"}</strong>
        </span>
        <span>
          Orçamento <strong>{money(total(order.quote))}</strong>
        </span>
      </div>
      {error && (
        <p className="order-error" role="alert">
          {error}
        </p>
      )}
      <p className="notice" role="status">
        {notice}
      </p>
      <div className="order-status-row">
        <FormField label="Etapa do atendimento">
          <select
            value={order.status}
            onChange={(e) =>
              act(
                () => changeStatus(order, e.target.value as OrderStatus),
                "Etapa atualizada e registrada no histórico.",
              )
            }
          >
            {orderStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </FormField>
        <button
          onClick={() => {
            loadWorkspace(order);
            navigate("/");
          }}
        >
          <FileText size={16} />
          Abrir na bancada 3D
        </button>
        <button
          onClick={() => {
            loadWorkspace(order);
            navigate("/cliente");
          }}
        >
          <UserRound size={16} />
          Apresentar ao cliente
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act(
            () =>
              withHistory(
                { ...order, ...fields },
                "Dados de entrada, responsável e notas internas atualizados.",
              ),
            "Dados de atendimento salvos.",
          );
        }}
      >
        <fieldset disabled={closed(order)}>
          <legend>Entrada do aparelho</legend>
          <div className="form-grid">
            <FormField label="Técnico responsável">
              <input
                value={fields.technician}
                onChange={(e) =>
                  setFields({ ...fields, technician: e.target.value })
                }
                placeholder="Nome do técnico"
              />
            </FormField>
            <FormField label="Data prevista de entrega">
              <input
                type="date"
                value={fields.dueDate}
                onChange={(e) =>
                  setFields({ ...fields, dueDate: e.target.value })
                }
              />
            </FormField>
            <FormField label="Identificação do aparelho (IMEI ou série)">
              <input
                value={fields.serialNumber}
                onChange={(e) =>
                  setFields({ ...fields, serialNumber: e.target.value })
                }
              />
            </FormField>
            <FormField label="Acessórios recebidos">
              <input
                placeholder="Ex.: capa e carregador"
                value={fields.accessories}
                onChange={(e) =>
                  setFields({ ...fields, accessories: e.target.value })
                }
              />
            </FormField>
            <FormField label="Condição de entrada">
              <textarea
                placeholder="Riscos, trincas e condições observadas"
                value={fields.condition}
                onChange={(e) =>
                  setFields({ ...fields, condition: e.target.value })
                }
              />
            </FormField>
            <FormField label="Notas internas da assistência">
              <textarea
                value={fields.internalNotes}
                onChange={(e) =>
                  setFields({ ...fields, internalNotes: e.target.value })
                }
              />
            </FormField>
          </div>
          <p className="muted">
            As notas internas ficam na OS e não aparecem no modo cliente ou no
            PDF do orçamento.
          </p>
          <button type="submit">Salvar dados de entrada</button>
        </fieldset>
      </form>
      <section className="order-approval">
        <h3>Autorização do orçamento</h3>
        <p className="muted">
          Registre a resposta recebida do cliente. Este registro manual não
          equivale a assinatura digital.
        </p>
        <div className="form-grid">
          <FormField label="Resposta do cliente">
            <select
              disabled={closed(order)}
              value={approval}
              onChange={(e) =>
                setApproval(e.target.value as CustomerApproval["state"])
              }
            >
              {["Pendente", "Aprovado", "Recusado"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Como a resposta foi recebida">
            <input
              disabled={closed(order)}
              placeholder="Ex.: confirmação por WhatsApp, em 12/10"
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
            />
          </FormField>
        </div>
        <button
          disabled={closed(order)}
          onClick={() =>
            act(
              () => registerApproval(order, approval, approvalNote),
              "Resposta do cliente registrada.",
            )
          }
        >
          Registrar resposta do cliente
        </button>
        <p className="approval-summary">
          Registro atual: <strong>{order.approval.state}</strong>
          {order.approval.recordedAt &&
            ` · ${dateTime(order.approval.recordedAt)}`}
        </p>
      </section>
      <div className="order-checklists">
        <Checklist order={order} phase="before" onError={setError} />
        <Checklist order={order} phase="after" onError={setError} />
      </div>
      <section className="order-parts">
        <h3>Peças e diagnóstico deste atendimento</h3>
        {order.quote.items.map((item) => (
          <div key={item.id}>
            <strong>{item.name}</strong>
            <p>{item.problem || "Diagnóstico ainda não informado."}</p>
            <span>
              {money(item.partPrice)} + {money(item.laborPrice)} de mão de obra
            </span>
          </div>
        ))}
        <p className="muted">
          O orçamento e o diagnóstico são cópias deste atendimento. Ao editar na
          bancada, use “Atualizar e abrir OS” para salvar a nova versão.
          Alterações no orçamento exigem nova aprovação.
        </p>
      </section>
      <section className="order-history">
        <h3>
          <Clock size={16} />
          Histórico do atendimento
        </h3>
        <ol>
          {[...order.history].reverse().map((event) => (
            <li key={event.id}>
              <time>{dateTime(event.at)}</time>
              <span>{event.description}</span>
            </li>
          ))}
        </ol>
      </section>
      {customerHistory.length > 0 && (
        <section className="customer-history">
          <h3>Outras OS com este telefone</h3>
          {customerHistory.map((other) => (
            <button key={other.id} onClick={() => onSelect(other.id)}>
              {other.number} · {other.quote.device} · {other.status}
            </button>
          ))}
        </section>
      )}
    </article>
  );
}
export default function ServiceOrders() {
  const { orders, storageError, syncError, hydrate } = useOrders();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "Todos">("Todos");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  const selected = orders.find((o) => o.id === params.get("os"));
  const filtered = matchingOrders(orders, query, status);
  const select = (id: string) => setParams({ os: id });
  function exportList() {
    const url = URL.createObjectURL(
      new Blob([orderListCsv(filtered)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "cellvision-ordens.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Lista filtrada exportada. O CSV não contém notas internas ou checklists.",
    );
  }
  function newService() {
    useStore.getState().newQuote();
    navigate("/");
  }
  const card = (order: ServiceOrder) => (
    <button
      key={order.id}
      className={`order-card ${selected?.id === order.id ? "selected" : ""} ${isOverdue(order) ? "overdue" : ""}`}
      aria-label={`Abrir ${order.number} de ${order.quote.customer.name}`}
      onClick={() => select(order.id)}
    >
      <div>
        <strong>{order.number}</strong>
        <span className="status-pill">{order.status}</span>
      </div>
      <h3>{order.quote.customer.name}</h3>
      <p>{order.quote.device}</p>
      <div className="order-card-meta">
        <span>{order.technician || "Sem responsável"}</span>
        <strong>{money(total(order.quote))}</strong>
      </div>
      <small>
        {isOverdue(order) ? "Prazo vencido · " : ""}
        {dateLabel(order.dueDate)}
      </small>
    </button>
  );
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={14} />
        Voltar à bancada
      </Link>
      <div className="workspace-title order-page-heading">
        <div>
          <span className="eyebrow">GESTÃO DA ASSISTÊNCIA</span>
          <h1>
            Do diagnóstico à entrega<span>.</span>
          </h1>
          <p>Um atendimento organizado, com cada etapa registrada.</p>
        </div>
        <button className="primary" onClick={newService}>
          <Plus size={17} />
          Novo atendimento
        </button>
      </div>
      {storageError && (
        <p role="alert" className="order-error">
          {storageError}
        </p>
      )}
      {!storageError && syncError && (
        <p role="status" className="notice">{syncError}</p>
      )}
      <div className="order-metrics">
        <div>
          <FileText size={19} />
          <span>
            Em andamento
            <strong>{orders.filter((o) => !closed(o)).length}</strong>
          </span>
        </div>
        <div>
          <Clock size={19} />
          <span>
            Prazo vencido
            <strong>{orders.filter((o) => isOverdue(o)).length}</strong>
          </span>
        </div>
        <div>
          <UserRound size={19} />
          <span>
            Aguardando aprovação
            <strong>
              {orders.filter((o) => o.status === "Aguardando aprovação").length}
            </strong>
          </span>
        </div>
        <div>
          <ClipboardCheck size={19} />
          <span>
            Prontas para retirada
            <strong>
              {orders.filter((o) => o.status === "Pronto para retirada").length}
            </strong>
          </span>
        </div>
      </div>
      <div className="order-toolbar">
        <FormField label="Buscar ordens de serviço">
          <div className="search-input">
            <Search size={17} />
            <input
              placeholder="Cliente, OS, aparelho ou técnico"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </FormField>
        <FormField label="Filtrar por status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus | "Todos")}
          >
            <option>Todos</option>
            {orderStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </FormField>
        <div className="order-view-buttons">
          <button
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={16} />
            Lista
          </button>
          <button
            aria-pressed={view === "kanban"}
            onClick={() => setView("kanban")}
          >
            <LayoutGrid size={16} />
            Kanban
          </button>
          <button onClick={exportList}>
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>
      <p className="notice" role="status">
        {notice}
      </p>
      <div className={`orders-layout ${selected ? "has-detail" : ""}`}>
        <section className="orders-board" aria-label="Ordens de serviço">
          <div className="orders-result-count">
            {filtered.length} atendimento{filtered.length !== 1 ? "s" : ""}
            {selected && (
              <button onClick={() => setParams({})}>Fechar detalhes</button>
            )}
          </div>
          {filtered.length === 0 ? (
            <div className="orders-empty">
              <ClipboardCheck size={32} />
              <h2>
                {orders.length
                  ? "Nenhum atendimento encontrado"
                  : "Sua primeira OS começa no 3D"}
              </h2>
              <p>
                {orders.length
                  ? "Ajuste a busca ou o filtro de status."
                  : "Registre o diagnóstico, preencha o cliente e crie uma OS a partir do orçamento."}
              </p>
              <Link className="back-link" to="/">
                Ir à bancada →
              </Link>
            </div>
          ) : view === "list" ? (
            <div className="orders-list">{filtered.map(card)}</div>
          ) : (
            <div className="kanban">
              {orderStatuses.map((s) => (
                <section className="kanban-column" key={s}>
                  <h2>
                    {s}
                    <span>{filtered.filter((o) => o.status === s).length}</span>
                  </h2>
                  {filtered.filter((o) => o.status === s).map(card)}
                </section>
              ))}
            </div>
          )}
        </section>
        {selected && <OrderDetails order={selected} onSelect={select} />}
      </div>
      <p className="muted">
        Ordens salvas apenas neste navegador. Aprovações são registros manuais
        da assistência. Para dados compartilhados entre funcionários será
        necessário autenticação e armazenamento com controle de acesso.
      </p>
    </>
  );
}
