import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import {
  Box,
  Camera,
  ChevronRight,
  Layers,
  RotateCcw,
  Play,
  Pause,
  ArrowLeftRight,
  FileText,
  User,
  Download,
  Printer,
  MessageCircle,
  Check,
  Plus,
  Trash2,
  PanelLeftClose,
  ClipboardCheck,
  ExternalLink,
} from "lucide-react";
const Viewer = lazy(() => import("./Viewer"));
import { components, phone, researchSources } from "./data";
import { defaultDiagnosis, useStore } from "./store";
import { exportPdf, localQuotes, money, total } from "./services";
import { api } from "./api";
import type { DiagnosisState, RepairQuote } from "./types";
import ServiceOrders, { CreateOrderButton } from "./ServiceOrders";
const states: DiagnosisState[] = [
  "Não analisado",
  "Em análise",
  "Defeito confirmado",
  "Substituição recomendada",
  "Funcionando normalmente",
];
function Field({
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
const price = (value: string) => Math.max(0, Number(value) || 0);
function Quote({ client = false }: { client?: boolean }) {
  const { quote: q, updateQuote, newQuote } = useStore();
  const [saved, setSaved] = useState<RepairQuote[]>(() => localQuotes.load());
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (client) return;
    void api.quotes
      .list()
      .then((remote) => {
        const localIds = new Set(saved.map((quote) => quote.id));
        const merged = [
          ...saved,
          ...remote.filter((quote) => !localIds.has(quote.id)),
        ];
        localQuotes.save(merged);
        setSaved(merged);
        if (JSON.stringify(merged) !== JSON.stringify(remote))
          void api.quotes.replace(merged);
      })
      .catch(() => undefined);
  }, [client]);
  async function pdf() {
    try {
      setBusy(true);
      await exportPdf(q);
      setNotice("PDF exportado.");
    } catch {
      setNotice("Não foi possível exportar o PDF. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  function save() {
    try {
      const list = [q, ...saved.filter((x) => x.id !== q.id)];
      localQuotes.save(list);
      setSaved(list);
      setNotice("Orçamento salvo e aguardando sincronização.");
      void api.quotes.replace(list).then(
        () => setNotice("Orçamento salvo e sincronizado."),
        () =>
          setNotice("Orçamento salvo neste navegador; servidor indisponível."),
      );
    } catch {
      setNotice(
        "Armazenamento indisponível. Exporte o PDF para preservar o orçamento.",
      );
    }
  }
  const whatsapp = () => {
    const digits = q.customer.phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setNotice("Informe um telefone com DDD para abrir o WhatsApp.");
      return;
    }
    const text = `Olá, ${q.customer.name}. Orçamento ${q.device}:\n${q.items.map((i) => `${i.name}: ${i.problem || "Reparo informado pelo técnico"} — ${money(i.partPrice + i.laborPrice)}`).join("\n")}\nTotal: ${money(total(q))}\nPrazo: ${q.deadline || "A combinar"}`;
    window.open(
      `https://wa.me/${digits.startsWith("55") ? digits : "55" + digits}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  return (
    <section className="quote">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {client ? "APRESENTAÇÃO LOCAL" : "ORDEM DE SERVIÇO"}
          </span>
          <h2>{client ? "Seu aparelho, explicado." : "Orçamento de reparo"}</h2>
        </div>
        <FileText size={25} />
      </div>
      {!client && (
        <div className="form-grid">
          <Field label="Nome do cliente">
            <input
              value={q.customer.name}
              onChange={(e) =>
                updateQuote({
                  customer: { ...q.customer, name: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Telefone com DDD">
            <input
              type="tel"
              value={q.customer.phone}
              onChange={(e) =>
                updateQuote({
                  customer: { ...q.customer, phone: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Marca e modelo">
            <input
              value={q.device}
              onChange={(e) => updateQuote({ device: e.target.value })}
            />
          </Field>
          <Field label="Data">
            <input
              type="date"
              value={q.date}
              onChange={(e) => updateQuote({ date: e.target.value })}
            />
          </Field>
        </div>
      )}
      {client && (
        <p>
          {q.device} · {q.customer.name || "Cliente"} · {q.date}
        </p>
      )}
      <div className="quote-items">
        {q.items.length === 0 ? (
          <p className="empty">
            Selecione uma peça, registre a avaliação e adicione ao orçamento.
          </p>
        ) : (
          q.items.map((i) => (
            <div className="quote-item" key={i.id}>
              <div>
                <strong>{i.name}</strong>
                <p>{i.problem || "Descrição do problema não informada"}</p>
                {client && (
                  <p>
                    Reparo recomendado: avaliação ou substituição conforme
                    diagnóstico do técnico.
                  </p>
                )}
              </div>
              {client ? (
                <strong>{money(i.partPrice + i.laborPrice)}</strong>
              ) : (
                <>
                  <Field label="Peça (R$)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={i.partPrice}
                      onChange={(e) =>
                        updateQuote({
                          items: q.items.map((x) =>
                            x.id === i.id
                              ? { ...x, partPrice: price(e.target.value) }
                              : x,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label="Mão de obra (R$)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={i.laborPrice}
                      onChange={(e) =>
                        updateQuote({
                          items: q.items.map((x) =>
                            x.id === i.id
                              ? { ...x, laborPrice: price(e.target.value) }
                              : x,
                          ),
                        })
                      }
                    />
                  </Field>
                  <button
                    aria-label={`Remover ${i.name}`}
                    onClick={() =>
                      updateQuote({
                        items: q.items.filter((x) => x.id !== i.id),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
      {!client && (
        <div className="form-grid">
          <Field label="Desconto (R$)">
            <input
              type="number"
              min="0"
              value={q.discount}
              onChange={(e) => updateQuote({ discount: price(e.target.value) })}
            />
          </Field>
          <Field label="Prazo estimado">
            <input
              placeholder="Ex.: 2 dias úteis"
              value={q.deadline}
              onChange={(e) => updateQuote({ deadline: e.target.value })}
            />
          </Field>
          <Field label="Observações do orçamento">
            <textarea
              value={q.notes}
              onChange={(e) => updateQuote({ notes: e.target.value })}
            />
          </Field>
        </div>
      )}
      {client && (
        <p>
          Prazo: {q.deadline || "A combinar"}
          <br />
          {q.notes}
        </p>
      )}
      <div className="total">
        <span>
          Valor total <small>Valores informados pelo técnico</small>
        </span>
        <strong data-testid="total">{money(total(q))}</strong>
      </div>
      <div className="actions">
        {!client && (
          <button className="primary" onClick={save}>
            <Check size={16} />
            Salvar orçamento
          </button>
        )}
        <button disabled={busy} onClick={pdf}>
          <Download size={16} />
          {busy ? "Exportando…" : "Exportar PDF"}
        </button>
        <button onClick={() => window.print()}>
          <Printer size={16} />
          Imprimir
        </button>
        {!client && (
          <button onClick={whatsapp}>
            <MessageCircle size={16} />
            WhatsApp
          </button>
        )}
      </div>
      <p role="status" className="notice">
        {notice}
      </p>
      {!client && (
        <div className="saved">
          <button
            onClick={() => {
              newQuote();
              setNotice("Novo orçamento iniciado.");
            }}
          >
            <Plus size={16} />
            Novo orçamento
          </button>
          {saved.length > 0 && (
            <Field label="Orçamentos salvos">
              <select
                value=""
                onChange={(e) => {
                  const found = saved.find((x) => x.id === e.target.value);
                  if (found) updateQuote(found);
                }}
              >
                <option value="">Abrir orçamento…</option>
                {saved.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.customer.name || "Sem nome"} · {x.date} ·{" "}
                    {money(total(x))}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}
      {!client && <CreateOrderButton />}
      <p className="muted">
        Dados armazenados somente neste navegador. Exporte uma cópia para
        backup. O envio pelo WhatsApp exige sua confirmação no aplicativo.
      </p>
    </section>
  );
}
function Workspace() {
  const {
    selected,
    select,
    explosion,
    explode,
    diagnoses,
    diagnose,
    quote,
    updateQuote,
  } = useStore();
  const [tab, setTab] = useState("viewer");
  const [view, setView] = useState("perspective");
  const [reset, setReset] = useState(0);
  const [quality, setQuality] = useState("Média");
  const [playing, setPlaying] = useState(false);
  const [direction, setDirection] = useState(1);
  const [list, setList] = useState(true);
  const [panel, setPanel] = useState(true);
  const [notice, setNotice] = useState("");
  const part = components.find((p) => p.id === selected)!;
  const d = diagnoses[selected] || defaultDiagnosis(selected);
  useEffect(() => {
    if (tab !== "viewer") setPlaying(false);
  }, [tab]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const s = useStore.getState();
      const next = Math.max(
        0,
        Math.min(
          100,
          s.explosion + (Math.max(0, now - last) / 1000) * 16 * direction,
        ),
      );
      last = now;
      s.explode(next);
      if (
        (direction === -1 && next === 0) ||
        (direction === 1 && next === 100)
      ) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, direction]);
  function add() {
    if (quote.items.some((i) => i.componentId === selected)) {
      setNotice(
        "Esta peça já está no orçamento. Edite os valores na aba Orçamento.",
      );
      return;
    }
    updateQuote({
      items: [
        ...quote.items,
        {
          id: crypto.randomUUID(),
          componentId: selected,
          name: part.name,
          problem: d.diagnosis || d.symptom,
          partPrice: d.partPrice,
          laborPrice: d.laborPrice,
        },
      ],
    });
    setNotice("Peça adicionada ao orçamento.");
  }
  return (
    <>
      <div className="workspace-title">
        <div>
          <span className="eyebrow">BANCADA DIGITAL / NOVA ANÁLISE</span>
          <h1>
            Veja além da superfície<span>.</span>
          </h1>
          <p>Explore os componentes. Transforme diagnósticos em confiança.</p>
        </div>
        <div className="model-badge">
          <span className="dot" />
          IPHONE 15 <small>Estudo técnico educacional</small>
        </div>
      </div>
      <nav className="tabs">
        <button
          className={tab === "viewer" ? "active" : ""}
          onClick={() => setTab("viewer")}
        >
          <Box size={17} />
          Exploração 3D
        </button>
        <button
          className={tab === "quote" ? "active" : ""}
          onClick={() => setTab("quote")}
        >
          <FileText size={17} />
          Orçamento <span className="count">{quote.items.length}</span>
        </button>
        <Link to="/ordens">
          <ClipboardCheck size={17} />
          Ordens de serviço
        </Link>
        <Link to="/cliente">
          <User size={17} />
          Modo cliente
        </Link>
      </nav>
      {tab === "quote" ? (
        <Quote />
      ) : (
        <>
          <div className="mobile-panels">
            <button onClick={() => setList(!list)}>
              <Layers size={16} />
              Componentes
            </button>
            <button onClick={() => setPanel(!panel)}>
              <FileText size={16} />
              Diagnóstico
            </button>
          </div>
          <div
            className={`workbench ${!list ? "hide-list" : ""} ${!panel ? "hide-panel" : ""}`}
          >
            <aside className="parts-panel">
              <div className="panel-heading">
                <h2>
                  Componentes <span>{components.length}</span>
                </h2>
                <button
                  aria-label="Recolher componentes"
                  onClick={() => setList(false)}
                >
                  <PanelLeftClose size={17} />
                </button>
              </div>
              <p className="muted">Selecione uma peça para analisar</p>
              {[
                ...new Set(components.map((component) => component.category)),
              ].map((category) => (
                <div key={category}>
                  <h3>{category}</h3>
                  {components
                    .filter((p) => p.category === category)
                    .map((p) => (
                      <button
                        className={`part-button ${selected === p.id ? "selected" : ""}`}
                        key={p.id}
                        onClick={() => select(p.id)}
                      >
                        {p.category === "Câmeras" ? (
                          <Camera size={17} />
                        ) : (
                          <Layers size={17} />
                        )}
                        <span>{p.name}</span>
                        {diagnoses[p.id]?.state === "Defeito confirmado" ? (
                          <span className="fault-dot" />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                    ))}
                </div>
              ))}
              <div className="demo-note">
                <Box size={18} />
                <p>
                  {phone.disclaimer}
                  <br />
                  <a
                    href={researchSources[2].url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Consultar manual público <ExternalLink size={11} />
                  </a>
                </p>
              </div>
            </aside>
            <main className="viewer-panel">
              <div className="viewer-top">
                <span>
                  <span className="dot" /> VISUALIZAÇÃO AO VIVO
                </span>
                <select
                  aria-label="Qualidade gráfica"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                >
                  {["Baixa", "Média", "Alta"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="canvas-wrap">
                <Suspense
                  fallback={
                    <div className="fallback">Preparando visualizador 3D…</div>
                  }
                >
                  <Viewer view={view} reset={reset} quality={quality} />
                </Suspense>
                <div className="model-label">
                  <span>01 / IPHONE 15</span>
                  <small>RECONSTRUÇÃO EDUCACIONAL</small>
                </div>
                <div className="view-controls">
                  {[
                    ["front", "Frente"],
                    ["back", "Traseira"],
                    ["side", "Lateral"],
                  ].map(([v, label]) => (
                    <button
                      className={view === v ? "active" : ""}
                      key={v}
                      onClick={() => setView(v)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    aria-label="Restaurar câmera"
                    onClick={() => {
                      setView("perspective");
                      setReset(reset + 1);
                    }}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
                <div className="gesture-help">
                  Arraste para girar · Role ou pince para aproximar
                </div>
              </div>
              <div className="explode-controls">
                <div>
                  <span>
                    <Layers size={16} />
                    Desmontagem progressiva
                  </span>
                  <strong>{Math.round(explosion)}%</strong>
                </div>
                <input
                  aria-label="Desmontagem"
                  type="range"
                  min="0"
                  max="100"
                  value={explosion}
                  onChange={(e) => {
                    setPlaying(false);
                    explode(Number(e.target.value));
                  }}
                />
                <div className="range-labels">
                  <span>Montado</span>
                  <span>Visão explodida</span>
                </div>
                <div className="animation-buttons">
                  <button
                    onClick={() => {
                      if (
                        !playing &&
                        ((direction === 1 && explosion === 100) ||
                          (direction === -1 && explosion === 0))
                      )
                        explode(direction === 1 ? 0 : 100);
                      setPlaying(!playing);
                    }}
                  >
                    {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
                    {playing ? "Pausar" : "Continuar"}
                  </button>
                  <button onClick={() => setDirection(-direction)}>
                    <ArrowLeftRight size={15} />
                    Inverter
                  </button>
                  <button
                    onClick={() => {
                      setPlaying(false);
                      explode(0);
                    }}
                  >
                    <RotateCcw size={15} />
                    Restaurar
                  </button>
                </div>
              </div>
            </main>
            <aside className="diagnosis-panel">
              <span className="eyebrow">INSPEÇÃO DO COMPONENTE</span>
              <div className="component-icon">
                <Camera size={25} />
              </div>
              <h2>{part.name}</h2>
              <span className={`accuracy-badge ${part.accuracy}`}>
                {part.accuracy === "documented"
                  ? "Componente documentado"
                  : part.accuracy === "inferred"
                    ? "Posição aproximada"
                    : "Representação ilustrativa"}
              </span>
              <p className="function">{part.function}</p>
              <div className="symptoms">
                <h3>Possíveis sintomas</h3>
                {part.symptoms.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
              <Field label="Estado da peça">
                <select
                  value={d.state}
                  onChange={(e) =>
                    diagnose(selected, {
                      state: e.target.value as DiagnosisState,
                    })
                  }
                >
                  {states.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Sintoma relatado">
                <input
                  placeholder="O que o cliente percebeu?"
                  value={d.symptom}
                  onChange={(e) =>
                    diagnose(selected, { symptom: e.target.value })
                  }
                />
              </Field>
              <Field label="Diagnóstico técnico">
                <textarea
                  placeholder="Registre sua avaliação…"
                  value={d.diagnosis}
                  onChange={(e) =>
                    diagnose(selected, { diagnosis: e.target.value })
                  }
                />
              </Field>
              <Field label="Observações da peça">
                <textarea
                  value={d.notes}
                  onChange={(e) =>
                    diagnose(selected, { notes: e.target.value })
                  }
                />
              </Field>
              <div className="price-grid">
                <Field label="Peça (R$)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={d.partPrice}
                    onChange={(e) =>
                      diagnose(selected, { partPrice: price(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Mão de obra (R$)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={d.laborPrice}
                    onChange={(e) =>
                      diagnose(selected, { laborPrice: price(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <button className="primary full" onClick={add}>
                <Plus size={17} />
                Adicionar ao orçamento
              </button>
              <p role="status" className="notice">
                {notice}
              </p>
              <p className="muted">
                O diagnóstico depende da avaliação do técnico. Nenhum defeito é
                detectado automaticamente.
              </p>
            </aside>
          </div>
          {(!list || !panel) && (
            <div className="restore-panels">
              {!list && (
                <button onClick={() => setList(true)}>Abrir componentes</button>
              )}
              {!panel && (
                <button onClick={() => setPanel(true)}>
                  Abrir diagnóstico
                </button>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
export default function App() {
  return (
    <>
      <header>
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Box size={23} />
          </span>
          cellvision<span className="brand-3d">3D</span>
        </Link>
        <div className="header-caption">A NOVA PERSPECTIVA DO REPARO</div>
        <span className="local-badge">
          <span className="dot" />
          Ambiente local
        </span>
      </header>
      <div className="app-body">
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/ordens" element={<ServiceOrders />} />
          <Route
            path="/cliente"
            element={
              <>
                <Link className="back-link" to="/">
                  ← Voltar à bancada
                </Link>
                <p className="muted">
                  Modo de apresentação neste dispositivo. Nenhum link público ou
                  dado privado foi publicado.
                </p>
                <Quote client />
              </>
            }
          />
          <Route
            path="*"
            element={
              <>
                <h1>Página não encontrada</h1>
                <Link to="/">Voltar à bancada</Link>
              </>
            }
          />
        </Routes>
      </div>
      <footer>
        <span>
          CellVision 3D <span className="muted">/ Oficina digital</span>
        </span>
        <span>Precisão na análise. Clareza no atendimento.</span>
      </footer>
    </>
  );
}
