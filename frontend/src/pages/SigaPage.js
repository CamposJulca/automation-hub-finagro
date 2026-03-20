import { useState, useEffect, useCallback, useRef } from 'react';

const SIGA = '/siga-api/beneficios-salud';
const GREEN = '#00853f';

function fmtFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtFechaSolo(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtCOP(val) {
  if (val === null || val === undefined || val === '') return '—';
  return '$' + Number(val).toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

function SpinnerIcon({ size = 14, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const ESTADO_COLOR = {
  RECIBIDO:   { bg: '#e3f2fd', color: '#1565c0' },
  PROCESANDO: { bg: '#fff8e1', color: '#f57f17' },
  PROCESADO:  { bg: '#e8f5e9', color: '#2e7d32' },
  ERROR:      { bg: '#ffebee', color: '#c62828' },
};

const PROVEEDOR_LABEL = { axa: 'AXA Colpatria', colsanitas: 'Colsanitas', desconocido: 'Desconocido' };
const PROVEEDOR_COLOR = {
  axa:        { bg: '#e3f2fd', color: '#1565c0' },
  colsanitas: { bg: '#fce4ec', color: '#880e4f' },
  desconocido:{ bg: '#f5f5f5', color: '#757575' },
};

const CRUCE_ESTADO_COLOR = {
  OK:           { bg: '#e8f5e9', color: '#2e7d32' },
  'NO ENCONTRADO': { bg: '#fff3e0', color: '#e65100' },
  INACTIVO:     { bg: '#f5f5f5', color: '#757575' },
};

/* ── helpers ──────────────────────────────────────────────────────────────── */
async function descargarExcel(url, nombreSugerido) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = nombreSugerido || 'SIGA_Export.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
  } catch {
    alert('No se pudo descargar el archivo Excel.');
  }
}

/* ── Modal base ───────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children, maxWidth = 640 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '90%', maxWidth, maxHeight: '90vh',
        background: '#fff', borderRadius: 12,
        boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1a2e1a' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999', padding: '4px 8px' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── DetalleModal ─────────────────────────────────────────────────────────── */
function DetalleModal({ archivo, onClose }) {
  const [errores, setErrores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${SIGA}/archivos/${archivo.id}/`)
      .then(r => r.json())
      .then(d => { setErrores(d.errores || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [archivo.id]);

  const pv = PROVEEDOR_COLOR[archivo.proveedor] || PROVEEDOR_COLOR.desconocido;
  const ev = ESTADO_COLOR[archivo.estado_procesamiento] || { bg: '#f5f5f5', color: '#555' };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '90%', maxWidth: 860, maxHeight: '85vh',
        background: '#fff', borderRadius: 12,
        boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1a2e1a' }}>{archivo.nombre_archivo}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{fmtFecha(archivo.fecha_recepcion)} · {archivo.usuario_carga}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999', padding: '4px 8px' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid #f0f0f0' }}>
          {[
            { label: 'Total registros', value: archivo.total_registros, color: '#1565c0' },
            { label: 'Procesados',      value: archivo.registros_procesados, color: '#2e7d32' },
            { label: 'Con error',       value: archivo.registros_con_error, color: archivo.registros_con_error > 0 ? '#c62828' : '#aaa' },
            { label: 'Contrato',        value: archivo.numero_contrato || '—', color: '#555' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '16px 22px', borderRight: i < 3 ? '1px solid #f0f0f0' : 'none' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
          <span style={{ ...pv, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
            {PROVEEDOR_LABEL[archivo.proveedor] || archivo.proveedor}
          </span>
          <span style={{ ...ev, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
            {archivo.estado_procesamiento}
          </span>
          {archivo.periodo_facturacion && (
            <span style={{ background: '#f3f0e8', color: '#5d4037', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
              Período: {archivo.periodo_facturacion}
            </span>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Cargando detalles...</div>
          ) : errores.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
              <div style={{ fontWeight: 700, color: '#2e7d32' }}>Sin errores de procesamiento</div>
            </div>
          ) : (
            <>
              <div style={{ padding: '12px 22px 6px', fontSize: 11, fontWeight: 700, color: '#c62828', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {errores.length} error{errores.length !== 1 ? 'es' : ''} de procesamiento
              </div>
              <table className="api-table">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Tipo de error</th>
                    <th>Descripción</th>
                    <th>Valor encontrado</th>
                  </tr>
                </thead>
                <tbody>
                  {errores.map((e, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#c62828' }}>{e.fila_origen}</td>
                      <td><span style={{ background: '#ffebee', color: '#c62828', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{e.tipo_error}</span></td>
                      <td style={{ fontSize: 12, color: '#555' }}>{e.descripcion}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>{e.valor_encontrado || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── UploadZone ───────────────────────────────────────────────────────────── */
function UploadZone({ onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const inputRef = useRef();

  const handleFile = (f) => { if (!f) return; setFile(f); setResult(null); setError(''); };
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  const upload = async () => {
    if (!file) return;
    setUploading(true); setError(''); setResult(null);
    const form = new FormData();
    form.append('archivo', file);
    try {
      const res = await fetch(`${SIGA}/upload/`, { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) { setResult(data); setFile(null); onUploaded(); }
      else setError(data.error || `Error ${res.status}`);
    } catch { setError('No se pudo conectar con SIGA. Verifique que el servicio esté activo.'); }
    finally { setUploading(false); }
  };

  return (
    <div className="card" style={{ margin: 0, overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)', padding: '16px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#880e4f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📤</div>
        <div>
          <div style={{ fontWeight: 700, color: '#880e4f', fontSize: 14 }}>Cargar archivo de proveedor</div>
          <div style={{ fontSize: 11, color: '#ad1457' }}>AXA Colpatria (.xlsx) · Colsanitas (.xls)</div>
        </div>
      </div>
      <div style={{ padding: '22px' }}>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#880e4f' : file ? '#2e7d32' : '#ddd'}`,
            borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
            background: dragging ? '#fce4ec' : file ? '#f1f8e9' : '#fafafa',
            transition: 'all 0.2s', marginBottom: 16,
          }}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          {file ? (
            <><div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 700, color: '#2e7d32', fontSize: 14 }}>{file.name}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB · Listo para procesar</div></>
          ) : (
            <><div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
              <div style={{ fontWeight: 600, color: '#555', fontSize: 14 }}>Arrastra el archivo aquí o haz clic para seleccionar</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Formatos soportados: .xlsx (AXA Colpatria) · .xls (Colsanitas)</div></>
          )}
        </div>
        {error && (
          <div style={{ background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 14 }}>
            ⚠️ {error}
          </div>
        )}
        <button className="btn btn-primary" onClick={upload} disabled={!file || uploading}
          style={{ width: '100%', fontWeight: 700, fontSize: 14, padding: '11px', background: '#880e4f', borderColor: '#880e4f' }}>
          {uploading
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><SpinnerIcon /> Procesando archivo...</span>
            : '⚙️ Procesar archivo'}
        </button>
        {result && (
          <div style={{ marginTop: 20, background: result.registros_con_error > 0 ? '#fffde7' : '#e8f5e9', borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontWeight: 800, color: result.registros_con_error > 0 ? '#f57f17' : '#2e7d32', fontSize: 14, marginBottom: 12 }}>
              {result.registros_con_error > 0 ? '⚠️ Procesado con advertencias' : '✅ Procesado correctamente'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Total registros', value: result.total_registros, color: '#1565c0' },
                { label: 'Procesados',       value: result.registros_procesados, color: '#2e7d32' },
                { label: 'Con error',        value: result.registros_con_error, color: result.registros_con_error > 0 ? '#c62828' : '#aaa' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── TablaArchivos ────────────────────────────────────────────────────────── */
function TablaArchivos({ archivos, loading, onDetalle }) {
  if (loading) return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <SpinnerIcon size={24} color="#aaa" /> <span>Cargando historial...</span>
    </div>
  );
  if (archivos.length === 0) return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🏥</div>
      <div style={{ fontWeight: 700, color: '#555', marginBottom: 6, fontSize: 15 }}>Sin archivos cargados</div>
      <div style={{ fontSize: 13 }}>Carga el primer archivo de AXA Colpatria o Colsanitas para comenzar.</div>
    </div>
  );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="api-table">
        <thead>
          <tr>
            <th>#</th><th>Archivo</th><th>Proveedor</th><th>Fecha recepción</th>
            <th style={{ textAlign: 'center' }}>Total</th>
            <th style={{ textAlign: 'center' }}>Procesados</th>
            <th style={{ textAlign: 'center' }}>Errores</th>
            <th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          {archivos.map((a) => {
            const pv = PROVEEDOR_COLOR[a.proveedor] || PROVEEDOR_COLOR.desconocido;
            const ev = ESTADO_COLOR[a.estado_procesamiento] || { bg: '#f5f5f5', color: '#555' };
            return (
              <tr key={a.id}>
                <td style={{ color: '#bbb', fontWeight: 600 }}>{a.id}</td>
                <td>
                  <div style={{ fontWeight: 600, color: '#1a2e1a', fontSize: 12 }}>{a.nombre_archivo}</div>
                  {a.numero_contrato && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Contrato: {a.numero_contrato}</div>}
                </td>
                <td><span style={{ ...pv, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{PROVEEDOR_LABEL[a.proveedor] || a.proveedor}</span></td>
                <td style={{ fontSize: 12, color: '#666' }}>{fmtFecha(a.fecha_recepcion)}</td>
                <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#1565c0' }}>{a.total_registros}</td>
                <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#2e7d32' }}>{a.registros_procesados}</td>
                <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: a.registros_con_error > 0 ? '#c62828' : '#aaa' }}>{a.registros_con_error}</td>
                <td><span style={{ ...ev, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{a.estado_procesamiento}</span></td>
                <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                  <button onClick={() => onDetalle(a)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#555', fontWeight: 600 }}>Ver detalle →</button>
                  <button onClick={() => descargarExcel(`${SIGA}/exportar/?archivo_id=${a.id}`, `SIGA_Beneficios_${a.id}.xlsx`)}
                    style={{ background: 'none', border: '1px solid #a5d6a7', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#2e7d32', fontWeight: 600 }}>
                    ⬇ Excel
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── TabDashboard ─────────────────────────────────────────────────────────── */
function TabDashboard({ archivos, loading, cargarArchivos }) {
  const [dash, setDash] = useState(null);
  const cargarDash = useCallback(async () => {
    try { const r = await fetch(`${SIGA}/dashboard/`); if (r.ok) setDash(await r.json()); } catch {}
  }, []);
  useEffect(() => { cargarDash(); }, [cargarDash]);

  const totalArchivos  = archivos.length;
  const totalRegistros = archivos.reduce((s, a) => s + (a.total_registros || 0), 0);
  const totalErrores   = archivos.reduce((s, a) => s + (a.registros_con_error || 0), 0);
  const proveedores    = [...new Set(archivos.map(a => a.proveedor).filter(p => p !== 'desconocido'))];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: '📁', label: 'Archivos recibidos', value: totalArchivos, bg: '#e3f2fd', color: '#1565c0' },
          { icon: '👥', label: 'Beneficiarios', value: totalRegistros.toLocaleString('es-CO'), bg: '#e8f5e9', color: '#2e7d32' },
          { icon: '⚠️', label: 'Con error', value: totalErrores, bg: '#ffebee', color: totalErrores > 0 ? '#c62828' : '#aaa' },
          { icon: '🏢', label: 'Proveedores activos', value: proveedores.length, bg: '#fce4ec', color: '#880e4f' },
        ].map(k => (
          <div key={k.label} className="card" style={{ margin: 0, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {dash && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-header" style={{ marginBottom: 12 }}>
            <div className="section-title">Resumen del último período</div>
            <button className="btn btn-outline" onClick={cargarDash} style={{ fontSize: 11 }}>↺</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(dash.ultimos_periodos.length, 1)}, 1fr)`, gap: 16, marginBottom: 20 }}>
            {dash.ultimos_periodos.map(p => {
              const isAxa = p.proveedor === 'axa';
              const color = isAxa ? '#1565c0' : '#880e4f';
              const bg    = isAxa ? 'linear-gradient(135deg,#e3f2fd,#bbdefb)' : 'linear-gradient(135deg,#fce4ec,#f8bbd0)';
              return (
                <div key={p.proveedor} className="card" style={{ margin: 0, overflow: 'hidden' }}>
                  <div style={{ background: bg, padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color }}>{isAxa ? 'AXA Colpatria' : 'Colsanitas'}</div>
                      <div style={{ fontSize: 11, color, opacity: 0.8, marginTop: 2 }}>{p.periodo}</div>
                    </div>
                    <span style={{ background: color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>Contrato {p.numero_contrato}</span>
                  </div>
                  <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color }}>{p.total_beneficiarios.toLocaleString('es-CO')}</div>
                      <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Beneficiarios</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#1a2e1a' }}>${(p.valor_total / 1_000_000).toFixed(1)}M</div>
                      <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Valor total</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {dash.distribucion_parentesco && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ margin: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: 13, color: '#333' }}>
                  Distribución por parentesco <span style={{ fontSize: 11, fontWeight: 400, color: '#999', marginLeft: 8 }}>último período</span>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(() => {
                    const maxCount = Math.max(...dash.distribucion_parentesco.map(r => r.count), 1);
                    return dash.distribucion_parentesco.map(r => {
                      const pct = Math.round((r.count / maxCount) * 100);
                      const colores = { T: '#1565c0', CO: '#880e4f', HI: '#2e7d32', P: '#f57f17', OT: '#757575', '': '#aaa' };
                      const c = colores[(r.parentesco || '').toUpperCase()] || '#aaa';
                      return (
                        <div key={r.parentesco || 'vacio'}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#333' }}>{r.label}</span>
                            <span style={{ color: '#888' }}>{r.count} · {fmtCOP(r.valor_total)}</span>
                          </div>
                          <div style={{ background: '#f0f0f0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 4, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              <div className="card" style={{ margin: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: 13, color: '#333' }}>
                  Valor facturado por proveedor <span style={{ fontSize: 11, fontWeight: 400, color: '#999', marginLeft: 8 }}>último período</span>
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const total = dash.distribucion_proveedor.reduce((s, r) => s + r.valor_total, 0) || 1;
                    return dash.distribucion_proveedor.map(r => {
                      const isAxa = r.proveedor === 'axa';
                      const color = isAxa ? '#1565c0' : '#880e4f';
                      const pct   = Math.round((r.valor_total / total) * 100);
                      return (
                        <div key={r.proveedor}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, color, fontSize: 13 }}>{isAxa ? 'AXA Colpatria' : 'Colsanitas'}</span>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, fontSize: 16, color }}>${(r.valor_total / 1_000_000).toFixed(2)}M</div>
                              <div style={{ fontSize: 10, color: '#aaa' }}>{r.count} beneficiarios · {pct}%</div>
                            </div>
                          </div>
                          <div style={{ background: '#f0f0f0', borderRadius: 6, height: 12, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: 6, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#333', fontSize: 13 }}>Total período</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: '#1a2e1a' }}>${(dash.consolidado.valor_total_ultimo_periodo / 1_000_000).toFixed(2)}M</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── TabFacturasEPS ───────────────────────────────────────────────────────── */
function TabFacturasEPS({ archivos, loading, cargarArchivos }) {
  const [detalleArchivo, setDetalle] = useState(null);
  const [cedulaBusqueda, setCedulaBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);
  const [archivoNuevo, setArchivoNuevo] = useState('');
  const [archivoAnterior, setArchivoAnterior] = useState('');
  const [novedades, setNovedades] = useState(null);
  const [comparando, setComparando] = useState(false);
  const [novedadesError, setNovedadesError] = useState('');
  const [mostrarNuevos, setMostrarNuevos] = useState(true);
  const [mostrarRetirados, setMostrarRetirados] = useState(true);
  const [mostrarCambios, setMostrarCambios] = useState(true);

  const buscarFuncionario = async (e) => {
    e.preventDefault();
    if (!cedulaBusqueda.trim()) return;
    setBuscando(true); setBusquedaRealizada(false); setResultados([]);
    try {
      const res = await fetch(`${SIGA}/beneficios/?cedula=${encodeURIComponent(cedulaBusqueda.trim())}`);
      if (res.ok) setResultados(await res.json());
    } catch {}
    finally { setBuscando(false); setBusquedaRealizada(true); }
  };

  const compararNovedades = async () => {
    if (!archivoNuevo || !archivoAnterior) return;
    setComparando(true); setNovedades(null); setNovedadesError('');
    try {
      const res = await fetch(`${SIGA}/novedades/?archivo_nuevo=${archivoNuevo}&archivo_anterior=${archivoAnterior}`);
      const data = await res.json();
      if (res.ok) setNovedades(data);
      else setNovedadesError(data.error || `Error ${res.status}`);
    } catch { setNovedadesError('No se pudo conectar con SIGA.'); }
    finally { setComparando(false); }
  };

  return (
    <div>
      {detalleArchivo && <DetalleModal archivo={detalleArchivo} onClose={() => setDetalle(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, marginBottom: 28 }}>
        <UploadZone onUploaded={cargarArchivos} />
        <div className="card" style={{ margin: 0, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg,#fafafa,#f0f4ff)', padding: '16px 22px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ fontWeight: 700, color: '#333', fontSize: 14 }}>Proveedores soportados</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Detección automática por nombre y columnas</div>
          </div>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { nombre: 'AXA Colpatria', icono: '🔵', formato: '.xlsx', color: '#1565c0', bg: '#e3f2fd', nota: 'Encabezados en fila ~10. Sin descuento comercial separado.' },
              { nombre: 'Colsanitas',    icono: '🔴', formato: '.xls',  color: '#880e4f', bg: '#fce4ec', nota: 'Encabezados en fila ~12. Filtra filas TOTAL FAMILIA X.' },
            ].map(p => (
              <div key={p.nombre} style={{ border: `1px solid ${p.bg}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: p.bg, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{p.icono}</span>
                  <div style={{ fontWeight: 700, color: p.color, fontSize: 13 }}>{p.nombre}</div>
                  <span style={{ marginLeft: 'auto', background: p.color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{p.formato}</span>
                </div>
                <div style={{ padding: '10px 14px', fontSize: 11, color: '#888', fontStyle: 'italic' }}>{p.nota}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title">Historial de archivos procesados ({archivos.length})</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => descargarExcel(`${SIGA}/exportar/`, 'SIGA_Beneficios_Consolidado.xlsx')} style={{ fontSize: 12, color: '#2e7d32', borderColor: '#a5d6a7' }}>⬇ Exportar Excel</button>
          <button className="btn btn-outline" onClick={cargarArchivos} disabled={loading} style={{ fontSize: 12 }}>{loading ? 'Actualizando...' : '↺ Actualizar'}</button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 28 }}>
        <TablaArchivos archivos={archivos} loading={loading} onDetalle={setDetalle} />
      </div>

      <div className="section-header" style={{ marginTop: 8 }}>
        <div className="section-title">Consulta por funcionario</div>
      </div>
      <div className="card" style={{ marginBottom: 28 }}>
        <form onSubmit={buscarFuncionario} style={{ padding: '18px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="text" value={cedulaBusqueda} onChange={e => setCedulaBusqueda(e.target.value)}
            placeholder="Ingrese número de cédula..."
            style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          <button type="submit" className="btn btn-primary" disabled={buscando || !cedulaBusqueda.trim()}
            style={{ background: '#880e4f', borderColor: '#880e4f', fontWeight: 700, fontSize: 13, padding: '8px 20px' }}>
            {buscando ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SpinnerIcon /> Buscando...</span> : 'Buscar'}
          </button>
        </form>
        {busquedaRealizada && (
          resultados.length === 0
            ? <div style={{ padding: '32px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>No se encontraron registros para esa cédula.</div>
            : <>
                <div style={{ padding: '10px 22px 6px', fontSize: 11, color: '#888', borderBottom: '1px solid #f5f5f5' }}>
                  {resultados.length} registro{resultados.length !== 1 ? 's' : ''} encontrado{resultados.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                  Total: <strong style={{ color: '#2e7d32' }}>{fmtCOP(resultados.reduce((s, r) => s + (Number(r.valor_total) || 0), 0))}</strong>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="api-table">
                    <thead>
                      <tr><th>Cédula</th><th>Nombre</th><th>Parentesco</th><th>Proveedor</th><th>Período</th>
                        <th style={{ textAlign: 'right' }}>Valor base</th><th style={{ textAlign: 'right' }}>IVA</th>
                        <th style={{ textAlign: 'right' }}>Total</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {resultados.map((r, i) => {
                        const pv = PROVEEDOR_COLOR[r.proveedor] || PROVEEDOR_COLOR.desconocido;
                        const esAdv = r.estado_validacion === 'ADVERTENCIA';
                        return (
                          <tr key={i} style={{ background: esAdv ? '#fffde7' : undefined }}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.cedula}</td>
                            <td style={{ fontWeight: 600, fontSize: 12 }}>{r.nombre}</td>
                            <td style={{ fontSize: 12 }}>{r.parentesco || '—'}</td>
                            <td><span style={{ ...pv, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{PROVEEDOR_LABEL[r.proveedor] || r.proveedor}</span></td>
                            <td style={{ fontSize: 12 }}>{r.periodo_facturacion || '—'}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(r.valor_base)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(r.iva)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#1565c0' }}>{fmtCOP(r.valor_total)}</td>
                            <td><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: esAdv ? '#fff9c4' : '#e8f5e9', color: esAdv ? '#f57f17' : '#2e7d32' }}>{r.estado_validacion || '—'}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
        )}
      </div>

      <div className="section-header"><div className="section-title">Novedades entre períodos</div></div>
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {[
            { label: 'Archivo nuevo', value: archivoNuevo, set: setArchivoNuevo },
            { label: 'Archivo anterior', value: archivoAnterior, set: setArchivoAnterior },
          ].map(({ label, value, set }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
              <select value={value} onChange={e => set(e.target.value)} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}>
                <option value="">-- Seleccionar --</option>
                {archivos.filter(a => a.estado_procesamiento === 'PROCESADO').map(a => (
                  <option key={a.id} value={a.id}>#{a.id} · {a.proveedor.toUpperCase()} · {a.periodo_facturacion || a.nombre_archivo}</option>
                ))}
              </select>
            </div>
          ))}
          <button className="btn btn-primary" onClick={compararNovedades} disabled={comparando || !archivoNuevo || !archivoAnterior}
            style={{ background: '#1565c0', borderColor: '#1565c0', fontWeight: 700, fontSize: 13, padding: '8px 24px' }}>
            {comparando ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SpinnerIcon /> Comparando...</span> : 'Comparar'}
          </button>
        </div>
        {novedadesError && <div style={{ margin: '16px 22px', background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 12.5 }}>{novedadesError}</div>}
        {novedades && (
          <div style={{ padding: '20px 22px' }}>
            {novedades.warning && <div style={{ background: '#fff8e1', color: '#f57f17', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>⚠ {novedades.warning}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Nuevos', value: novedades.resumen.nuevos, color: '#2e7d32', bg: '#e8f5e9' },
                { label: 'Retirados', value: novedades.resumen.retirados, color: '#c62828', bg: '#ffebee' },
                { label: 'Cambios de valor', value: novedades.resumen.cambios_valor, color: '#f57f17', bg: '#fff8e1' },
                { label: 'Sin cambios', value: novedades.resumen.sin_cambios, color: '#555', bg: '#f5f5f5' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {novedades.nuevos.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => setMostrarNuevos(v => !v)} style={{ background: '#e8f5e9', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#2e7d32', cursor: 'pointer', marginBottom: 8 }}>
                  {mostrarNuevos ? '▾' : '▸'} Nuevos afiliados ({novedades.nuevos.length})
                </button>
                {mostrarNuevos && <div style={{ overflowX: 'auto' }}><table className="api-table"><thead><tr><th>Cédula</th><th>Nombre</th><th>Parentesco</th><th style={{ textAlign: 'right' }}>Valor total</th></tr></thead><tbody>
                  {novedades.nuevos.map((r, i) => <tr key={i}><td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.cedula}</td><td style={{ fontSize: 12 }}>{r.nombre}</td><td style={{ fontSize: 12 }}>{r.parentesco || '—'}</td><td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32', fontWeight: 700, fontSize: 12 }}>{fmtCOP(r.valor_total)}</td></tr>)}
                </tbody></table></div>}
              </div>
            )}
            {novedades.retirados.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => setMostrarRetirados(v => !v)} style={{ background: '#ffebee', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#c62828', cursor: 'pointer', marginBottom: 8 }}>
                  {mostrarRetirados ? '▾' : '▸'} Retirados ({novedades.retirados.length})
                </button>
                {mostrarRetirados && <div style={{ overflowX: 'auto' }}><table className="api-table"><thead><tr><th>Cédula</th><th>Nombre</th><th>Parentesco</th><th style={{ textAlign: 'right' }}>Último valor</th></tr></thead><tbody>
                  {novedades.retirados.map((r, i) => <tr key={i}><td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.cedula}</td><td style={{ fontSize: 12 }}>{r.nombre}</td><td style={{ fontSize: 12 }}>{r.parentesco || '—'}</td><td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828', fontWeight: 700, fontSize: 12 }}>{fmtCOP(r.valor_total)}</td></tr>)}
                </tbody></table></div>}
              </div>
            )}
            {novedades.cambios_valor.length > 0 && (
              <div>
                <button onClick={() => setMostrarCambios(v => !v)} style={{ background: '#fff8e1', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#f57f17', cursor: 'pointer', marginBottom: 8 }}>
                  {mostrarCambios ? '▾' : '▸'} Cambios de valor ({novedades.cambios_valor.length})
                </button>
                {mostrarCambios && <div style={{ overflowX: 'auto' }}><table className="api-table"><thead><tr><th>Cédula</th><th>Nombre</th><th>Parentesco</th><th style={{ textAlign: 'right' }}>Anterior</th><th style={{ textAlign: 'right' }}>Nuevo</th><th style={{ textAlign: 'right' }}>Diferencia</th></tr></thead><tbody>
                  {novedades.cambios_valor.map((r, i) => {
                    const dif = Number(r.diferencia);
                    return <tr key={i}><td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.cedula}</td><td style={{ fontSize: 12 }}>{r.nombre}</td><td style={{ fontSize: 12 }}>{r.parentesco || '—'}</td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(r.valor_anterior)}</td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(r.valor_nuevo)}</td><td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: dif > 0 ? '#c62828' : '#2e7d32' }}>{dif > 0 ? '+' : ''}{fmtCOP(dif)}</td></tr>;
                  })}
                </tbody></table></div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── TabPlanilla ──────────────────────────────────────────────────────────── */
function TabPlanilla() {
  const [periodos, setPeriodos] = useState([]);
  const [periodoSelec, setPeriodoSelec] = useState('');
  const [cruce, setCruce] = useState([]);
  const [cargandoCruce, setCargandoCruce] = useState(false);
  const [cruceError, setCruceError] = useState('');

  const [periodoCalc, setPeriodoCalc] = useState('');
  const [calculando, setCalculando] = useState(false);
  const [calcResult, setCalcResult] = useState(null);
  const [calcError, setCalcError] = useState('');

  const [planillas, setPlanillas] = useState([]);
  const [cargandoPlanillas, setCargandoPlanillas] = useState(false);
  const [planillaDetalle, setPlanillaDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargarPeriodos = useCallback(async () => {
    try {
      const r = await fetch(`${SIGA}/cruce/`);
      if (r.ok) {
        const d = await r.json();
        setPeriodos(d.periodos_disponibles || []);
        if (d.periodos_disponibles && d.periodos_disponibles.length > 0) {
          setPeriodoSelec(d.periodos_disponibles[0]);
        }
      }
    } catch {}
  }, []);

  const cargarPlanillas = useCallback(async () => {
    setCargandoPlanillas(true);
    try { const r = await fetch(`${SIGA}/planilla/`); if (r.ok) setPlanillas(await r.json()); } catch {}
    finally { setCargandoPlanillas(false); }
  }, []);

  useEffect(() => { cargarPeriodos(); cargarPlanillas(); }, [cargarPeriodos, cargarPlanillas]);

  const consultarCruce = async () => {
    if (!periodoSelec) return;
    setCargandoCruce(true); setCruce([]); setCruceError('');
    try {
      const r = await fetch(`${SIGA}/cruce/?periodo=${periodoSelec}`);
      const d = await r.json();
      if (r.ok) setCruce(d.cruce || []);
      else setCruceError(d.error || `Error ${r.status}`);
    } catch { setCruceError('No se pudo conectar con SIGA.'); }
    finally { setCargandoCruce(false); }
  };

  const calcularPlanilla = async () => {
    if (!periodoCalc.trim()) return;
    setCalculando(true); setCalcResult(null); setCalcError('');
    try {
      const r = await fetch(`${SIGA}/planilla/calcular/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo: periodoCalc.trim() }),
      });
      const d = await r.json();
      if (r.ok) { setCalcResult(d); cargarPlanillas(); }
      else setCalcError(d.error || `Error ${r.status}`);
    } catch { setCalcError('No se pudo conectar con SIGA.'); }
    finally { setCalculando(false); }
  };

  const verDetalle = async (planilla) => {
    setCargandoDetalle(true); setPlanillaDetalle(null);
    try {
      const r = await fetch(`${SIGA}/planilla/${planilla.id}/`);
      if (r.ok) setPlanillaDetalle(await r.json());
    } catch {}
    finally { setCargandoDetalle(false); }
  };

  const estadoBadge = (estado) => {
    const c = CRUCE_ESTADO_COLOR[estado] || { bg: '#f5f5f5', color: '#555' };
    return <span style={{ ...c, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{estado || '—'}</span>;
  };

  return (
    <div>
      {/* Cruce del período */}
      <div className="section-header"><div className="section-title">Cruce del período</div></div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Período disponible</label>
            {periodos.length === 0
              ? <div style={{ fontSize: 12, color: '#f57f17', padding: '8px 12px', background: '#fff8e1', borderRadius: 8 }}>
                  No hay períodos disponibles. Cargue las facturas del mes en la pestaña Facturas EPS.
                </div>
              : <select value={periodoSelec} onChange={e => setPeriodoSelec(e.target.value)}
                  style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', minWidth: 180 }}>
                  {periodos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            }
          </div>
          <button className="btn btn-primary" onClick={consultarCruce} disabled={cargandoCruce || !periodoSelec}
            style={{ background: GREEN, borderColor: GREEN, fontWeight: 700, padding: '8px 24px' }}>
            {cargandoCruce ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SpinnerIcon /> Consultando...</span> : 'Ver cruce'}
          </button>
        </div>
        {cruceError && <div style={{ margin: '16px 22px', background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 12.5 }}>{cruceError}</div>}
        {cruce.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="api-table">
              <thead>
                <tr><th>Cédula</th><th>Nombre en Factura</th><th>Nombre en Kactus</th><th>EPS</th>
                  <th style={{ textAlign: 'center' }}>Benef.</th>
                  <th style={{ textAlign: 'right' }}>Total familia</th>
                  <th>Estado</th><th>Sub. Cto</th></tr>
              </thead>
              <tbody>
                {cruce.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.cedula}</td>
                    <td style={{ fontSize: 12 }}>{row.nombre_en_factura}</td>
                    <td style={{ fontSize: 12 }}>{row.nombre_en_kactus || '—'}</td>
                    <td style={{ fontSize: 12 }}>{row.eps}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{row.num_beneficiarios}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(row.total_familia)}</td>
                    <td>{estadoBadge(row.estado)}</td>
                    <td style={{ fontSize: 11, color: '#888' }}>{row.sub_cto || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Calcular planilla */}
      <div className="section-header"><div className="section-title">Calcular planilla 80/20</div></div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Período (MMYYYY)</label>
            <input type="text" value={periodoCalc} onChange={e => setPeriodoCalc(e.target.value)} placeholder="ej. 032026"
              style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: 160 }} />
          </div>
          <button className="btn btn-primary" onClick={calcularPlanilla} disabled={calculando || !periodoCalc.trim()}
            style={{ background: GREEN, borderColor: GREEN, fontWeight: 700, padding: '8px 24px' }}>
            {calculando ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SpinnerIcon /> Calculando...</span> : '🧮 Calcular'}
          </button>
        </div>
        {calcError && <div style={{ margin: '16px 22px', background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 12.5 }}>{calcError}</div>}
        {calcResult && (
          <div style={{ padding: '20px 22px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Total empleados', value: calcResult.total_empleados, color: '#1565c0' },
                { label: 'Total empresa (80%)', value: fmtCOP(calcResult.total_empresa), color: GREEN },
                { label: 'Total empleado (20%)', value: fmtCOP(calcResult.total_empleado), color: '#f57f17' },
                { label: 'Total no gravable', value: fmtCOP(calcResult.total_no_gravable), color: '#6a1b9a' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>Planilla generada · ID #{calcResult.id} · Período: {calcResult.periodo}</div>
          </div>
        )}
      </div>

      {/* Historial de planillas */}
      <div className="section-header">
        <div className="section-title">Historial de planillas</div>
        <button className="btn btn-outline" onClick={cargarPlanillas} disabled={cargandoPlanillas} style={{ fontSize: 11 }}>↺ Actualizar</button>
      </div>
      <div className="card" style={{ marginBottom: 24 }}>
        {cargandoPlanillas
          ? <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}><SpinnerIcon size={24} color="#aaa" /></div>
          : planillas.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>No hay planillas generadas aún.</div>
            : <div style={{ overflowX: 'auto' }}>
                <table className="api-table">
                  <thead>
                    <tr><th>Período</th><th style={{ textAlign: 'center' }}>Empleados</th>
                      <th style={{ textAlign: 'right' }}>Total empresa</th>
                      <th style={{ textAlign: 'right' }}>Total empleado</th>
                      <th style={{ textAlign: 'right' }}>Total gravable</th>
                      <th style={{ textAlign: 'right' }}>No gravable</th>
                      <th>Generada</th><th></th></tr>
                  </thead>
                  <tbody>
                    {planillas.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700, color: GREEN }}>{p.periodo}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{p.total_empleados}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(p.total_empresa)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(p.total_empleado)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: p.total_gravable > 0 ? '#c62828' : '#555' }}>{fmtCOP(p.total_gravable)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(p.total_no_gravable)}</td>
                        <td style={{ fontSize: 11, color: '#888' }}>{fmtFecha(p.generada_en)}</td>
                        <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                          <button onClick={() => verDetalle(p)} style={{ background: 'none', border: `1px solid ${GREEN}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: GREEN, fontWeight: 600 }}>Ver detalle</button>
                          <button onClick={() => descargarExcel(`${SIGA}/planilla/${p.id}/exportar/`, `Planilla_8020_${p.periodo}.xlsx`)} style={{ background: 'none', border: '1px solid #a5d6a7', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#2e7d32', fontWeight: 600 }}>⬇ Excel</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </div>

      {/* Detalle de planilla */}
      {cargandoDetalle && <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}><SpinnerIcon size={24} color="#aaa" /></div>}
      {planillaDetalle && (
        <div className="card" style={{ marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#1a2e1a' }}>Detalle Planilla · {planillaDetalle.periodo}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{planillaDetalle.detalles?.length || 0} empleados</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => descargarExcel(`${SIGA}/planilla/${planillaDetalle.id}/exportar/`, `Planilla_8020_${planillaDetalle.periodo}.xlsx`)}
                style={{ background: GREEN, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 700 }}>
                ⬇ Exportar Excel
              </button>
              <button onClick={() => setPlanillaDetalle(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#888' }}>Cerrar</button>
            </div>
          </div>
          {planillaDetalle.detalles?.some(d => d.apoyo_gravable > 0) && (
            <div style={{ margin: '16px 22px 0', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#f57f17' }}>
              ⚠️ Hay empleados con apoyo gravable. Verifique los límites de UVT.
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table className="api-table">
              <thead>
                <tr><th>Cédula</th><th>Nombre Kactus</th><th>EPS</th>
                  <th style={{ textAlign: 'center' }}>Benef.</th>
                  <th style={{ textAlign: 'right' }}>Total familia</th>
                  <th style={{ textAlign: 'right' }}>Empresa (80%)</th>
                  <th style={{ textAlign: 'right' }}>Empleado (20%)</th>
                  <th style={{ textAlign: 'right' }}>No gravable</th>
                  <th style={{ textAlign: 'right' }}>Gravable</th>
                  <th>Estado</th></tr>
              </thead>
              <tbody>
                {(planillaDetalle.detalles || []).map((d, i) => (
                  <tr key={i} style={{ background: d.apoyo_gravable > 0 ? '#fffde7' : undefined }}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.cedula}</td>
                    <td style={{ fontSize: 12 }}>{d.nombre_en_kactus || d.nombre_en_factura}</td>
                    <td style={{ fontSize: 12 }}>{d.eps}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{d.num_beneficiarios}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(d.total_familia)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: GREEN, fontWeight: 700 }}>{fmtCOP(d.valor_empresa)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(d.valor_empleado)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(d.apoyo_no_gravable)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: d.apoyo_gravable > 0 ? '#c62828' : '#aaa', fontWeight: d.apoyo_gravable > 0 ? 700 : 400 }}>{fmtCOP(d.apoyo_gravable)}</td>
                    <td>{estadoBadgeCruce(d.estado_cruce)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function estadoBadgeCruce(estado) {
  const c = CRUCE_ESTADO_COLOR[estado] || { bg: '#f5f5f5', color: '#555' };
  return <span style={{ ...c, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{estado || '—'}</span>;
}

/* ── TabApoyoGravable ─────────────────────────────────────────────────────── */
function TabApoyoGravable() {
  const [planillas, setPlanillas] = useState([]);
  const [planillaId, setPlanillaId] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${SIGA}/planilla/`).then(r => r.ok ? r.json() : []).then(setPlanillas).catch(() => {});
  }, []);

  const consultar = async () => {
    if (!planillaId) return;
    setCargando(true); setDetalle(null); setError('');
    try {
      const r = await fetch(`${SIGA}/planilla/${planillaId}/`);
      if (r.ok) setDetalle(await r.json());
      else setError(`Error ${r.status}`);
    } catch { setError('No se pudo conectar.'); }
    finally { setCargando(false); }
  };

  const items = detalle?.detalles || [];
  const totalNoGrav = items.reduce((s, d) => s + (Number(d.apoyo_no_gravable) || 0), 0);
  const totalGrav   = items.reduce((s, d) => s + (Number(d.apoyo_gravable) || 0), 0);
  const totalEmp    = items.reduce((s, d) => s + (Number(d.valor_empresa) || 0), 0);
  const conExceso   = items.filter(d => d.apoyo_gravable > 0).length;

  return (
    <div>
      <div style={{ background: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 12.5, color: '#1565c0' }}>
        ℹ️ <strong>Límite exento 80/20:</strong> 16 UVT = $796,784. El exceso es apoyo gravable para el empleado.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Planilla</label>
          <select value={planillaId} onChange={e => setPlanillaId(e.target.value)}
            style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', minWidth: 220 }}>
            <option value="">-- Seleccionar planilla --</option>
            {planillas.map(p => <option key={p.id} value={p.id}>#{p.id} · {p.periodo}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={consultar} disabled={cargando || !planillaId}
          style={{ background: GREEN, borderColor: GREEN, fontWeight: 700, padding: '8px 24px' }}>
          {cargando ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SpinnerIcon /> Cargando...</span> : 'Consultar'}
        </button>
      </div>

      {error && <div style={{ background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 16 }}>{error}</div>}

      {detalle && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { icon: '💰', label: 'Total no gravable', value: fmtCOP(totalNoGrav), color: '#2e7d32', bg: '#e8f5e9' },
              { icon: '⚠️', label: 'Total gravable', value: fmtCOP(totalGrav), color: totalGrav > 0 ? '#c62828' : '#aaa', bg: totalGrav > 0 ? '#ffebee' : '#f5f5f5' },
              { icon: '🏢', label: 'Total empresa', value: fmtCOP(totalEmp), color: GREEN, bg: '#e8f5e9' },
              { icon: '👤', label: 'Empleados con exceso', value: conExceso, color: conExceso > 0 ? '#c62828' : '#aaa', bg: conExceso > 0 ? '#ffebee' : '#f5f5f5' },
            ].map(k => (
              <div key={k.label} className="card" style={{ margin: 0, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{k.icon}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 3 }}>{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="api-table">
                <thead>
                  <tr><th>Cédula</th><th>Nombre</th><th>EPS</th>
                    <th style={{ textAlign: 'right' }}>No gravable</th>
                    <th style={{ textAlign: 'right' }}>Gravable</th>
                    <th style={{ textAlign: 'right' }}>Total empresa</th></tr>
                </thead>
                <tbody>
                  {items.map((d, i) => (
                    <tr key={i} style={{ background: d.apoyo_gravable > 0 ? '#fff8e1' : undefined }}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.cedula}</td>
                      <td style={{ fontSize: 12 }}>{d.nombre_en_kactus || d.nombre_en_factura}</td>
                      <td style={{ fontSize: 12 }}>{d.eps}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#2e7d32' }}>{fmtCOP(d.apoyo_no_gravable)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                        {d.apoyo_gravable > 0
                          ? <span style={{ background: '#ffebee', color: '#c62828', fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>{fmtCOP(d.apoyo_gravable)}</span>
                          : <span style={{ color: '#aaa' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: GREEN }}>{fmtCOP(d.valor_empresa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── TabCausacion ─────────────────────────────────────────────────────────── */
function TabCausacion() {
  const [periodo, setPeriodo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = async () => {
    if (!periodo.trim()) return;
    setCargando(true); setResultado(null); setError('');
    try {
      const r = await fetch(`${SIGA}/causacion/?periodo=${encodeURIComponent(periodo.trim())}`);
      const d = await r.json();
      if (r.ok) setResultado(d);
      else setError(d.error || `Error ${r.status}`);
    } catch { setError('No se pudo conectar con SIGA.'); }
    finally { setCargando(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Período (MMYYYY)</label>
          <input type="text" value={periodo} onChange={e => setPeriodo(e.target.value)} placeholder="ej. 032026"
            style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: 160 }} />
        </div>
        <button className="btn btn-primary" onClick={consultar} disabled={cargando || !periodo.trim()}
          style={{ background: GREEN, borderColor: GREEN, fontWeight: 700, padding: '8px 24px' }}>
          {cargando ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SpinnerIcon /> Consultando...</span> : 'Consultar'}
        </button>
      </div>

      {error && <div style={{ background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 16 }}>{error}</div>}

      {resultado && (
        <>
          <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 700, color: '#333' }}>
            Causación período: <span style={{ color: GREEN }}>{resultado.periodo}</span>
          </div>
          <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="api-table">
                <thead>
                  <tr><th>EPS</th>
                    <th style={{ textAlign: 'center' }}>Empleados</th>
                    <th style={{ textAlign: 'right' }}>Total empresa</th>
                    <th style={{ textAlign: 'right' }}>Total empleado</th>
                    <th style={{ textAlign: 'right' }}>Total factura</th>
                    <th style={{ textAlign: 'right' }}>No gravable</th>
                    <th style={{ textAlign: 'right' }}>Gravable</th></tr>
                </thead>
                <tbody>
                  {(resultado.por_eps || []).map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{row.eps}</td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{row.num_empleados}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: GREEN, fontWeight: 700 }}>{fmtCOP(row.total_empresa)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(row.total_empleado)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{fmtCOP(row.total_general)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(row.apoyo_no_gravable)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: row.apoyo_gravable > 0 ? '#c62828' : '#aaa' }}>{fmtCOP(row.apoyo_gravable)}</td>
                    </tr>
                  ))}
                  {resultado.totales && (
                    <tr style={{ background: '#f0f4f0', fontWeight: 800 }}>
                      <td>TOTAL</td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{resultado.totales.num_empleados}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: GREEN }}>{fmtCOP(resultado.totales.total_empresa)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtCOP(resultado.totales.total_empleado)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtCOP(resultado.totales.total_general)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtCOP(resultado.totales.apoyo_no_gravable)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: resultado.totales.apoyo_gravable > 0 ? '#c62828' : '#aaa' }}>{fmtCOP(resultado.totales.apoyo_gravable)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── FormPersona (Pensionados / Auxilio Externo) ──────────────────────────── */
function FormPersona({ titulo, item, onSave, onCancel, saving }) {
  const [form, setForm] = useState(item || {
    cedula: '', nombre: '', eps: '', valor_mensual: '',
    fecha_inicio: '', fecha_fin: '', activo: true, observaciones: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ padding: '20px 22px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {[
          { key: 'cedula', label: 'Cédula', placeholder: '12345678', type: 'text' },
          { key: 'nombre', label: 'Nombre completo', placeholder: 'Nombre apellido', type: 'text' },
          { key: 'eps', label: 'EPS', placeholder: 'Nombre de la EPS', type: 'text' },
          { key: 'valor_mensual', label: 'Valor mensual', placeholder: '0', type: 'number' },
          { key: 'fecha_inicio', label: 'Fecha inicio', placeholder: '', type: 'date' },
          { key: 'fecha_fin', label: 'Fecha fin (opcional)', placeholder: '', type: 'date' },
        ].map(f => (
          <div key={f.key}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{f.label}</label>
            <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder}
              style={{ width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Observaciones</label>
        <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2}
          style={{ width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 18, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)} />
        Activo
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer', color: '#555' }}>Cancelar</button>
        <button onClick={() => onSave(form)} disabled={saving}
          style={{ background: GREEN, border: 'none', borderRadius: 8, padding: '8px 22px', fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 700 }}>
          {saving ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SpinnerIcon /> Guardando...</span> : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

/* ── TabPersonas (Pensionados / Auxilio) ──────────────────────────────────── */
function TabPersonas({ endpoint, nombreSingular, nombrePlural }) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modal, setModal] = useState(null); // null | 'create' | item
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try { const r = await fetch(`${SIGA}/${endpoint}/`); if (r.ok) setItems(await r.json()); } catch {}
    finally { setCargando(false); }
  }, [endpoint]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (form) => {
    setSaving(true); setError('');
    const isEdit = modal && modal !== 'create';
    const url = isEdit ? `${SIGA}/${endpoint}/${modal.id}/` : `${SIGA}/${endpoint}/`;
    const method = isEdit ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (r.ok) { setModal(null); cargar(); }
      else { const d = await r.json(); setError(d.error || JSON.stringify(d)); }
    } catch { setError('No se pudo guardar.'); }
    finally { setSaving(false); }
  };

  const eliminar = async (id) => {
    if (!window.confirm(`¿Eliminar este ${nombreSingular}?`)) return;
    try {
      await fetch(`${SIGA}/${endpoint}/${id}/`, { method: 'DELETE' });
      cargar();
    } catch {}
  };

  return (
    <div>
      {modal && (
        <Modal title={modal === 'create' ? `Agregar ${nombreSingular}` : `Editar ${nombreSingular}`} onClose={() => setModal(null)}>
          {error && <div style={{ margin: '12px 22px 0', background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>{error}</div>}
          <FormPersona titulo={nombreSingular} item={modal !== 'create' ? modal : null} onSave={guardar} onCancel={() => setModal(null)} saving={saving} />
        </Modal>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => { setError(''); setModal('create'); }}
          style={{ background: GREEN, border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 700 }}>
          + Agregar {nombreSingular}
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {cargando
          ? <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}><SpinnerIcon size={24} color="#aaa" /></div>
          : items.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>No hay {nombrePlural} registrados aún.</div>
            : <div style={{ overflowX: 'auto' }}>
                <table className="api-table">
                  <thead>
                    <tr><th>Cédula</th><th>Nombre</th><th>EPS</th>
                      <th style={{ textAlign: 'right' }}>Valor mensual</th>
                      <th>Fecha inicio</th><th>Estado</th><th>Observaciones</th><th></th></tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.cedula}</td>
                        <td style={{ fontWeight: 600, fontSize: 12 }}>{item.nombre}</td>
                        <td style={{ fontSize: 12 }}>{item.eps}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: GREEN }}>{fmtCOP(item.valor_mensual)}</td>
                        <td style={{ fontSize: 12 }}>{fmtFechaSolo(item.fecha_inicio)}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: item.activo ? '#e8f5e9' : '#f5f5f5', color: item.activo ? '#2e7d32' : '#757575' }}>
                            {item.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: '#888', maxWidth: 200 }}>{item.observaciones || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                          <button onClick={() => { setError(''); setModal(item); }}
                            style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#555', fontWeight: 600 }}>Editar</button>
                          <button onClick={() => eliminar(item.id)}
                            style={{ background: 'none', border: '1px solid #ffcdd2', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#c62828', fontWeight: 600 }}>Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </div>
    </div>
  );
}

/* ── TabPolitica ──────────────────────────────────────────────────────────── */
function TabPolitica() {
  const [politicas, setPoliticas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modoForm, setModoForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    porcentaje_empresa: '80', porcentaje_empleado: '20',
    uvt_limite: '16', valor_uvt: '49799',
    porcentaje_empresa_pensionado: '100',
    cod_conc_apoyo_no_grav: '', cod_conc_apoyo_grav: '',
    cod_conc_dcto_empleado: '', notas: '', vigente_desde: '',
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    try { const r = await fetch(`${SIGA}/politica/`); if (r.ok) setPoliticas(await r.json()); } catch {}
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirEditar = (p) => {
    setEditId(p.id);
    setForm({
      porcentaje_empresa: p.porcentaje_empresa || '80',
      porcentaje_empleado: p.porcentaje_empleado || '20',
      uvt_limite: p.uvt_limite || '16',
      valor_uvt: p.valor_uvt || '49799',
      porcentaje_empresa_pensionado: p.porcentaje_empresa_pensionado || '100',
      cod_conc_apoyo_no_grav: p.cod_conc_apoyo_no_grav || '',
      cod_conc_apoyo_grav: p.cod_conc_apoyo_grav || '',
      cod_conc_dcto_empleado: p.cod_conc_dcto_empleado || '',
      notas: p.notas || '',
      vigente_desde: p.vigente_desde || '',
    });
    setModoForm(true);
  };

  const guardar = async () => {
    setSaving(true); setError('');
    const url = editId ? `${SIGA}/politica/${editId}/` : `${SIGA}/politica/`;
    const method = editId ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (r.ok) { setModoForm(false); setEditId(null); cargar(); }
      else { const d = await r.json(); setError(d.error || JSON.stringify(d)); }
    } catch { setError('No se pudo guardar.'); }
    finally { setSaving(false); }
  };

  const limiteCalc = Number(form.uvt_limite || 0) * Number(form.valor_uvt || 0);

  const camposForm = [
    { key: 'porcentaje_empresa', label: '% Empresa', type: 'number', placeholder: '80' },
    { key: 'porcentaje_empleado', label: '% Empleado', type: 'number', placeholder: '20' },
    { key: 'uvt_limite', label: 'UVT límite', type: 'number', placeholder: '16' },
    { key: 'valor_uvt', label: 'Valor UVT ($)', type: 'number', placeholder: '49799' },
    { key: 'porcentaje_empresa_pensionado', label: '% Empresa pensionado', type: 'number', placeholder: '100' },
    { key: 'cod_conc_apoyo_no_grav', label: 'Cód. apoyo no gravable', type: 'text', placeholder: '' },
    { key: 'cod_conc_apoyo_grav', label: 'Cód. apoyo gravable', type: 'text', placeholder: '' },
    { key: 'cod_conc_dcto_empleado', label: 'Cód. dcto. empleado', type: 'text', placeholder: '' },
    { key: 'vigente_desde', label: 'Vigente desde', type: 'date', placeholder: '' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => { setEditId(null); setModoForm(true); setError(''); }}
          style={{ background: GREEN, border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 700 }}>
          + Nueva política
        </button>
      </div>

      {modoForm && (
        <div className="card" style={{ marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', fontWeight: 700, fontSize: 14, color: '#1a2e1a' }}>
            {editId ? 'Editar política' : 'Nueva política 80/20'}
          </div>
          {error && <div style={{ margin: '12px 22px 0', background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>{error}</div>}
          <div style={{ padding: '20px 22px' }}>
            <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#2e7d32', marginBottom: 16 }}>
              Límite calculado: <strong>{form.uvt_limite} UVT × {fmtCOP(form.valor_uvt)} = {fmtCOP(limiteCalc)}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              {camposForm.map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder}
                    style={{ width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Notas</label>
              <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
                style={{ width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModoForm(false)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer', color: '#555' }}>Cancelar</button>
              <button onClick={guardar} disabled={saving}
                style={{ background: GREEN, border: 'none', borderRadius: 8, padding: '8px 22px', fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 700 }}>
                {saving ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SpinnerIcon /> Guardando...</span> : 'Guardar política'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        {cargando
          ? <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}><SpinnerIcon size={24} color="#aaa" /></div>
          : politicas.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>No hay políticas configuradas. Cree la primera política 80/20.</div>
            : politicas.map(p => {
                const limite = Number(p.uvt_limite || 0) * Number(p.valor_uvt || 0);
                return (
                  <div key={p.id} style={{ borderBottom: '1px solid #f0f0f0', padding: '20px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {p.vigente && <span style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>Vigente</span>}
                        {p.vigente_desde && <span style={{ background: '#f3f0e8', color: '#5d4037', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>Desde {fmtFechaSolo(p.vigente_desde)}</span>}
                        <span style={{ background: '#f5f5f5', color: '#555', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>ID #{p.id}</span>
                      </div>
                      <button onClick={() => abrirEditar(p)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#555', fontWeight: 600 }}>Editar</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 12 }}>
                      {[
                        { label: 'Empresa', value: `${p.porcentaje_empresa}%`, color: GREEN },
                        { label: 'Empleado', value: `${p.porcentaje_empleado}%`, color: '#f57f17' },
                        { label: 'Límite UVT', value: `${p.uvt_limite} × ${fmtCOP(p.valor_uvt)}`, color: '#1565c0' },
                        { label: 'Límite calculado', value: fmtCOP(limite), color: '#6a1b9a' },
                      ].map(s => (
                        <div key={s.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 3 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Cód. no gravable', value: p.cod_conc_apoyo_no_grav },
                        { label: 'Cód. gravable', value: p.cod_conc_apoyo_grav },
                        { label: 'Cód. dcto. empleado', value: p.cod_conc_dcto_empleado },
                        { label: '% Pensionado', value: p.porcentaje_empresa_pensionado ? `${p.porcentaje_empresa_pensionado}%` : null },
                      ].filter(x => x.value).map(x => (
                        <span key={x.label} style={{ background: '#f0f4ff', color: '#3949ab', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6 }}>
                          {x.label}: <strong style={{ fontFamily: 'monospace' }}>{x.value}</strong>
                        </span>
                      ))}
                    </div>
                    {p.notas && <div style={{ marginTop: 10, fontSize: 12, color: '#888', fontStyle: 'italic' }}>{p.notas}</div>}
                  </div>
                );
              })
        }
      </div>
    </div>
  );
}

/* ── Página principal ─────────────────────────────────────────────────────── */
/* ── Submódulo: Beneficios de Salud ────────────────────────────────────── */
function BeneficiosSaludModule({ onBack }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [archivos, setArchivos]   = useState([]);
  const [loadingArchivos, setLoadingArchivos] = useState(true);

  const cargarArchivos = useCallback(async () => {
    setLoadingArchivos(true);
    try { const r = await fetch(`${SIGA}/archivos/`); if (r.ok) setArchivos(await r.json()); } catch {}
    finally { setLoadingArchivos(false); }
  }, []);

  useEffect(() => { cargarArchivos(); }, [cargarArchivos]);

  const totalArchivos  = archivos.length;
  const totalRegistros = archivos.reduce((s, a) => s + (a.total_registros || 0), 0);
  const proveedores    = [...new Set(archivos.map(a => a.proveedor).filter(p => p !== 'desconocido'))];

  const TABS = [
    { id: 'dashboard',   label: 'Dashboard',            icon: '📊' },
    { id: 'facturas',    label: 'Facturas EPS',          icon: '📁' },
    { id: 'planilla',    label: 'Planilla 80/20',        icon: '🧮' },
    { id: 'apoyo',       label: 'Apoyo Grav./No Grav.',  icon: '💰' },
    { id: 'causacion',   label: 'Causación',             icon: '📒' },
    { id: 'pensionados', label: 'Pensionados',           icon: '👴' },
    { id: 'auxilio',     label: 'Auxilio Externo',       icon: '🏥' },
    { id: 'politica',    label: 'Política 80/20',        icon: '⚙️' },
  ];

  return (
    <div className="page">
      {/* Migas de pan + banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          color: '#666', fontSize: 13, padding: '4px 0',
        }}>
          ← SIGA
        </button>
        <span style={{ color: '#ccc' }}>›</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>Beneficios de Salud</span>
      </div>

      <div className="banner" style={{ marginBottom: 24 }}>
        <div className="banner-text">
          <h1>Beneficios de Salud</h1>
          <p>Gestión de facturas EPS, planilla 80/20, causación contable, pensionados y auxilios externos.</p>
        </div>
        <div className="banner-stats">
          <div className="banner-stat">
            <div className="banner-stat-num">{totalArchivos}</div>
            <div className="banner-stat-label">Archivos</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">{totalRegistros.toLocaleString('es-CO')}</div>
            <div className="banner-stat-label">Registros</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">{proveedores.length}</div>
            <div className="banner-stat-label">Proveedores</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        borderBottom: '2px solid #f0f0f0', marginBottom: 24, paddingBottom: 0,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: active ? '#fff' : 'transparent',
              border: 'none',
              borderBottom: active ? `2px solid ${GREEN}` : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              color: active ? GREEN : '#666',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: -2,
              transition: 'color 0.15s',
            }}>
              <span style={{ fontSize: 14 }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'dashboard'   && <TabDashboard archivos={archivos} loading={loadingArchivos} cargarArchivos={cargarArchivos} />}
      {activeTab === 'facturas'    && <TabFacturasEPS archivos={archivos} loading={loadingArchivos} cargarArchivos={cargarArchivos} />}
      {activeTab === 'planilla'    && <TabPlanilla />}
      {activeTab === 'apoyo'       && <TabApoyoGravable />}
      {activeTab === 'causacion'   && <TabCausacion />}
      {activeTab === 'pensionados' && <TabPersonas endpoint="pensionados" nombreSingular="pensionado" nombrePlural="pensionados" />}
      {activeTab === 'auxilio'     && <TabPersonas endpoint="auxilio-externo" nombreSingular="auxilio externo" nombrePlural="auxilios externos" />}
      {activeTab === 'politica'    && <TabPolitica />}
    </div>
  );
}

/* ── Definición de submódulos SIGA ─────────────────────────────────────── */
const SUBMODULOS = [
  {
    id: 'beneficios-salud',
    nombre: 'Beneficios de Salud',
    descripcion: 'Gestión de medicina prepagada: facturas AXA y Colsanitas, planilla 80/20, clasificación gravable/no gravable y causación contable mensual.',
    icon: '🏥',
    iconBg: '#fce4ec',
    iconColor: '#880e4f',
    procesos: ['Facturas EPS', 'Planilla 80/20', 'Apoyo gravable', 'Causación', 'Pensionados'],
    estado: 'activo',
  },
  {
    id: 'vacaciones',
    nombre: 'Vacaciones',
    descripcion: 'Control y liquidación de vacaciones de empleados. Programación, aprobación y cálculo automático de días y valores.',
    icon: '🏖️',
    iconBg: '#e3f2fd',
    iconColor: '#1565c0',
    procesos: ['Programación', 'Aprobación', 'Liquidación'],
    estado: 'proximo',
  },
  {
    id: 'cesantias',
    nombre: 'Cesantías',
    descripcion: 'Cálculo y control de cesantías e intereses. Generación de archivos para consignación a fondos.',
    icon: '💼',
    iconBg: '#f3f0e8',
    iconColor: '#5d4037',
    procesos: ['Cálculo anual', 'Intereses', 'Consignación'],
    estado: 'proximo',
  },
  {
    id: 'nomina-efr',
    nombre: 'Nómina EFR',
    descripcion: 'Consolidado de indicadores EFR (Empresa Familiarmente Responsable) relacionados con nómina y beneficios sociales.',
    icon: '📋',
    iconBg: '#e8f5e9',
    iconColor: '#2e7d32',
    procesos: ['Indicadores EFR', 'Informe mensual', 'Consolidado'],
    estado: 'proximo',
  },
];

/* ── Landing page de SIGA ──────────────────────────────────────────────── */
function SigaLanding({ onEnter }) {
  const activos = SUBMODULOS.filter(s => s.estado === 'activo').length;
  const proximos = SUBMODULOS.filter(s => s.estado === 'proximo').length;

  return (
    <div className="page">
      <div className="banner">
        <div className="banner-text">
          <h1>SIGA · Sistema Inteligente de Gestión Administrativa</h1>
          <p>
            Módulos de automatización para el área de Talento Humano y Nómina. Centraliza la gestión
            de beneficios, obligaciones laborales e indicadores EFR de Finagro.
          </p>
        </div>
        <div className="banner-stats">
          <div className="banner-stat">
            <div className="banner-stat-num">{SUBMODULOS.length}</div>
            <div className="banner-stat-label">Submódulos</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">{activos}</div>
            <div className="banner-stat-label">Activos</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">{proximos}</div>
            <div className="banner-stat-label">En desarrollo</div>
          </div>
        </div>
      </div>

      <div className="section-header" style={{ marginTop: 8 }}>
        <div className="section-title">Submódulos disponibles</div>
      </div>

      <div className="modules-grid">
        {SUBMODULOS.map(sub => {
          const activo = sub.estado === 'activo';
          return (
            <div
              key={sub.id}
              className="module-card"
              style={{ opacity: activo ? 1 : 0.65, cursor: activo ? 'pointer' : 'default' }}
              onClick={() => activo && onEnter(sub.id)}
            >
              <div className="module-card-header">
                <div className="module-card-icon" style={{ background: sub.iconBg, color: sub.iconColor, fontSize: 26 }}>
                  {sub.icon}
                </div>
                <div>
                  <div className="module-card-name">{sub.nombre}</div>
                  <span style={{
                    display: 'inline-block', marginTop: 4,
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: activo ? '#e8f5e9' : '#f5f5f5',
                    color: activo ? '#2e7d32' : '#888',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {activo ? 'Activo' : 'Próximamente'}
                  </span>
                </div>
              </div>

              <div className="module-card-body">
                <div className="module-card-desc">{sub.descripcion}</div>
                <div className="module-card-processes">
                  {sub.procesos.map(p => (
                    <span key={p} style={{
                      display: 'inline-block', background: '#f5f5f5', color: '#555',
                      borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 500,
                    }}>{p}</span>
                  ))}
                </div>
              </div>

              <div className="module-card-footer">
                {activo ? (
                  <button className="btn-acceder" onClick={() => onEnter(sub.id)}>
                    Ingresar →
                  </button>
                ) : (
                  <span className="btn-acceder-disabled">En desarrollo</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Componente raíz ────────────────────────────────────────────────────── */
export default function SigaPage() {
  const [submodulo, setSubmodulo] = useState(null);

  if (submodulo === 'beneficios-salud') {
    return <BeneficiosSaludModule onBack={() => setSubmodulo(null)} />;
  }

  return <SigaLanding onEnter={setSubmodulo} />;
}
