import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RepairDiagnosis, RepairQuote } from "./types";
const blank = (): RepairQuote => ({
  id: crypto.randomUUID(),
  customer: { name: "", phone: "" },
  device: "Vision One • demonstrativo",
  date: new Date().toLocaleDateString("sv-SE"),
  items: [],
  discount: 0,
  deadline: "",
  notes: "",
});
export const defaultDiagnosis = (id: string): RepairDiagnosis => ({
  componentId: id,
  symptom: "",
  diagnosis: "",
  state: "Não analisado",
  notes: "",
  partPrice: 0,
  laborPrice: 0,
});
interface State {
  selected: string;
  explosion: number;
  diagnoses: Record<string, RepairDiagnosis>;
  quote: RepairQuote;
  select: (id: string) => void;
  explode: (n: number) => void;
  diagnose: (id: string, patch: Partial<RepairDiagnosis>) => void;
  updateQuote: (patch: Partial<RepairQuote>) => void;
  newQuote: () => void;
}
export const useStore = create<State>()(
  persist(
    (set) => ({
      selected: "main-camera",
      explosion: 0,
      diagnoses: {},
      quote: blank(),
      select: (selected) => set({ selected }),
      explode: (explosion) => set({ explosion }),
      diagnose: (id, patch) =>
        set((s) => ({
          diagnoses: {
            ...s.diagnoses,
            [id]: { ...(s.diagnoses[id] || defaultDiagnosis(id)), ...patch },
          },
        })),
      updateQuote: (patch) => set((s) => ({ quote: { ...s.quote, ...patch } })),
      newQuote: () =>
        set({
          quote: blank(),
          diagnoses: {},
          selected: "main-camera",
          explosion: 0,
        }),
    }),
    {
      name: "cellvision-workspace",
      partialize: (s) => ({
        diagnoses: s.diagnoses,
        quote: s.quote,
        selected: s.selected,
        explosion: s.explosion,
      }),
    },
  ),
);
