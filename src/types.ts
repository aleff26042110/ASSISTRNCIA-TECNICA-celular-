export type Vec3 = [number, number, number];
export type ComponentAccuracy = "documented" | "inferred" | "illustrative";
export type ComponentVisual =
  | "slab"
  | "frame"
  | "battery"
  | "board"
  | "camera"
  | "coil"
  | "speaker"
  | "taptic"
  | "connector";
export interface ResearchSource {
  id: string;
  publisher: string;
  title: string;
  url: string;
  kind: "official" | "teardown";
}
export type DiagnosisState =
  | "Não analisado"
  | "Em análise"
  | "Defeito confirmado"
  | "Substituição recomendada"
  | "Funcionando normalmente";
export interface PhoneComponent {
  id: string;
  name: string;
  category: string;
  description: string;
  function: string;
  compatibleModel: string;
  meshId: string;
  originalPosition: Vec3;
  explodedPosition: Vec3;
  size: Vec3;
  color: string;
  symptoms: string[];
  diagnosisState: DiagnosisState;
  stage: number;
  visual: ComponentVisual;
  accuracy: ComponentAccuracy;
  sourceIds: string[];
}
export interface CameraModule extends PhoneComponent {
  megapixels: number;
  lensType: string;
}
export interface SmartphoneModel {
  id: string;
  name: string;
  brand: string;
  demonstration: boolean;
  components: PhoneComponent[];
  disclaimer: string;
  glbUrl?: string;
}
export interface RepairDiagnosis {
  componentId: string;
  symptom: string;
  diagnosis: string;
  state: DiagnosisState;
  notes: string;
  partPrice: number;
  laborPrice: number;
}
export interface Customer {
  name: string;
  phone: string;
}
export interface QuoteItem {
  id: string;
  componentId: string;
  name: string;
  problem: string;
  partPrice: number;
  laborPrice: number;
}
export interface RepairQuote {
  id: string;
  customer: Customer;
  device: string;
  date: string;
  items: QuoteItem[];
  discount: number;
  deadline: string;
  notes: string;
}

export type OrderStatus =
  | "Recebido"
  | "Em diagnóstico"
  | "Aguardando aprovação"
  | "Aguardando peça"
  | "Em reparo"
  | "Pronto para retirada"
  | "Entregue"
  | "Cancelado";
export type CheckResult =
  "Não verificado" | "Funcionando" | "Com falha" | "Não se aplica";
export interface DeviceCheck {
  id: string;
  name: string;
  result: CheckResult;
}
export interface OrderEvent {
  id: string;
  at: string;
  description: string;
}
export interface CustomerApproval {
  state: "Pendente" | "Aprovado" | "Recusado";
  recordedAt: string | null;
  note: string;
}
export interface ServiceOrder {
  id: string;
  number: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  technician: string;
  dueDate: string;
  serialNumber: string;
  accessories: string;
  condition: string;
  internalNotes: string;
  quote: RepairQuote;
  diagnoses: Record<string, RepairDiagnosis>;
  before: DeviceCheck[];
  after: DeviceCheck[];
  approval: CustomerApproval;
  history: OrderEvent[];
}
