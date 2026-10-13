import type {
  CustomerApproval,
  DeviceCheck,
  OrderStatus,
  RepairDiagnosis,
  RepairQuote,
  ServiceOrder,
} from "./types";
import { total } from "./services";
export const orderStatuses: OrderStatus[] = [
  "Recebido",
  "Em diagnóstico",
  "Aguardando aprovação",
  "Aguardando peça",
  "Em reparo",
  "Pronto para retirada",
  "Entregue",
  "Cancelado",
];
export const checkNames = [
  "Tela e toque",
  "Câmera principal",
  "Câmera frontal",
  "Carregamento",
  "Áudio e microfone",
  "Botões e conectividade",
];
export const freshChecks = (): DeviceCheck[] =>
  checkNames.map((name, i) => ({
    id: `check-${i}`,
    name,
    result: "Não verificado",
  }));
export const localDate = (now = new Date()) => now.toLocaleDateString("sv-SE");
export function isOverdue(order: ServiceOrder, today = localDate()) {
  return (
    !!order.dueDate &&
    order.dueDate < today &&
    !["Entregue", "Cancelado"].includes(order.status)
  );
}
export function createServiceOrder(
  quote: RepairQuote,
  diagnoses: Record<string, RepairDiagnosis>,
  sequence: number,
): ServiceOrder {
  if (!quote.customer.name.trim())
    throw new Error("Informe o nome do cliente no orçamento.");
  if (!quote.device.trim())
    throw new Error("Informe a marca e o modelo do aparelho.");
  if (!quote.items.length)
    throw new Error(
      "Adicione pelo menos uma peça ao orçamento antes de criar a OS.",
    );
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    number: `OS-${String(sequence).padStart(4, "0")}`,
    createdAt: now,
    updatedAt: now,
    status: "Recebido",
    technician: "",
    dueDate: "",
    serialNumber: "",
    accessories: "",
    condition: "",
    internalNotes: "",
    quote: structuredClone(quote),
    diagnoses: structuredClone(diagnoses),
    before: freshChecks(),
    after: freshChecks(),
    approval: { state: "Pendente", recordedAt: null, note: "" },
    history: [
      {
        id: crypto.randomUUID(),
        at: now,
        description: "Ordem de serviço criada a partir do orçamento 3D.",
      },
    ],
  };
}
export function withHistory(
  order: ServiceOrder,
  description: string,
): ServiceOrder {
  const at = new Date().toISOString();
  return {
    ...order,
    updatedAt: at,
    history: [...order.history, { id: crypto.randomUUID(), at, description }],
  };
}
export function changeStatus(
  order: ServiceOrder,
  status: OrderStatus,
): ServiceOrder {
  if (status === order.status) return order;
  if (
    ["Em reparo", "Pronto para retirada", "Entregue"].includes(status) &&
    order.approval.state !== "Aprovado"
  )
    throw new Error(
      "Registre a aprovação do cliente antes de avançar o reparo.",
    );
  if (
    ["Pronto para retirada", "Entregue"].includes(status) &&
    order.after.some(
      (check) =>
        check.result === "Não verificado" || check.result === "Com falha",
    )
  )
    throw new Error(
      "Conclua o checklist após o reparo e resolva as falhas antes da retirada.",
    );
  return withHistory(
    { ...order, status },
    `Status alterado: ${order.status} → ${status}.`,
  );
}
export function registerApproval(
  order: ServiceOrder,
  state: CustomerApproval["state"],
  note: string,
): ServiceOrder {
  if (state !== "Pendente" && !note.trim())
    throw new Error("Descreva como a resposta do cliente foi recebida.");
  if (order.approval.state === state && order.approval.note === note.trim())
    return order;
  if (
    ["Em reparo", "Pronto para retirada", "Entregue"].includes(order.status) &&
    state !== "Aprovado"
  )
    throw new Error(
      "A OS já avançou no reparo. Retorne à etapa de aprovação antes de alterar a autorização.",
    );
  return withHistory(
    {
      ...order,
      approval: {
        state,
        note: note.trim(),
        recordedAt: state === "Pendente" ? null : new Date().toISOString(),
      },
    },
    `Resposta do cliente registrada: ${state}.`,
  );
}
export function syncOrderBudget(
  order: ServiceOrder,
  quote: RepairQuote,
  diagnoses: Record<string, RepairDiagnosis>,
): ServiceOrder {
  if (order.quote.id !== quote.id)
    throw new Error("Este orçamento não corresponde à OS selecionada.");
  if (!quote.customer.name.trim() || !quote.items.length)
    throw new Error("O orçamento precisa de cliente e pelo menos uma peça.");
  const changed = JSON.stringify(order.quote) !== JSON.stringify(quote);
  if (!changed && JSON.stringify(order.diagnoses) === JSON.stringify(diagnoses))
    return order;
  if (["Entregue", "Cancelado"].includes(order.status))
    throw new Error(
      "Uma OS encerrada não pode receber alterações de orçamento.",
    );
  const invalidate = changed && order.approval.state !== "Pendente";
  return withHistory(
    {
      ...order,
      quote: structuredClone(quote),
      diagnoses: structuredClone(diagnoses),
      ...(invalidate
        ? {
            approval: {
              state: "Pendente" as const,
              note: "",
              recordedAt: null,
            },
            status: "Aguardando aprovação" as const,
          }
        : {}),
    },
    invalidate
      ? "Orçamento atualizado; aprovação anterior invalidada. Solicite nova confirmação do cliente."
      : "Orçamento e diagnóstico atualizados pela bancada 3D.",
  );
}
export function matchingOrders(
  orders: ServiceOrder[],
  query: string,
  status: OrderStatus | "Todos",
) {
  const term = query.trim().toLocaleLowerCase("pt-BR");
  return orders
    .filter(
      (o) =>
        (status === "Todos" || o.status === status) &&
        [
          o.number,
          o.quote.customer.name,
          o.quote.customer.phone,
          o.quote.device,
          o.technician,
          o.serialNumber,
        ].some((s) => s.toLocaleLowerCase("pt-BR").includes(term)),
    )
    .sort(
      (a, b) =>
        Number(isOverdue(b)) - Number(isOverdue(a)) ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
        b.createdAt.localeCompare(a.createdAt),
    );
}
export function relatedCustomerOrders(
  order: ServiceOrder,
  orders: ServiceOrder[],
) {
  const phone = order.quote.customer.phone.replace(/\D/g, "");
  if (phone.length < 10) return [];
  return orders.filter(
    (other) =>
      other.id !== order.id &&
      other.quote.customer.phone.replace(/\D/g, "") === phone,
  );
}
const csvCell = (value: string) => {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};
export function orderListCsv(orders: ServiceOrder[]) {
  const rows = [
    [
      "OS",
      "Cliente",
      "Telefone",
      "Aparelho",
      "Responsável",
      "Status",
      "Data de entrega",
      "Aprovação",
      "Valor total",
    ],
    ...orders.map((o) => [
      o.number,
      o.quote.customer.name,
      o.quote.customer.phone,
      o.quote.device,
      o.technician,
      o.status,
      o.dueDate,
      o.approval.state,
      total(o.quote).toFixed(2).replace(".", ","),
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

export function setOrderCheck(
  order: ServiceOrder,
  phase: "before" | "after",
  id: string,
  result: DeviceCheck["result"],
): ServiceOrder {
  if (["Entregue", "Cancelado"].includes(order.status))
    throw new Error("Reabra a OS antes de alterar o checklist.");
  const check = order[phase].find((c) => c.id === id);
  if (!check) throw new Error("Item de checklist não encontrado.");
  if (check.result === result) return order;
  let updated = {
    ...order,
    [phase]: order[phase].map((c) => (c.id === id ? { ...c, result } : c)),
  };
  if (
    phase === "after" &&
    order.status === "Pronto para retirada" &&
    ["Não verificado", "Com falha"].includes(result)
  )
    updated = { ...updated, status: "Em reparo" };
  return withHistory(
    updated,
    `${phase === "before" ? "Antes do reparo" : "Após o reparo"}: ${check.name} — ${result}.${updated.status !== order.status ? " Retornado à etapa de reparo." : ""}`,
  );
}
