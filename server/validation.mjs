const statuses = new Set([
  "Recebido", "Em diagnóstico", "Aguardando aprovação", "Aguardando peça",
  "Em reparo", "Pronto para retirada", "Entregue", "Cancelado",
]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isString = (value, max = 10_000) => typeof value === "string" && value.length <= max;
const isMoney = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10_000_000;
const checkResults = new Set(["Não verificado", "Funcionando", "Com falha", "Não se aplica"]);
const diagnosisStates = new Set(["Não analisado", "Em análise", "Defeito confirmado", "Substituição recomendada", "Funcionando normalmente"]);
const isCheck = (value) => isObject(value) && isString(value.id, 100) && isString(value.name, 300) && checkResults.has(value.result);
const isDiagnosis = (value) => isObject(value) && isString(value.componentId, 100) &&
  isString(value.symptom, 5_000) && isString(value.diagnosis, 10_000) &&
  diagnosisStates.has(value.state) && isString(value.notes, 10_000) &&
  isMoney(value.partPrice) && isMoney(value.laborPrice);

export function isQuote(value) {
  return isObject(value) && isString(value.id, 100) && value.id.length > 0 &&
    isObject(value.customer) && isString(value.customer.name, 200) &&
    isString(value.customer.phone, 40) && isString(value.device, 300) &&
    isString(value.date, 20) && Array.isArray(value.items) && value.items.length <= 200 &&
    value.items.every((item) => isObject(item) && isString(item.id, 100) &&
      isString(item.componentId, 100) && isString(item.name, 300) &&
      isString(item.problem, 5_000) && isMoney(item.partPrice) && isMoney(item.laborPrice)) &&
    isMoney(value.discount) && isString(value.deadline, 200) && isString(value.notes, 10_000);
}

export function isServiceOrder(value) {
  return isObject(value) && isString(value.id, 100) && value.id.length > 0 &&
    isString(value.number, 40) && isString(value.createdAt, 40) &&
    isString(value.updatedAt, 40) && statuses.has(value.status) &&
    isString(value.technician, 200) && isString(value.dueDate, 20) &&
    isString(value.serialNumber, 200) && isString(value.accessories, 2_000) &&
    isString(value.condition, 10_000) && isString(value.internalNotes, 20_000) &&
    isQuote(value.quote) && isObject(value.diagnoses) && Object.keys(value.diagnoses).length <= 500 &&
    Object.values(value.diagnoses).every(isDiagnosis) &&
    Array.isArray(value.before) && value.before.length <= 100 && value.before.every(isCheck) &&
    Array.isArray(value.after) && value.after.length <= 100 && value.after.every(isCheck) &&
    Array.isArray(value.history) && value.history.length <= 5_000 && value.history.every((event) =>
      isObject(event) && isString(event.id, 100) && isString(event.at, 40) && isString(event.description, 5_000)) &&
    isObject(value.approval) && ["Pendente", "Aprovado", "Recusado"].includes(value.approval.state) &&
    (value.approval.recordedAt === null || isString(value.approval.recordedAt, 40)) && isString(value.approval.note, 5_000);
}

export function assertCollection(kind, value) {
  const valid = Array.isArray(value) && value.length <= 10_000 &&
    value.every(kind === "orders" ? isServiceOrder : isQuote);
  if (!valid) {
    const error = new Error(`Coleção de ${kind} inválida.`);
    error.statusCode = 422;
    throw error;
  }
}
