import { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || '/api';
const AUTH_KEY = 'icr_auth';

// ── Utilidades ────────────────────────────────────────────────────────────────

const fmtCOP = v => {
  const n = parseFloat(v);
  if (v == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
};
const fmtPct  = v => v == null ? '—' : `${(parseFloat(v) * 100).toFixed(0)}%`;
const fmtDate = v => !v ? '—' : new Date(v + 'T00:00:00').toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });

const headers = token => ({ Authorization: `Basic ${token}`, 'Content-Type': 'application/json' });

async function api(token, path, opts = {}) {
  const res = await fetch(`${API}/icr/${path}`, { headers: headers(token), ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || `HTTP ${res.status}`);
  return data;
}

// ── Componentes base ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = '#00853f' }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', borderLeft: `4px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,.07)', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1a2535', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#777', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const ESTADO_CFG = {
  sin_evaluar: { bg: '#f0f0f0', fg: '#555',     label: 'SIN EVALUAR' },
  preinscrita: { bg: '#fff3cd', fg: '#856404',   label: 'PREINSCRITA'  },
  no_elegible: { bg: '#fdecea', fg: '#c0392b',   label: 'NO ELEGIBLE'  },
  inscrita:    { bg: '#e6f4ec', fg: '#00853f',   label: 'INSCRITA'     },
  anulada:     { bg: '#e0e0e0', fg: '#555',      label: 'ANULADA'      },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.sin_evaluar;
  return <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.fg }}>{cfg.label}</span>;
}

function TipoTag({ tipo }) {
  const colors = { pequeño: '#2980b9', mediano: '#8e44ad', grande: '#e67e22' };
  return <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: colors[tipo] || '#aaa', color: '#fff' }}>{tipo?.toUpperCase()}</span>;
}

function Btn({ onClick, disabled, color = '#00853f', children, small }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '5px 12px' : '8px 18px', borderRadius: 8, border: 'none',
      background: disabled ? '#ccc' : color, color: '#fff', fontWeight: 700,
      fontSize: small ? 12 : 13, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

function BtnOutline({ onClick, color = '#2980b9', children }) {
  return (
    <button onClick={onClick} style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${color}`, background: '#fff', color, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
      {children}
    </button>
  );
}

function Msg({ msg }) {
  if (!msg) return null;
  return <span style={{ fontSize: 13, color: msg.ok ? '#00853f' : '#c0392b', fontWeight: 600 }}>{msg.text}</span>;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '90%', maxWidth: wide ? 820 : 540, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: '#1a2535' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, set, type = 'text', placeholder, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>{label}{required && ' *'}</label>
      {type === 'checkbox' ? (
        <input type="checkbox" checked={!!value} onChange={e => set(e.target.checked)} />
      ) : type === 'select' ? null : (
        <input type={type} value={value || ''} onChange={e => set(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' }} />
      )}
    </div>
  );
}

// ── Modal Auditoría ───────────────────────────────────────────────────────────

function AuditoriaModal({ inscripcion, token, onClose }) {
  const [reglas, setReglas] = useState([]);
  useEffect(() => {
    if (!inscripcion) return;
    api(token, `auditoria/?inscripcion_id=${inscripcion.id}`).then(d => setReglas(d.evaluaciones || [])).catch(() => {});
  }, [inscripcion, token]);

  if (!inscripcion) return null;
  return (
    <Modal title="Auditoría de Reglas" onClose={onClose} wide>
      <div style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>Op. {inscripcion.id_agros} — {inscripcion.tipo_productor} — {fmtCOP(inscripcion.valor_credito)}</div>
      {reglas.length === 0 ? <p style={{ color: '#aaa', textAlign: 'center' }}>Sin evaluaciones registradas.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#f5f7fa' }}>
            {['Código', 'Valor Evaluado', 'Resultado', 'Descripción'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#555', fontWeight: 600, borderBottom: '1px solid #e0e0e0' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {reglas.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.codigo_regla}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{r.valor_evaluado}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: r.resultado ? '#e6f4ec' : '#fdecea', color: r.resultado ? '#00853f' : '#c0392b' }}>
                    {r.resultado ? 'PASS' : 'FAIL'}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: '#666', fontSize: 12 }}>{r.descripcion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

// ── Tab: Dashboard ────────────────────────────────────────────────────────────

function DashboardTab({ token, onAuthError }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    setError('');
    api(token, 'stats/').then(setStats).catch(e => {
      if (e.message && (e.message.includes('403') || e.message.includes('401') || e.message.includes('credentials'))) {
        onAuthError();
      } else {
        setError(e.message || 'Error al cargar estadísticas.');
      }
    });
  }, [token, onAuthError]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: '#c0392b', fontWeight: 600, marginBottom: 12 }}>{error}</div>
      <Btn onClick={cargar}>Reintentar</Btn>
    </div>
  );
  if (!stats) return <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Cargando...</div>;

  const pe = stats.por_estado || {};
  const valorTotal = (stats.por_bolsa || []).reduce((s, b) => s + parseFloat(b.valor_asignado || 0), 0);
  const comprometido = parseFloat(stats.totales?.valor_icr_inscrito || 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Presupuesto Bolsas" value={fmtCOP(valorTotal)} sub="valor asignado activo" color="#2980b9" />
        <KpiCard label="ICR Comprometido" value={fmtCOP(comprometido)} sub="inscritas confirmadas" color="#00853f" />
        <KpiCard label="Disponible" value={fmtCOP(valorTotal - comprometido)} sub="sin comprometer" color="#8e44ad" />
        <KpiCard label="Inscritas" value={pe.inscrita || 0} sub="formalizadas" color="#00853f" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        <KpiCard label="Sin Evaluar"   value={pe.sin_evaluar || 0}  color="#aaa" />
        <KpiCard label="Preinscriptas" value={pe.preinscrita || 0}  color="#e67e22" />
        <KpiCard label="No Elegibles"  value={pe.no_elegible || 0}  color="#c0392b" />
        <KpiCard label="Anuladas"      value={pe.anulada || 0}      color="#7f8c8d" />
      </div>

      {stats.por_bolsa?.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #eee', fontWeight: 700, color: '#1a2535' }}>Bolsas Presupuestales</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f5f7fa' }}>
              {['Contrato', 'Bolsa', 'Asignado', 'Comprometido', 'Disponible', 'Preinsc.', 'Inscritas'].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#555', fontWeight: 600, borderBottom: '1px solid #e8e8e8' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {stats.por_bolsa.map(b => {
                const pct = b.valor_asignado > 0 ? (b.valor_comprometido / b.valor_asignado * 100).toFixed(1) : 0;
                return (
                  <tr key={b.bolsa_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '9px 14px', color: '#666' }}>{b.contrato_codigo}</td>
                    <td style={{ padding: '9px 14px', fontWeight: 600 }}>{b.bolsa_codigo} — {b.bolsa_nombre}</td>
                    <td style={{ padding: '9px 14px' }}>{fmtCOP(b.valor_asignado)}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {fmtCOP(b.valor_comprometido)}
                        <div style={{ flex: 1, height: 6, background: '#eee', borderRadius: 4 }}>
                          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 80 ? '#e74c3c' : '#00853f', borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#888' }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 14px', color: b.valor_disponible > 0 ? '#00853f' : '#c0392b', fontWeight: 700 }}>{fmtCOP(b.valor_disponible)}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'center' }}>{b.preinscriptas}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, color: '#00853f' }}>{b.inscritas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(!stats.por_bolsa || stats.por_bolsa.length === 0) && (
        <div style={{ textAlign: 'center', color: '#aaa', padding: 40 }}>Sin bolsas configuradas. Ve a la tab "Contratos & Bolsas" para comenzar.</div>
      )}
    </div>
  );
}

// ── Tab: Contratos & Bolsas ───────────────────────────────────────────────────

function ContratosTab({ token }) {
  const [contratos, setContratos] = useState([]);
  const [bolsas, setBolsas]       = useState([]);
  const [modal, setModal]         = useState(null); // {tipo: 'contrato'|'bolsa', item?: obj}
  const [expandido, setExpandido] = useState(null);
  const [msg, setMsg]             = useState(null);

  // Form state
  const [fCodigo, setFCodigo]     = useState('');
  const [fNombre, setFNombre]     = useState('');
  const [fTipo, setFTipo]         = useState('nacional');
  const [fValor, setFValor]       = useState('');
  const [fDesde, setFDesde]       = useState('');
  const [fHasta, setFHasta]       = useState('');
  const [fContratoId, setFContratoId] = useState('');
  const [fAuto, setFAuto]         = useState(false);

  const cargar = useCallback(async () => {
    const [c, b] = await Promise.all([api(token, 'contratos/'), api(token, 'bolsas/')]).catch(() => [[], []]);
    setContratos(Array.isArray(c) ? c : []);
    setBolsas(Array.isArray(b) ? b : []);
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirContrato(item) {
    setModal({ tipo: 'contrato', item });
    setFCodigo(item?.codigo || '');
    setFNombre(item?.nombre || '');
    setFTipo(item?.tipo || 'nacional');
    setFValor(item?.valor_total || '');
    setFDesde(item?.periodo_inicio || '');
    setFHasta(item?.periodo_fin || '');
  }

  function abrirBolsa(item, contratoId) {
    setModal({ tipo: 'bolsa', item });
    setFCodigo(item?.codigo || '');
    setFNombre(item?.nombre || '');
    setFValor(item?.valor_asignado || '');
    setFContratoId(item?.contrato || contratoId || '');
    setFAuto(item?.inscripcion_automatica || false);
  }

  async function guardar() {
    setMsg(null);
    try {
      if (modal.tipo === 'contrato') {
        const body = { codigo: fCodigo, nombre: fNombre, tipo: fTipo, valor_total: fValor, periodo_inicio: fDesde, periodo_fin: fHasta };
        if (modal.item)
          await api(token, `contratos/${modal.item.id}/`, { method: 'PUT', body: JSON.stringify(body) });
        else
          await api(token, 'contratos/', { method: 'POST', body: JSON.stringify(body) });
      } else {
        const body = { codigo: fCodigo, nombre: fNombre, valor_asignado: fValor, contrato: fContratoId, inscripcion_automatica: fAuto };
        if (modal.item)
          await api(token, `bolsas/${modal.item.id}/`, { method: 'PUT', body: JSON.stringify(body) });
        else
          await api(token, 'bolsas/', { method: 'POST', body: JSON.stringify(body) });
      }
      await cargar();
      setModal(null);
      setMsg({ ok: true, text: '✅ Guardado correctamente.' });
    } catch (e) {
      setMsg({ ok: false, text: `Error: ${e.message}` });
    }
  }

  async function toggleActivo(tipo, id, actual) {
    try {
      await api(token, `${tipo}/${id}/`, { method: 'PUT', body: JSON.stringify({ activo: !actual }) });
      await cargar();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#1a2535' }}>Contratos ICR</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Msg msg={msg} />
          <Btn onClick={() => abrirContrato(null)}>+ Nuevo Contrato</Btn>
        </div>
      </div>

      {contratos.length === 0
        ? <div style={{ textAlign: 'center', color: '#aaa', padding: 40 }}>Sin contratos. Crea el primero.</div>
        : contratos.map(c => (
          <div key={c.id} style={{ background: '#fff', borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              onClick={() => setExpandido(expandido === c.id ? null : c.id)}>
              <span style={{ fontWeight: 700, color: '#1a2535', flex: 1 }}>{c.codigo} — {c.nombre}</span>
              <span style={{ fontSize: 12, color: '#888' }}>{c.tipo_display}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#2980b9' }}>{fmtCOP(c.valor_total)}</span>
              <span style={{ fontSize: 12, color: '#888' }}>{c.periodo_inicio} → {c.periodo_fin}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: c.activo ? '#e6f4ec' : '#eee', color: c.activo ? '#00853f' : '#888', fontWeight: 700 }}>
                {c.activo ? 'ACTIVO' : 'INACTIVO'}
              </span>
              <BtnOutline onClick={e => { e.stopPropagation(); abrirContrato(c); }}>Editar</BtnOutline>
              <BtnOutline onClick={e => { e.stopPropagation(); abrirBolsa(null, c.id); }} color="#00853f">+ Bolsa</BtnOutline>
              <span style={{ color: '#aaa', fontSize: 16 }}>{expandido === c.id ? '▲' : '▼'}</span>
            </div>

            {expandido === c.id && (
              <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 18px', background: '#fafafa' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: '#555' }}>Comprometido: <strong>{fmtCOP(c.valor_comprometido)}</strong></div>
                  <div style={{ fontSize: 13, color: c.valor_disponible > 0 ? '#00853f' : '#c0392b' }}>Disponible: <strong>{fmtCOP(c.valor_disponible)}</strong></div>
                  <div style={{ fontSize: 13, color: '#555' }}>Bolsas: <strong>{c.bolsas?.length || 0}</strong></div>
                </div>
                {c.bolsas?.length === 0
                  ? <div style={{ color: '#aaa', fontSize: 13 }}>Sin bolsas. Crea una con "+ Bolsa".</div>
                  : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr style={{ background: '#f0f0f0' }}>
                      {['Código', 'Nombre', 'Asignado', 'Comprometido', 'Disponible', 'Auto-inscripción', ''].map(h => (
                        <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: '#555', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {(bolsas.filter(b => b.contrato === c.id)).map(b => (
                        <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '7px 12px', fontWeight: 700 }}>{b.codigo}</td>
                          <td style={{ padding: '7px 12px' }}>{b.nombre}</td>
                          <td style={{ padding: '7px 12px' }}>{fmtCOP(b.valor_asignado)}</td>
                          <td style={{ padding: '7px 12px' }}>{fmtCOP(b.valor_comprometido)}</td>
                          <td style={{ padding: '7px 12px', color: b.valor_disponible > 0 ? '#00853f' : '#c0392b', fontWeight: 700 }}>{fmtCOP(b.valor_disponible)}</td>
                          <td style={{ padding: '7px 12px' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: b.inscripcion_automatica ? '#e6f4ec' : '#f0f0f0', color: b.inscripcion_automatica ? '#00853f' : '#888', fontWeight: 700 }}>
                              {b.inscripcion_automatica ? 'SÍ' : 'NO'}
                            </span>
                          </td>
                          <td style={{ padding: '7px 12px' }}><BtnOutline onClick={() => abrirBolsa(b, c.id)}>Editar</BtnOutline></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))
      }

      {modal && (
        <Modal title={modal.tipo === 'contrato' ? (modal.item ? 'Editar Contrato' : 'Nuevo Contrato') : (modal.item ? 'Editar Bolsa' : 'Nueva Bolsa')} onClose={() => setModal(null)}>
          {modal.tipo === 'contrato' ? (
            <>
              <Field label="Código" value={fCodigo} set={setFCodigo} required />
              <Field label="Nombre" value={fNombre} set={setFNombre} required />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>Tipo *</label>
                <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13 }}>
                  <option value="nacional">Nacional</option>
                  <option value="complementario">Complementario</option>
                </select>
              </div>
              <Field label="Valor Total (COP)" value={fValor} set={setFValor} type="number" required />
              <Field label="Período Inicio" value={fDesde} set={setFDesde} type="date" required />
              <Field label="Período Fin" value={fHasta} set={setFHasta} type="date" required />
            </>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>Contrato *</label>
                <select value={fContratoId} onChange={e => setFContratoId(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13 }}>
                  <option value="">— Seleccionar —</option>
                  {contratos.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
                </select>
              </div>
              <Field label="Código de Bolsa" value={fCodigo} set={setFCodigo} required />
              <Field label="Nombre de Bolsa" value={fNombre} set={setFNombre} required />
              <Field label="Valor Asignado (COP)" value={fValor} set={setFValor} type="number" required />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <input type="checkbox" checked={fAuto} onChange={e => setFAuto(e.target.checked)} id="auto-insc" />
                <label htmlFor="auto-insc" style={{ fontSize: 13, color: '#444', cursor: 'pointer' }}>
                  Inscripción automática (HU56: pasar directamente de preinscrita a inscrita)
                </label>
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setModal(null)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
            <Btn onClick={guardar}>Guardar</Btn>
          </div>
          <div style={{ marginTop: 10 }}><Msg msg={msg} /></div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Reglas ───────────────────────────────────────────────────────────────

const TIPOS_REGLA = [
  { value: 'tipo_productor', label: 'Tipo de Productor',       hint: 'Ej: pequeño,mediano' },
  { value: 'valor_minimo',   label: 'Valor Mínimo (COP)',      hint: 'Ej: 5000000' },
  { value: 'valor_maximo',   label: 'Valor Máximo (COP)',      hint: 'Ej: 2135250000' },
  { value: 'fecha_vigencia', label: 'Vigencia (ISO)',           hint: 'Ej: 2020-01-01,2030-12-31' },
  { value: 'actividad',      label: 'Actividad Elegible',       hint: 'Ej: agricultura,ganaderia,caficultura' },
  { value: 'municipio',      label: 'Municipio/Departamento',  hint: 'Ej: Ibague,Cundinamarca' },
];

function ReglasTab({ token }) {
  const [contratos, setContratos] = useState([]);
  const [bolsas, setBolsas]       = useState([]);
  const [porcentajes, setPorcentajes] = useState([]);
  const [reglas, setReglas]       = useState([]);
  const [bolsaSel, setBolsaSel]   = useState('');
  const [msg, setMsg]             = useState(null);

  // Form regla
  const [fTipo, setFTipo]         = useState('tipo_productor');
  const [fParam, setFParam]       = useState('');
  const [fDesc, setFDesc]         = useState('');
  const [editRegla, setEditRegla] = useState(null);

  // Form porcentaje
  const [pTipo, setPTipo]         = useState('pequeño');
  const [pPct, setPPct]           = useState('');
  const [pUvb, setPUvb]           = useState('8700');
  const [pValUvb, setPValUvb]     = useState('1423500');
  const [editPct, setEditPct]     = useState(null);

  useEffect(() => {
    Promise.all([api(token, 'contratos/'), api(token, 'bolsas/')]).then(([c, b]) => {
      setContratos(Array.isArray(c) ? c : []);
      setBolsas(Array.isArray(b) ? b : []);
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!bolsaSel) { setReglas([]); setPorcentajes([]); return; }
    Promise.all([
      api(token, `reglas/?bolsa_id=${bolsaSel}`),
      api(token, `porcentajes/?bolsa_id=${bolsaSel}`),
    ]).then(([r, p]) => {
      setReglas(Array.isArray(r) ? r : []);
      setPorcentajes(Array.isArray(p) ? p : []);
    }).catch(() => {});
  }, [bolsaSel, token]);

  async function guardarRegla() {
    setMsg(null);
    const body = { bolsa: bolsaSel, tipo: fTipo, parametro: fParam, descripcion: fDesc };
    try {
      if (editRegla)
        await api(token, `reglas/${editRegla.id}/`, { method: 'PUT', body: JSON.stringify(body) });
      else
        await api(token, 'reglas/', { method: 'POST', body: JSON.stringify(body) });
      const r = await api(token, `reglas/?bolsa_id=${bolsaSel}`);
      setReglas(Array.isArray(r) ? r : []);
      setEditRegla(null); setFTipo('tipo_productor'); setFParam(''); setFDesc('');
      setMsg({ ok: true, text: '✅ Regla guardada.' });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  }

  async function eliminarRegla(id) {
    if (!window.confirm('¿Eliminar esta regla?')) return;
    await api(token, `reglas/${id}/`, { method: 'DELETE' });
    setReglas(prev => prev.filter(r => r.id !== id));
  }

  async function guardarPct() {
    setMsg(null);
    const body = { bolsa: bolsaSel, tipo_productor: pTipo, porcentaje: pPct, tope_uvb: pUvb, valor_uvb: pValUvb };
    try {
      if (editPct)
        await api(token, `porcentajes/${editPct.id}/`, { method: 'PUT', body: JSON.stringify(body) });
      else
        await api(token, 'porcentajes/', { method: 'POST', body: JSON.stringify(body) });
      const p = await api(token, `porcentajes/?bolsa_id=${bolsaSel}`);
      setPorcentajes(Array.isArray(p) ? p : []);
      setEditPct(null); setPTipo('pequeño'); setPPct(''); setPUvb('8700'); setPValUvb('1423500');
      setMsg({ ok: true, text: '✅ Porcentaje guardado.' });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  }

  async function eliminarPct(id) {
    if (!window.confirm('¿Eliminar este porcentaje?')) return;
    await api(token, `porcentajes/${id}/`, { method: 'DELETE' });
    setPorcentajes(prev => prev.filter(p => p.id !== id));
  }

  const hintActual = TIPOS_REGLA.find(t => t.value === fTipo)?.hint || '';

  return (
    <div>
      {/* Selector de bolsa */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Bolsa:</label>
        <select value={bolsaSel} onChange={e => setBolsaSel(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #ccc', fontSize: 13, minWidth: 300 }}>
          <option value="">— Seleccionar bolsa —</option>
          {contratos.map(c => (
            <optgroup key={c.id} label={`${c.codigo} — ${c.nombre}`}>
              {bolsas.filter(b => b.contrato === c.id).map(b => (
                <option key={b.id} value={b.id}>{b.codigo} — {b.nombre}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <Msg msg={msg} />
      </div>

      {!bolsaSel ? (
        <div style={{ textAlign: 'center', color: '#aaa', padding: 40 }}>Selecciona una bolsa para configurar sus reglas.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* ── Reglas de elegibilidad ── */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
            <h4 style={{ margin: '0 0 14px', color: '#1a2535' }}>Reglas de Elegibilidad</h4>
            {reglas.length === 0
              ? <p style={{ color: '#aaa', fontSize: 13 }}>Sin reglas configuradas.</p>
              : reglas.map(r => (
                <div key={r.id} style={{ padding: '9px 12px', borderRadius: 7, background: r.activa ? '#f9fbff' : '#f5f5f5', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 8, border: '1px solid #e8e8e8' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.tipo_display}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#444', marginTop: 2 }}>{r.parametro}</div>
                    {r.descripcion && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{r.descripcion}</div>}
                  </div>
                  <BtnOutline onClick={() => { setEditRegla(r); setFTipo(r.tipo); setFParam(r.parametro); setFDesc(r.descripcion); }} color="#8e44ad">Editar</BtnOutline>
                  <BtnOutline onClick={() => eliminarRegla(r.id)} color="#c0392b">✕</BtnOutline>
                </div>
              ))
            }

            <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#1a2535' }}>{editRegla ? 'Editar Regla' : 'Nueva Regla'}</div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Tipo de Regla</label>
                <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13 }}>
                  {TIPOS_REGLA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Parámetro <span style={{ color: '#aaa' }}>{hintActual}</span></label>
                <input value={fParam} onChange={e => setFParam(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Descripción (opcional)</label>
                <input value={fDesc} onChange={e => setFDesc(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn onClick={guardarRegla} disabled={!fParam}>{editRegla ? 'Actualizar' : 'Agregar Regla'}</Btn>
                {editRegla && <button onClick={() => { setEditRegla(null); setFTipo('tipo_productor'); setFParam(''); setFDesc(''); }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>}
              </div>
            </div>
          </div>

          {/* ── Porcentajes ICR ── */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
            <h4 style={{ margin: '0 0 14px', color: '#1a2535' }}>Porcentajes ICR y Topes UVB</h4>
            {porcentajes.length === 0
              ? <p style={{ color: '#aaa', fontSize: 13 }}>Sin porcentajes configurados.</p>
              : porcentajes.map(p => (
                <div key={p.id} style={{ padding: '9px 12px', borderRadius: 7, background: '#f9fbff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #e8e8e8' }}>
                  <TipoTag tipo={p.tipo_productor} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#00853f' }}>{fmtPct(p.porcentaje)}</span>
                  <span style={{ fontSize: 12, color: '#666' }}>Tope: {p.tope_uvb} UVB = {fmtCOP(p.tope_valor_credito)}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <BtnOutline onClick={() => { setEditPct(p); setPTipo(p.tipo_productor); setPPct(p.porcentaje); setPUvb(p.tope_uvb); setPValUvb(p.valor_uvb); }} color="#8e44ad">Editar</BtnOutline>
                    <BtnOutline onClick={() => eliminarPct(p.id)} color="#c0392b">✕</BtnOutline>
                  </div>
                </div>
              ))
            }

            <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#1a2535' }}>{editPct ? 'Editar Porcentaje' : 'Nuevo Porcentaje'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Tipo Productor</label>
                  <select value={pTipo} onChange={e => setPTipo(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13 }}>
                    <option value="pequeño">Pequeño</option>
                    <option value="mediano">Mediano</option>
                    <option value="grande">Grande</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Porcentaje (0.40 = 40%)</label>
                  <input value={pPct} onChange={e => setPPct(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Tope UVB</label>
                  <input value={pUvb} onChange={e => setPUvb(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Valor UVB (COP)</label>
                  <input value={pValUvb} onChange={e => setPValUvb(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <Btn onClick={guardarPct} disabled={!pPct}>{editPct ? 'Actualizar' : 'Agregar'}</Btn>
                {editPct && <button onClick={() => { setEditPct(null); setPTipo('pequeño'); setPPct(''); }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Operaciones (Importar + Preinscribir) ────────────────────────────────

function OperacionesTab({ token }) {
  const [bolsas, setBolsas]       = useState([]);
  const [contratos, setContratos] = useState([]);
  const [archivo, setArchivo]     = useState(null);
  const [bolsaId, setBolsaId]     = useState('');
  const [inscripciones, setInscripciones] = useState([]);
  const [importMsg, setImportMsg] = useState(null);
  const [preMsg, setPreMsg]       = useState(null);
  const [loading, setLoading]     = useState('');

  const cargarInscripciones = useCallback(() => {
    api(token, 'inscripciones/?estado=sin_evaluar&estado=no_elegible').then(d => setInscripciones(d.inscripciones || [])).catch(() => {});
  }, [token]);

  useEffect(() => {
    Promise.all([api(token, 'contratos/'), api(token, 'bolsas/')]).then(([c, b]) => {
      setContratos(Array.isArray(c) ? c : []);
      setBolsas(Array.isArray(b) ? b : []);
    }).catch(() => {});
    cargarInscripciones();
  }, [cargarInscripciones, token]);

  async function importar() {
    if (!archivo) return;
    setLoading('import'); setImportMsg(null);
    const fd = new FormData();
    fd.append('archivo', archivo);
    try {
      const res = await fetch(`${API}/icr/importar/`, { method: 'POST', headers: { Authorization: `Basic ${token}` }, body: fd });
      const d = await res.json();
      if (res.ok) {
        setImportMsg({ ok: true, text: `✅ ${d.operaciones_importadas} importadas.${d.errores_parseo?.length ? ` ${d.errores_parseo.length} con error de formato.` : ''}` });
        cargarInscripciones();
        setArchivo(null);
      } else {
        setImportMsg({ ok: false, text: d.error || 'Error al importar.' });
      }
    } catch (e) { setImportMsg({ ok: false, text: e.message }); }
    setLoading('');
  }

  async function preinscribir() {
    setLoading('pre'); setPreMsg(null);
    try {
      const d = await api(token, 'preinscribir/', { method: 'POST', body: JSON.stringify(bolsaId ? { bolsa_id: parseInt(bolsaId) } : {}) });
      setPreMsg({ ok: true, text: `✅ ${d.preinscriptas} preinscriptas, ${d.auto_inscritas} auto-inscritas, ${d.no_elegibles} no elegibles.` });
      cargarInscripciones();
    } catch (e) { setPreMsg({ ok: false, text: e.message }); }
    setLoading('');
  }

  // Filtrar por estado
  const sinEval = inscripciones.filter(i => i.estado === 'sin_evaluar');
  const noElegibles = inscripciones.filter(i => i.estado === 'no_elegible');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Panel Importar */}
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <h4 style={{ margin: '0 0 10px', color: '#1a2535' }}>📥 Importar desde AGROS</h4>
          <p style={{ color: '#777', fontSize: 13, margin: '0 0 12px' }}>
            Sube un <strong>.xlsx</strong> o <strong>.csv</strong> con columnas:<br />
            <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
              ID AGROS · PRODUCTOR ID · TIPO PRODUCTOR · VALOR CREDITO · FECHA CREDITO · ACTIVIDAD · DEPARTAMENTO · MUNICIPIO
            </code>
          </p>
          <input type="file" accept=".xlsx,.csv" onChange={e => { setArchivo(e.target.files[0] || null); setImportMsg(null); }} style={{ fontSize: 13, marginBottom: 10, display: 'block' }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Btn onClick={importar} disabled={!archivo || loading === 'import'}>{loading === 'import' ? 'Importando…' : 'Importar'}</Btn>
            <Msg msg={importMsg} />
          </div>
        </div>

        {/* Panel Preinscribir */}
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <h4 style={{ margin: '0 0 10px', color: '#1a2535' }}>⚙️ Preinscribir Operaciones</h4>
          <p style={{ color: '#777', fontSize: 13, margin: '0 0 12px' }}>
            Evalúa las operaciones <strong>sin evaluar</strong> contra las reglas configuradas.
            Las elegibles pasan a <em>preinscrita</em> (o <em>inscrita</em> si la bolsa es automática).
          </p>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Bolsa específica (opcional — deja vacío para evaluar contra todas):</label>
            <select value={bolsaId} onChange={e => setBolsaId(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13 }}>
              <option value="">— Todas las bolsas activas —</option>
              {contratos.map(c => (
                <optgroup key={c.id} label={c.codigo}>{bolsas.filter(b => b.contrato === c.id).map(b => <option key={b.id} value={b.id}>{b.codigo} — {b.nombre}</option>)}</optgroup>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Btn onClick={preinscribir} disabled={sinEval.length === 0 || loading === 'pre'} color="#2980b9">
              {loading === 'pre' ? 'Evaluando…' : `Preinscribir ${sinEval.length} operación${sinEval.length !== 1 ? 'es' : ''}`}
            </Btn>
            <Msg msg={preMsg} />
          </div>
        </div>
      </div>

      {/* Tabla operaciones sin evaluar */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.07)', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #eee', fontWeight: 700, color: '#1a2535' }}>
          Sin Evaluar <span style={{ fontWeight: 400, color: '#888', fontSize: 13 }}>({sinEval.length})</span>
        </div>
        {sinEval.length === 0
          ? <div style={{ padding: 20, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Sin operaciones pendientes.</div>
          : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f5f7fa' }}>
              {['ID AGROS', 'Productor ID', 'Tipo', 'Valor Crédito', 'Fecha', 'Actividad', 'Departamento'].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#555', fontWeight: 600, borderBottom: '1px solid #e8e8e8' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {sinEval.map(i => (
                <tr key={i.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 14px', fontWeight: 600 }}>{i.id_agros}</td>
                  <td style={{ padding: '8px 14px', color: '#555' }}>{i.productor_id}</td>
                  <td style={{ padding: '8px 14px' }}><TipoTag tipo={i.tipo_productor} /></td>
                  <td style={{ padding: '8px 14px' }}>{fmtCOP(i.valor_credito)}</td>
                  <td style={{ padding: '8px 14px', color: '#666', whiteSpace: 'nowrap' }}>{fmtDate(i.fecha_credito)}</td>
                  <td style={{ padding: '8px 14px', color: '#555', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.actividad}</td>
                  <td style={{ padding: '8px 14px', color: '#777' }}>{i.departamento || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* No elegibles */}
      {noElegibles.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #eee', fontWeight: 700, color: '#c0392b' }}>
            No Elegibles <span style={{ fontWeight: 400, color: '#888', fontSize: 13 }}>({noElegibles.length})</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#fff5f5' }}>
              {['ID AGROS', 'Tipo', 'Valor Crédito', 'Motivo'].map(h => <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#555', fontWeight: 600, borderBottom: '1px solid #f0c0c0' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {noElegibles.map(i => (
                <tr key={i.id} style={{ borderBottom: '1px solid #fce8e8' }}>
                  <td style={{ padding: '8px 14px', fontWeight: 600 }}>{i.id_agros}</td>
                  <td style={{ padding: '8px 14px' }}><TipoTag tipo={i.tipo_productor} /></td>
                  <td style={{ padding: '8px 14px' }}>{fmtCOP(i.valor_credito)}</td>
                  <td style={{ padding: '8px 14px', color: '#c0392b', fontSize: 12 }}>{i.motivo_no_elegible}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Inscripciones ────────────────────────────────────────────────────────

function InscripcionesTab({ token }) {
  const [inscripciones, setInscripciones] = useState([]);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [filtroEstado, setFiltroEstado]   = useState('preinscrita');
  const [busqueda, setBusqueda]           = useState('');
  const [auditoriaOp, setAuditoriaOp]     = useState(null);
  const [anularModal, setAnularModal]     = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [msg, setMsg]                     = useState(null);
  const [loading, setLoading]             = useState(false);

  const cargar = useCallback(() => {
    const params = new URLSearchParams();
    if (filtroEstado) params.set('estado', filtroEstado);
    if (busqueda) params.set('search', busqueda);
    api(token, `inscripciones/?${params}`).then(d => {
      setInscripciones(d.inscripciones || []);
      setSeleccionados(new Set());
    }).catch(() => {});
  }, [token, filtroEstado, busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  function toggleSel(id) {
    setSeleccionados(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function selTodos() {
    const elegibles = inscripciones.filter(i => i.estado === 'preinscrita').map(i => i.id);
    setSeleccionados(prev => prev.size === elegibles.length ? new Set() : new Set(elegibles));
  }

  async function formalizar(ids) {
    setLoading(true); setMsg(null);
    try {
      const d = await api(token, 'formalizar/', { method: 'POST', body: JSON.stringify({ inscripcion_ids: ids }) });
      setMsg({ ok: true, text: `✅ ${d.total} inscritas confirmadas.` });
      cargar();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setLoading(false);
  }

  async function anular() {
    if (!motivoAnulacion.trim()) return;
    setLoading(true);
    try {
      const d = await api(token, 'anular/', { method: 'POST', body: JSON.stringify({ inscripcion_ids: [...seleccionados], motivo: motivoAnulacion }) });
      setMsg({ ok: true, text: `✅ ${d.anuladas} inscripciones anuladas.` });
      setAnularModal(false); setMotivoAnulacion(''); cargar();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    setLoading(false);
  }

  function exportarCSV() {
    const hdrs = ['Consecutivo', 'ID AGROS', 'Tipo', 'Valor Crédito', '% ICR', 'Valor ICR', 'Bolsa', 'Estado', 'Formalizado Por', 'Formalizado En'];
    const rows = inscripciones.map(i => [i.consecutivo || '', i.id_agros, i.tipo_productor, i.valor_credito, fmtPct(i.porcentaje_icr), i.valor_icr, i.bolsa_codigo || '', i.estado, i.formalizado_por_nombre || '', i.formalizado_en || '']);
    const csv = [hdrs, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'inscripciones_icr.csv'; a.click();
  }

  const preinscriptas = inscripciones.filter(i => i.estado === 'preinscrita');
  const selArray = [...seleccionados];

  return (
    <div>
      {/* Controles */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 13 }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar ID, consecutivo, municipio…"
          style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid #ccc', fontSize: 13, width: 240 }} />
        <Btn onClick={cargar} color="#7f8c8d">Buscar</Btn>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Msg msg={msg} />
          {inscripciones.length > 0 && <BtnOutline onClick={exportarCSV} color="#555">⬇ CSV</BtnOutline>}
          {selArray.length > 0 && filtroEstado === 'preinscrita' && (
            <>
              <Btn onClick={() => formalizar(selArray)} disabled={loading} color="#00853f">Formalizar ({selArray.length})</Btn>
              <Btn onClick={() => setAnularModal(true)} disabled={loading} color="#c0392b">Anular ({selArray.length})</Btn>
            </>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#f5f7fa' }}>
            {filtroEstado === 'preinscrita' && <th style={{ padding: '9px 14px', textAlign: 'left' }}><input type="checkbox" onChange={selTodos} checked={selArray.length === preinscriptas.length && preinscriptas.length > 0} /></th>}
            {['Consecutivo', 'ID AGROS', 'Tipo', 'Valor Crédito', '% ICR', 'Valor ICR', 'Bolsa', 'Estado', 'Acciones'].map(h => (
              <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#555', fontWeight: 600, borderBottom: '1px solid #e8e8e8', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {inscripciones.length === 0
              ? <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>Sin resultados.</td></tr>
              : inscripciones.map(i => (
                <tr key={i.id} style={{ borderBottom: '1px solid #f0f0f0', background: i.estado === 'inscrita' ? '#fafffe' : i.estado === 'anulada' ? '#fafafa' : '#fff' }}>
                  {filtroEstado === 'preinscrita' && (
                    <td style={{ padding: '8px 14px' }}>
                      {i.estado === 'preinscrita' && <input type="checkbox" checked={seleccionados.has(i.id)} onChange={() => toggleSel(i.id)} />}
                    </td>
                  )}
                  <td style={{ padding: '8px 14px', fontWeight: 700, color: '#1a2535', fontFamily: 'monospace' }}>{i.consecutivo || '—'}</td>
                  <td style={{ padding: '8px 14px', fontWeight: 600 }}>{i.id_agros}</td>
                  <td style={{ padding: '8px 14px' }}><TipoTag tipo={i.tipo_productor} /></td>
                  <td style={{ padding: '8px 14px' }}>{fmtCOP(i.valor_credito)}</td>
                  <td style={{ padding: '8px 14px', fontWeight: 700, color: i.es_elegible ? '#00853f' : '#aaa' }}>{fmtPct(i.porcentaje_icr)}</td>
                  <td style={{ padding: '8px 14px', fontWeight: 700 }}>{i.es_elegible ? fmtCOP(i.valor_icr) : '—'}</td>
                  <td style={{ padding: '8px 14px', color: '#666', fontSize: 12 }}>{i.bolsa_codigo || '—'}</td>
                  <td style={{ padding: '8px 14px' }}><EstadoBadge estado={i.estado} /></td>
                  <td style={{ padding: '8px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {i.estado === 'preinscrita' && <BtnOutline onClick={() => formalizar([i.id])} color="#00853f">Formalizar</BtnOutline>}
                      {['preinscrita', 'inscrita'].includes(i.estado) && (
                        <BtnOutline onClick={() => { setSeleccionados(new Set([i.id])); setAnularModal(true); }} color="#c0392b">Anular</BtnOutline>
                      )}
                      {i.estado !== 'sin_evaluar' && (
                        <BtnOutline onClick={() => setAuditoriaOp(i)} color="#2980b9">Reglas</BtnOutline>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Totales */}
        {inscripciones.filter(i => i.es_elegible).length > 0 && (
          <div style={{ padding: '10px 18px', borderTop: '2px solid #e8e8e8', background: '#f9fbf9', fontSize: 13, color: '#555', display: 'flex', gap: 24 }}>
            <span><strong style={{ color: '#00853f' }}>{inscripciones.filter(i => i.es_elegible).length}</strong> elegibles</span>
            <span>ICR: <strong style={{ color: '#00853f' }}>{fmtCOP(inscripciones.filter(i => i.es_elegible).reduce((s, i) => s + parseFloat(i.valor_icr || 0), 0))}</strong></span>
          </div>
        )}
      </div>

      {/* Modal Auditoría */}
      {auditoriaOp && <AuditoriaModal inscripcion={auditoriaOp} token={token} onClose={() => setAuditoriaOp(null)} />}

      {/* Modal Anular */}
      {anularModal && (
        <Modal title="Anular Inscripciones" onClose={() => setAnularModal(false)}>
          <p style={{ color: '#555', fontSize: 14 }}>Se anularán <strong>{selArray.length}</strong> inscripción(es). Esta acción no se puede deshacer.</p>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 6 }}>Motivo de anulación *</label>
            <textarea value={motivoAnulacion} onChange={e => setMotivoAnulacion(e.target.value)} rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setAnularModal(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
            <Btn onClick={anular} disabled={!motivoAnulacion.trim() || loading} color="#c0392b">Confirmar Anulación</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    const token = btoa(`${user}:${pass}`);
    try {
      const r = await fetch(`${API}/icr/stats/`, { headers: { Authorization: `Basic ${token}` } });
      if (r.ok) { localStorage.setItem(AUTH_KEY, token); onLogin(token); }
      else setError('Usuario o contraseña incorrectos.');
    } catch { setError('No se pudo conectar al servidor.'); }
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 36, width: 360, boxShadow: '0 2px 12px rgba(0,0,0,.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36 }}>📊</div>
          <h2 style={{ margin: '8px 0 4px', color: '#1a2535' }}>Módulo ICR</h2>
          <p style={{ color: '#888', fontSize: 13, margin: 0 }}>Incentivo a la Capitalización Rural</p>
        </div>
        <form onSubmit={submit}>
          {['Usuario', 'Contraseña'].map((label, idx) => (
            <div key={label} style={{ marginBottom: idx ? 20 : 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>{label}</label>
              <input type={idx ? 'password' : 'text'} value={idx ? pass : user}
                onChange={e => idx ? setPass(e.target.value) : setUser(e.target.value)}
                autoFocus={!idx}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ccc', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          ))}
          {error && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</div>}
          <Btn onClick={() => {}} disabled={loading}>{loading ? 'Verificando...' : 'Ingresar'}</Btn>
        </form>
      </div>
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────

const TABS = [
  { key: 'dashboard',   label: '📊 Dashboard' },
  { key: 'contratos',   label: '📁 Contratos & Bolsas' },
  { key: 'reglas',      label: '⚙️ Reglas' },
  { key: 'operaciones', label: '📥 Operaciones' },
  { key: 'inscripciones', label: '📋 Inscripciones' },
];

function ICRDashboard({ token, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const tabStyle = active => ({
    padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
    background: active ? '#00853f' : '#f0f0f0', color: active ? '#fff' : '#555',
    borderRadius: 20, fontWeight: active ? 700 : 400, transition: 'all .15s', whiteSpace: 'nowrap',
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map(t => <button key={t.key} style={tabStyle(tab === t.key)} onClick={() => setTab(t.key)}>{t.label}</button>)}
        </div>
        <button onClick={onLogout} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#555' }}>Cerrar sesión</button>
      </div>

      {tab === 'dashboard'    && <DashboardTab    token={token} onAuthError={onLogout} />}
      {tab === 'contratos'    && <ContratosTab    token={token} />}
      {tab === 'reglas'       && <ReglasTab       token={token} />}
      {tab === 'operaciones'  && <OperacionesTab  token={token} />}
      {tab === 'inscripciones' && <InscripcionesTab token={token} />}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function ICRPage() {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_KEY) || null);
  if (!token) return <LoginForm onLogin={t => setToken(t)} />;
  return <ICRDashboard token={token} onLogout={() => { localStorage.removeItem(AUTH_KEY); setToken(null); }} />;
}
