import type { RepairQuote, ServiceOrder } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!response.ok) {
    const body: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${response.status} ao acessar o servidor.`);
  }
  return response.json();
}

export const api = {
  orders: {
    list: () => request<ServiceOrder[]>("/orders"),
    replace: (orders: ServiceOrder[]) => request<ServiceOrder[]>("/orders", { method: "PUT", body: JSON.stringify(orders) }),
    save: (order: ServiceOrder) => request<ServiceOrder>(`/orders/${encodeURIComponent(order.id)}`, { method: "PUT", body: JSON.stringify(order) }),
  },
  quotes: {
    list: () => request<RepairQuote[]>("/quotes"),
    replace: (quotes: RepairQuote[]) => request<RepairQuote[]>("/quotes", { method: "PUT", body: JSON.stringify(quotes) }),
  },
};
