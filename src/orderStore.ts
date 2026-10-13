import { create } from "zustand";
import type { RepairDiagnosis, RepairQuote, ServiceOrder } from "./types";
import { createServiceOrder } from "./orders";
import { api } from "./api";
export interface OrderRepository {
  load(): ServiceOrder[];
  save(orders: ServiceOrder[]): void;
}
const key = "cellvision-service-orders";
export const localOrderRepository: OrderRepository = {
  load() {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (
      !Array.isArray(data) ||
      data.some(
        (o) =>
          !o.id ||
          !o.quote ||
          !Array.isArray(o.before) ||
          !Array.isArray(o.after) ||
          !Array.isArray(o.history),
      )
    )
      throw new Error(
        "Os dados de OS estão indisponíveis ou inválidos. Preserve o armazenamento e recarregue a página.",
      );
    return data;
  },
  save(orders) {
    localStorage.setItem(key, JSON.stringify(orders));
  },
};
let initial: ServiceOrder[] = [];
let storageError = "";
try {
  initial = localOrderRepository.load();
} catch {
  storageError =
    "Não foi possível carregar as ordens de serviço deste navegador. Não crie novos registros até recuperar o armazenamento.";
}
interface OrdersState {
  orders: ServiceOrder[];
  storageError: string;
  syncError: string;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  create: (
    quote: RepairQuote,
    diagnoses: Record<string, RepairDiagnosis>,
  ) => ServiceOrder;
  save: (order: ServiceOrder) => void;
}
export const useOrders = create<OrdersState>((set, get) => ({
  orders: initial,
  storageError,
  syncError: "",
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated || get().storageError) return;
    set({ hydrated: true });
    try {
      const remote = await api.orders.list();
      const byId = new Map(remote.map((order) => [order.id, order]));
      for (const local of get().orders) {
        const server = byId.get(local.id);
        if (!server || local.updatedAt > server.updatedAt) byId.set(local.id, local);
      }
      const merged = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      localOrderRepository.save(merged);
      set({ orders: merged, syncError: "" });
      if (JSON.stringify(merged) !== JSON.stringify(remote)) await api.orders.replace(merged);
    } catch {
      set({ syncError: "Servidor indisponível; alterações serão mantidas neste navegador." });
    }
  },
  create: (quote, diagnoses) => {
    if (get().storageError) throw new Error(get().storageError);
    const existing = get().orders.find((o) => o.quote.id === quote.id);
    if (existing) return existing;
    const sequence =
      Math.max(
        0,
        ...get().orders.map((o) => Number(o.number.replace("OS-", "")) || 0),
      ) + 1;
    const order = createServiceOrder(quote, diagnoses, sequence);
    const next = [order, ...get().orders];
    try {
      localOrderRepository.save(next);
    } catch {
      throw new Error(
        "Não foi possível salvar a OS. O armazenamento local pode estar cheio ou bloqueado.",
      );
    }
    set({ orders: next });
    void api.orders.save(order).then(
      () => set({ syncError: "" }),
      () => set({ syncError: "Servidor indisponível; a OS ficou salva somente neste navegador." }),
    );
    return order;
  },
  save: (order) => {
    if (get().storageError) throw new Error(get().storageError);
    if (!get().orders.some((o) => o.id === order.id))
      throw new Error("Ordem de serviço não encontrada.");
    const next = get().orders.map((o) => (o.id === order.id ? order : o));
    try {
      localOrderRepository.save(next);
    } catch {
      throw new Error(
        "Não foi possível salvar. O armazenamento local pode estar cheio ou bloqueado.",
      );
    }
    set({ orders: next });
    void api.orders.save(order).then(
      () => set({ syncError: "" }),
      () => set({ syncError: "Servidor indisponível; a alteração ficou salva somente neste navegador." }),
    );
  },
}));
