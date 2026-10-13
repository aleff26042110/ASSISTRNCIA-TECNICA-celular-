import { describe, it, expect } from "vitest";
import {
  changeStatus,
  createServiceOrder,
  isOverdue,
  matchingOrders,
  orderListCsv,
  registerApproval,
  relatedCustomerOrders,
  setOrderCheck,
  syncOrderBudget,
} from "./orders";
import type { RepairQuote } from "./types";
const quote = (): RepairQuote => ({
  id: "quote-a",
  customer: { name: "Ana Souza", phone: "(11) 99999-1234" },
  device: "Aparelho de teste",
  date: "2026-10-12",
  items: [
    {
      id: "part-a",
      componentId: "main-camera",
      name: "Câmera principal",
      problem: "Sem imagem",
      partPrice: 150,
      laborPrice: 50,
    },
  ],
  discount: 0,
  deadline: "2 dias úteis",
  notes: "",
});
const make = () => createServiceOrder(quote(), {}, 1);
describe("Ordens de serviço", () => {
  it("cria snapshot independente do orçamento e diagnóstico", () => {
    const q = quote();
    const diagnoses = {};
    const o = createServiceOrder(q, diagnoses, 1);
    q.customer.name = "Outro cliente";
    q.items[0].partPrice = 1;
    expect(o.quote.customer.name).toBe("Ana Souza");
    expect(o.quote.items[0].partPrice).toBe(150);
    expect(o.before).not.toBe(o.after);
    expect(o.number).toBe("OS-0001");
    expect(o.history).toHaveLength(1);
  });
  it("exige cliente e peças para criar atendimento", () => {
    expect(() =>
      createServiceOrder(
        { ...quote(), customer: { name: "", phone: "" } },
        {},
        1,
      ),
    ).toThrow("nome do cliente");
    expect(() => createServiceOrder({ ...quote(), items: [] }, {}, 1)).toThrow(
      "pelo menos uma peça",
    );
  });
  it("exige resposta explícita e aprovação antes do reparo", () => {
    const o = make();
    expect(() => changeStatus(o, "Em reparo")).toThrow("aprovação");
    expect(() => registerApproval(o, "Aprovado", "")).toThrow("resposta");
    const approved = registerApproval(
      o,
      "Aprovado",
      "Cliente confirmou pelo telefone",
    );
    expect(changeStatus(approved, "Em reparo").status).toBe("Em reparo");
    expect(approved.history).toHaveLength(2);
  });
  it("não entrega aparelho sem checklist pós-reparo concluído e sem falhas", () => {
    let o = registerApproval(make(), "Aprovado", "Na loja");
    expect(() => changeStatus(o, "Entregue")).toThrow("checklist");
    for (const c of o.after) o = setOrderCheck(o, "after", c.id, "Funcionando");
    o = changeStatus(o, "Pronto para retirada");
    const failed = setOrderCheck(o, "after", o.after[0].id, "Com falha");
    expect(failed.status).toBe("Em reparo");
    expect(() => changeStatus(failed, "Entregue")).toThrow("checklist");
    expect(changeStatus(o, "Entregue").status).toBe("Entregue");
  });
  it("invalida aprovação quando orçamento muda e mantém os registros anteriores", () => {
    const o = changeStatus(
      registerApproval(make(), "Aprovado", "Por mensagem"),
      "Em reparo",
    );
    const q = structuredClone(o.quote);
    q.items[0].partPrice = 200;
    const next = syncOrderBudget(o, q, {});
    expect(next.approval.state).toBe("Pendente");
    expect(next.status).toBe("Aguardando aprovação");
    expect(next.history).toHaveLength(o.history.length + 1);
    expect(o.approval.state).toBe("Aprovado");
  });
  it("mantém aprovação para snapshot idêntico e bloqueia alteração de OS encerrada", () => {
    let o = registerApproval(make(), "Aprovado", "Na loja");
    for (const c of o.after) o = setOrderCheck(o, "after", c.id, "Funcionando");
    o = changeStatus(o, "Entregue");
    expect(syncOrderBudget(o, structuredClone(o.quote), {})).toBe(o);
    expect(() => syncOrderBudget(o, { ...o.quote, discount: 10 }, {})).toThrow(
      "encerrada",
    );
    expect(() => setOrderCheck(o, "after", o.after[0].id, "Com falha")).toThrow(
      "Reabra",
    );
  });
  it("filtra e prioriza prazos vencidos sem tratar OS encerrada como atrasada", () => {
    const old = { ...make(), id: "old", dueDate: "2000-01-01" };
    const upcoming = {
      ...make(),
      id: "next",
      technician: "Bruno",
      dueDate: "2099-01-01",
    };
    expect(isOverdue(old, "2026-10-12")).toBe(true);
    expect(isOverdue({ ...old, status: "Entregue" }, "2026-10-12")).toBe(false);
    expect(matchingOrders([upcoming, old], "", "Todos")[0].id).toBe("old");
    expect(matchingOrders([upcoming, old], "Bruno", "Todos")).toHaveLength(1);
    expect(matchingOrders([upcoming, old], "", "Entregue")).toHaveLength(0);
  });
  it("histórico de cliente compara telefone, sem agrupar nomes iguais", () => {
    const a = make();
    const b = {
      ...make(),
      id: "b",
      quote: {
        ...quote(),
        customer: { name: "Ana Souza", phone: "11999991234" },
      },
    };
    const c = {
      ...make(),
      id: "c",
      quote: {
        ...quote(),
        customer: { name: "Ana Souza", phone: "11988881234" },
      },
    };
    expect(relatedCustomerOrders(a, [a, b, c])).toEqual([b]);
    expect(
      relatedCustomerOrders(
        {
          ...a,
          quote: { ...quote(), customer: { name: "Ana Souza", phone: "" } },
        },
        [b, c],
      ),
    ).toEqual([]);
  });
  it("exporta CSV sem notas privadas e neutraliza fórmulas", () => {
    const o = make();
    o.quote.customer.name = '=HYPERLINK("url")';
    o.internalNotes = "SEGREDO INTERNO";
    const csv = orderListCsv([o]);
    expect(csv).toContain('"\'=HYPERLINK(""url"")"');
    expect(csv).not.toContain("SEGREDO INTERNO");
    expect(csv).toContain("200,00");
  });
});
