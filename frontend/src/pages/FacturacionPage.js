import { useState, useEffect, useCallback, useRef } from 'react';

const API = process.env.REACT_APP_API_URL || '/api';
const AUTH_KEY = 'facturacion_auth';

function getBasicAuthHeader(u, p) {
  return 'Basic ' + btoa(`${u}:${p}`);
}

function fmtCOP(val) {
  if (val === null || val === undefined || val === '') return '—';
  return '$' + Number(val).toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

function totalValor(facturas) {
  return facturas.reduce((s, f) => s + (parseFloat(f.valor_factura) || 0), 0);
}

/* ── SSE consumer ────────────────────────────────────────────────────────── */
async function consumeSSE(url, { method = 'POST', headers = {}, body = null, onLog, onResult, onError }) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) { onError(`HTTP ${res.status}`); return; }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let pendingEvent = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        pendingEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (pendingEvent === 'result') { onResult(JSON.parse(data)); pendingEvent = null; }
        else if (pendingEvent === 'error') { onError(data); pendingEvent = null; }
        else { onLog(data); }
      }
    }
  }
}

/* ── Modal de progreso ───────────────────────────────────────────────────── */
function LogModal({ title, subtitle, logs, isDone, status, onClose, onAbort, aborting }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const statusColor = status === 'ok' ? '#4caf50' : status === 'aborted' ? '#ffb74d' : status === 'error' ? '#ef5350' : '#ffb74d';
  const statusBg    = status === 'ok' ? '#1b5e20' : status === 'aborted' ? '#e65100' : status === 'error' ? '#b71c1c' : '#e65100';
  const statusLabel = status === 'ok' ? '✅ Completado' : status === 'aborted' ? '⚠️ Abortado — progreso guardado' : status === 'error' ? '❌ Error' : '⏳ Ejecutando...';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        width: '90%', maxWidth: 780,
        background: '#0d1117',
        borderRadius: 12,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #30363d',
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 20px',
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 8px ${statusColor}`,
              animation: !isDone ? 'pulse 1.2s ease-in-out infinite' : 'none',
            }} />
            <div>
              <div style={{ color: '#e6edf3', fontWeight: 700, fontSize: 14 }}>{title}</div>
              <div style={{ color: '#8b949e', fontSize: 11 }}>{subtitle}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isDone && (
              <button
                onClick={onAbort}
                disabled={aborting}
                style={{
                  background: aborting ? '#21262d' : '#6e1515',
                  border: '1px solid #f85149',
                  borderRadius: 6, color: aborting ? '#484f58' : '#f85149',
                  padding: '5px 14px', cursor: aborting ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 600,
                  transition: 'background 0.2s',
                }}
              >
                {aborting ? 'Abortando...' : '⏹ Abortar'}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={!isDone}
              style={{
                background: isDone ? '#21262d' : 'transparent',
                border: '1px solid #30363d',
                borderRadius: 6, color: isDone ? '#e6edf3' : '#484f58',
                padding: '5px 14px', cursor: isDone ? 'pointer' : 'not-allowed',
                fontSize: 12, fontWeight: 600,
                transition: 'background 0.2s',
              }}
            >
              {isDone ? 'Cerrar' : 'Esperando...'}
            </button>
          </div>
        </div>

        {/* Terminal */}
        <div style={{
          height: 420, overflowY: 'auto', padding: '16px 20px',
          fontFamily: '"Cascadia Code", "Fira Code", "Courier New", monospace',
          fontSize: 12.5, lineHeight: 1.7, color: '#c9d1d9',
          background: '#0d1117',
        }}>
          <style>{`
            @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: #0d1117; }
            ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
          `}</style>

          {logs.length === 0 && (
            <span style={{ color: '#484f58' }}>Iniciando proceso...</span>
          )}

          {logs.map((line, i) => {
            let color  = '#c9d1d9';
            let dimmed = false;
            if (line.includes('[OMITIDO]'))       { color = '#484f58'; dimmed = true; }
            else if (line.includes('| ERROR'))    color = '#f85149';
            else if (line.includes('| WARNING'))  color = '#e3b341';
            else if (line.includes('Descargado')) color = '#3fb950';
            else if (line.includes('| INFO'))     color = '#58a6ff';
            return (
              <div key={i} style={{ color, marginBottom: 1, opacity: dimmed ? 0.5 : 1 }}>
                <span style={{ color: '#484f58', userSelect: 'none' }}>{String(i + 1).padStart(3, '0')}  </span>
                {dimmed && <span style={{ color: '#6e7681', fontSize: 11 }}>↩ </span>}
                {line}
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* Status bar */}
        <div style={{
          padding: '10px 20px',
          background: statusBg,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid #30363d',
        }}>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{statusLabel}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
            {logs.length} líneas · {isDone ? 'Proceso finalizado' : 'En progreso'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Login ───────────────────────────────────────────────────────────────── */
function LoginForm({ onLogin }) {
  const [user, setUser]     = useState('');
  const [pass, setPass]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const header = getBasicAuthHeader(user, pass);
    try {
      const res = await fetch(`${API}/facturacion/facturas/`, { headers: { Authorization: header } });
      if (res.ok) {
        sessionStorage.setItem(AUTH_KEY, JSON.stringify({ user, pass }));
        onLogin(header);
      } else { setError('Credenciales incorrectas.'); }
    } catch { setError('No se pudo conectar con el servidor.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 16, boxShadow: '0 8px 24px rgba(27,94,32,0.3)' }}>🧾</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a2e1a', marginBottom: 4 }}>Facturación Electrónica</h2>
          <p style={{ fontSize: 13, color: '#777', margin: 0 }}>Gestión de facturas DIAN · Finagro</p>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', padding: '18px 24px' }}>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>Acceso al módulo</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>Credenciales de Automation Hub</div>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#1b5e20', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Usuario</label>
              <input className="input" type="text" placeholder="admin" value={user} onChange={e => setUser(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#1b5e20', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Contraseña</label>
              <input className="input" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            {error && (
              <div style={{ background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center' }}>
                ⚠️ {error}
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4, padding: '11px', fontSize: 14, fontWeight: 700 }}>
              {loading ? 'Verificando...' : 'Ingresar al módulo →'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 16 }}>Mismas credenciales de Django Admin</p>
      </div>
    </div>
  );
}

/* ── helpers de fecha ────────────────────────────────────────────────────── */
function toISODate(d) {
  // Date object → "YYYY-MM-DD"
  return d.toISOString().slice(0, 10);
}

function mesLabel(mesStr) {
  // "2026-01" → "Enero 2026"
  const [y, m] = mesStr.split('-');
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${nombres[parseInt(m, 10) - 1]} ${y}`;
}

/* ── Dashboard ───────────────────────────────────────────────────────────── */
function FacturacionDashboard({ authHeader, onLogout }) {
  const [facturas, setFacturas]               = useState([]);
  const [total, setTotal]                     = useState(0);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  const [busqueda, setBusqueda]               = useState('');
  const [fechaDesde, setFechaDesde]           = useState('');
  const [fechaHasta, setFechaHasta]           = useState('');

  // Cobertura de descarga
  const [stats, setStats]           = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Estado independiente por paso
  const [descargando, setDescargando]         = useState(false);
  const [procesando, setProcesando]           = useState(false);
  const [aborting, setAborting]               = useState(false);

  // Modal de logs
  const [modal, setModal] = useState(null);
  // modal = { title, subtitle, logs: [], isDone: bool, status: 'running'|'ok'|'error' }

  const cargarStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`${API}/facturacion/stats/`, { headers: { Authorization: authHeader } });
      if (res.ok) setStats(await res.json());
    } catch { /* silencioso */ }
    finally { setLoadingStats(false); }
  }, [authHeader]);

  const cargarFacturas = useCallback(async () => {
    setLoadingFacturas(true);
    try {
      const res = await fetch(`${API}/facturacion/facturas/`, { headers: { Authorization: authHeader } });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      setFacturas(data.facturas || []);
      setTotal(data.total || 0);
    } catch { /* silencioso */ }
    finally { setLoadingFacturas(false); }
  }, [authHeader, onLogout]);

  useEffect(() => { cargarFacturas(); cargarStats(); }, [cargarFacturas, cargarStats]);

  const abortar = async () => {
    setAborting(true);
    try {
      await fetch(`${API}/facturacion/abortar/`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      setModal(m => m ? ({ ...m, logs: [...m.logs, '⚠️  Señal de abort enviada — guardando progreso...'] }) : m);
    } catch {
      setModal(m => m ? ({ ...m, logs: [...m.logs, 'Error enviando señal de abort.'] }) : m);
    } finally {
      setAborting(false);
    }
  };

  /* ── Descargar ayer ── */
  const descargarAyer = () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const iso = toISODate(ayer);
    setFechaDesde(iso);
    setFechaHasta(iso);
    // Usamos setTimeout para que el estado se haya fijado antes de disparar descargar
    setTimeout(() => descargarConFecha(iso, iso), 50);
  };

  const descargarConFecha = async (desde, hasta) => {
    setDescargando(true);
    const body = {};
    if (desde) body.fecha_desde = `${desde}T00:00:00Z`;
    if (hasta)  body.fecha_hasta = `${hasta}T23:59:59Z`;

    setModal({
      title: 'Descargar del correo',
      subtitle: `facturacion@finagro.com.co · Microsoft Graph`,
      logs: [],
      isDone: false,
      status: 'running',
    });

    try {
      await consumeSSE(`${API}/facturacion/descargar/stream/`, {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body,
        onLog: (line) => setModal(m => ({ ...m, logs: [...m.logs, line] })),
        onResult: (data) => {
          const aborted = data.status === 'aborted';
          setModal(m => ({
            ...m,
            logs: [...m.logs, `─── ${aborted ? 'Abortado' : 'Completado'}: ${data.mensajes_procesados ?? 0} mensajes en histórico ───`],
            isDone: true,
            status: aborted ? 'aborted' : 'ok',
          }));
          setAborting(false);
          cargarStats();
        },
        onError: (msg) => setModal(m => ({ ...m, logs: [...m.logs, `ERROR: ${msg}`], isDone: true, status: 'error' })),
      });
    } catch (e) {
      setModal(m => ({ ...m, logs: [...m.logs, `ERROR: ${e.message}`], isDone: true, status: 'error' }));
    } finally {
      setDescargando(false);
    }
  };

  /* ── Descargar con streaming (usa el estado de fechas del formulario) ── */
  const descargar = () => descargarConFecha(fechaDesde, fechaHasta);

  /* ── Procesar con streaming ── */
  const procesar = async () => {
    setProcesando(true);
    setModal({
      title: 'Clasificar y extraer metadata',
      subtitle: 'ZipClassifier · InvoiceMetadataExtractor',
      logs: [],
      isDone: false,
      status: 'running',
    });

    try {
      await consumeSSE(`${API}/facturacion/procesar/stream/`, {
        headers: { Authorization: authHeader },
        onLog: (line) => setModal(m => ({ ...m, logs: [...m.logs, line] })),
        onResult: async (data) => {
          setModal(m => ({
            ...m,
            logs: [...m.logs, `─── Completado: ${data.total ?? 0} facturas · ${data.errores ?? 0} errores ───`],
            isDone: true,
            status: data.errores > 0 ? 'error' : 'ok',
          }));
          await cargarFacturas();
        },
        onError: (msg) => setModal(m => ({ ...m, logs: [...m.logs, `ERROR: ${msg}`], isDone: true, status: 'error' })),
      });
    } catch (e) {
      setModal(m => ({ ...m, logs: [...m.logs, `ERROR: ${e.message}`], isDone: true, status: 'error' }));
    } finally {
      setProcesando(false);
    }
  };

  const exportarCSV = () => {
    if (!facturas.length) return;
    const headers = ['NIT Proveedor','Número Factura','Código','Valor Factura','IVA','Fecha Emisión','Fecha Vencimiento','Observaciones'];
    const rows = facturas.map(f => [f.proveedor_nit, f.numero_factura, f.codigo, f.valor_factura, f.iva_facturado_proveedor, f.fecha_emision, f.fecha_vencimiento, f.observaciones]);
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `facturas_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const facturasFiltradas = facturas.filter(f => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return [(f.proveedor_nit || ''), (f.numero_factura || ''), (f.codigo || '')].some(v => v.toLowerCase().includes(q));
  });

  const valorTotal    = totalValor(facturas);
  const valorFiltrado = totalValor(facturasFiltradas);

  return (
    <div className="page">

      {/* Modal de progreso */}
      {modal && (
        <LogModal
          title={modal.title}
          subtitle={modal.subtitle}
          logs={modal.logs}
          isDone={modal.isDone}
          status={modal.status}
          onClose={() => { setModal(null); setAborting(false); }}
          onAbort={abortar}
          aborting={aborting}
        />
      )}

      {/* Banner */}
      <div className="banner" style={{ marginBottom: 24 }}>
        <div className="banner-text">
          <h1>Facturación Electrónica · DIAN</h1>
          <p>Descarga, clasifica y extrae metadata de facturas electrónicas desde el buzón de Finagro.</p>
        </div>
        <div className="banner-stats">
          <div className="banner-stat">
            <div className="banner-stat-num">{total}</div>
            <div className="banner-stat-label">Facturas</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num" style={{ fontSize: 16 }}>
              {valorTotal > 0 ? '$' + Math.round(valorTotal / 1_000_000).toLocaleString('es-CO') + 'M' : '—'}
            </div>
            <div className="banner-stat-label">Valor total</div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { icon: '🧾', label: 'Total facturas',  value: total,                                                       bg: '#e3f2fd', color: '#1565c0' },
          { icon: '💰', label: 'Valor total',      value: valorTotal > 0 ? fmtCOP(valorTotal) : '—',                  bg: '#e8f5e9', color: '#2e7d32' },
          { icon: '⚠️', label: 'Sin fecha emisión',value: facturas.filter(f => !f.fecha_emision).length || '—',        bg: '#fff8e1', color: '#f57f17' },
        ].map(k => (
          <div key={k.label} className="card" style={{ margin: 0, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Cobertura de descarga */}
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div className="section-title">Cobertura de descarga</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {stats?.fecha_max && (
            <span style={{ fontSize: 11, background: '#e8f5e9', color: '#2e7d32', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>
              Última descarga: {stats.fecha_max.slice(0, 10)}
            </span>
          )}
          <button
            className="btn btn-outline"
            style={{ fontSize: 12 }}
            onClick={cargarStats}
            disabled={loadingStats}
          >
            {loadingStats ? '...' : '↺'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28, overflow: 'hidden' }}>
        {!stats ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
            {loadingStats ? 'Cargando estadísticas...' : 'Sin datos de descarga aún.'}
          </div>
        ) : stats.total_mensajes === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
            No se han descargado correos todavía.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'start' }}>
            {/* Tabla por mes */}
            <div style={{ overflowX: 'auto' }}>
              <table className="api-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th style={{ textAlign: 'right' }}>ZIPs descargados</th>
                    <th style={{ textAlign: 'right' }}>Correos c/ ZIP</th>
                    <th style={{ textAlign: 'center' }}>Cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.por_mes.map(row => {
                    const maxZips = Math.max(...stats.por_mes.map(r => r.zips), 1);
                    const pct = Math.round((row.zips / maxZips) * 100);
                    return (
                      <tr key={row.mes}>
                        <td style={{ fontWeight: 600, color: '#1b5e20' }}>{mesLabel(row.mes)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#1565c0' }}>{row.zips}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>{row.correos}</td>
                        <td style={{ minWidth: 140 }}>
                          <div style={{ background: '#f0f0f0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#1565c0,#64b5f6)', borderRadius: 4 }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e0e0e0' }}>
                    <td style={{ fontWeight: 800, color: '#333' }}>Total</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#1565c0' }}>{stats.total_zips}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>{stats.total_con_zip}</td>
                    <td style={{ fontSize: 11, color: '#888' }}>
                      {stats.fecha_min?.slice(0,10)} → {stats.fecha_max?.slice(0,10)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Acceso rápido diario */}
            <div style={{ padding: '20px 24px', borderLeft: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minWidth: 180 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>📅</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#333' }}>Descarga diaria</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Descarga los correos<br/>del día anterior</div>
              </div>
              <button
                className="btn btn-primary"
                onClick={descargarAyer}
                disabled={descargando}
                style={{ width: '100%', fontWeight: 700, fontSize: 13, padding: '10px 0' }}
              >
                {descargando
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}><SpinnerIcon /> Descargando...</span>
                  : '⬇ Descargar ayer'}
              </button>
              <div style={{ fontSize: 10, color: '#bbb', textAlign: 'center' }}>
                {toISODate(new Date(Date.now() - 86400000))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline */}
      <div className="section-header">
        <div className="section-title">Pipeline de procesamiento</div>
        <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={onLogout}>Cerrar sesión</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* Paso 1 — independiente */}
        <div className="card" style={{ margin: 0, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1565c0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>01</div>
            <div>
              <div style={{ fontWeight: 700, color: '#0d47a1', fontSize: 14 }}>Descargar del correo</div>
              <div style={{ fontSize: 11, color: '#1976d2' }}>Microsoft Graph · facturacion@finagro.com.co</div>
            </div>
            {descargando && <SpinnerIcon color="#1565c0" size={18} style={{ marginLeft: 'auto' }} />}
          </div>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 12.5, color: '#555', margin: 0, lineHeight: 1.6 }}>
              Conecta con el buzón vía Microsoft Graph y descarga los ZIPs adjuntos.
              Los mensajes ya descargados se omiten automáticamente por <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>message_id</code>.
            </p>
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Rango de fechas (opcional)</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Desde</label>
                  <input type="date" className="input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Hasta</label>
                  <input type="date" className="input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }} />
                </div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={descargar} disabled={descargando} style={{ fontWeight: 700 }}>
              {descargando
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><SpinnerIcon /> Descargando...</span>
                : '📥 Descargar del correo'}
            </button>
          </div>
        </div>

        {/* Paso 2 — independiente */}
        <div className="card" style={{ margin: 0, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#2e7d32', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>02</div>
            <div>
              <div style={{ fontWeight: 700, color: '#1b5e20', fontSize: 14 }}>Clasificar y extraer metadata</div>
              <div style={{ fontSize: 11, color: '#388e3c' }}>XML parser · NIT · Valor · IVA · Fechas</div>
            </div>
            {procesando && <SpinnerIcon color="#2e7d32" size={18} />}
          </div>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 12.5, color: '#555', margin: 0, lineHeight: 1.6 }}>
              Clasifica los ZIPs descargados, descomprime y extrae los campos clave de cada factura XML.
              Los resultados se persisten en base de datos.
            </p>
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Campos extraídos</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['NIT Proveedor','Número factura','Código','Valor','IVA','Fecha emisión','Fecha vencimiento'].map(t => (
                  <span key={t} style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>{t}</span>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={procesar} disabled={procesando} style={{ fontWeight: 700 }}>
              {procesando
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><SpinnerIcon /> Procesando...</span>
                : '⚙️ Clasificar y extraer metadata'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="section-header">
        <div className="section-title">Facturas extraídas ({total})</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" placeholder="Buscar NIT, número, código..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ fontSize: 12, padding: '6px 12px', width: 220 }} />
          <button className="btn btn-outline" onClick={cargarFacturas} disabled={loadingFacturas} style={{ fontSize: 12 }}>
            {loadingFacturas ? 'Actualizando...' : '↺ Actualizar'}
          </button>
          <button className="btn btn-outline" onClick={exportarCSV} disabled={!facturas.length} style={{ fontSize: 12 }}>↓ Exportar CSV</button>
        </div>
      </div>

      <div className="card">
        {loadingFacturas ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#aaa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <SpinnerIcon size={24} color="#aaa" /> <span>Cargando facturas...</span>
          </div>
        ) : facturasFiltradas.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#aaa' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
            <div style={{ fontWeight: 700, color: '#555', marginBottom: 6, fontSize: 15 }}>
              {busqueda ? 'Sin resultados para la búsqueda' : 'Sin facturas aún'}
            </div>
            <div style={{ fontSize: 13 }}>{busqueda ? 'Prueba con otro término.' : 'Ejecuta el pipeline para descargar y procesar facturas.'}</div>
          </div>
        ) : (
          <>
            {busqueda && (
              <div style={{ padding: '10px 18px', background: '#fffde7', borderBottom: '1px solid #e0e0e0', fontSize: 12, color: '#f57f17' }}>
                Mostrando {facturasFiltradas.length} de {total} · Valor filtrado: <strong>{fmtCOP(valorFiltrado)}</strong>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="api-table">
                <thead>
                  <tr>
                    {['#','NIT Proveedor','Número Factura','Código','Valor Factura','IVA','F. Emisión','F. Vencimiento'].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {facturasFiltradas.map((f, i) => (
                    <tr key={f.id || i}>
                      <td style={{ color: '#bbb', fontWeight: 600 }}>{i + 1}</td>
                      <td><span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{f.proveedor_nit || '—'}</span></td>
                      <td style={{ fontWeight: 700, color: '#1b5e20' }}>{f.numero_factura || '—'}</td>
                      <td style={{ color: '#888' }}>{f.codigo || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#1565c0' }}>{fmtCOP(f.valor_factura)}</td>
                      <td style={{ textAlign: 'right', color: '#555' }}>{fmtCOP(f.iva_facturado_proveedor)}</td>
                      <td>{f.fecha_emision ? <span style={{ background: '#e3f2fd', color: '#1565c0', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{f.fecha_emision}</span> : '—'}</td>
                      <td>{f.fecha_vencimiento ? <span style={{ background: '#fce4ec', color: '#c62828', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{f.fecha_vencimiento}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
              <span>{facturasFiltradas.length} registros</span>
              <span style={{ fontWeight: 700, color: '#1b5e20' }}>Total: {fmtCOP(valorFiltrado)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
function SpinnerIcon({ size = 14, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ── Export ──────────────────────────────────────────────────────────────── */
export default function FacturacionPage() {
  const [authHeader, setAuthHeader] = useState(() => {
    const saved = sessionStorage.getItem(AUTH_KEY);
    if (!saved) return null;
    const { user, pass } = JSON.parse(saved);
    return getBasicAuthHeader(user, pass);
  });

  const handleLogout = () => { sessionStorage.removeItem(AUTH_KEY); setAuthHeader(null); };

  if (!authHeader) return <LoginForm onLogin={setAuthHeader} />;
  return <FacturacionDashboard authHeader={authHeader} onLogout={handleLogout} />;
}
