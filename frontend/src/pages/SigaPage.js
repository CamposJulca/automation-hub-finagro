import { useState, useEffect, useCallback, useRef } from 'react';

const SIGA = '/siga-api/beneficios-salud';

function fmtFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

/* ── Detalle de archivo ──────────────────────────────────────────────────── */
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
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1a2e1a' }}>{archivo.nombre_archivo}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{fmtFecha(archivo.fecha_recepcion)} · {archivo.usuario_carga}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999', padding: '4px 8px' }}>✕</button>
        </div>

        {/* Stats */}
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

        {/* Badges */}
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

        {/* Errores */}
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

/* ── Upload zone ─────────────────────────────────────────────────────────── */
function UploadZone({ onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);

    const form = new FormData();
    form.append('archivo', file);

    try {
      const res = await fetch(`${SIGA}/upload/`, { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setFile(null);
        onUploaded();
      } else {
        setError(data.error || `Error ${res.status}`);
      }
    } catch (e) {
      setError('No se pudo conectar con SIGA. Verifique que el servicio esté activo.');
    } finally {
      setUploading(false);
    }
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
        {/* Drop zone */}
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
            <>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 700, color: '#2e7d32', fontSize: 14 }}>{file.name}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB · Listo para procesar</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
              <div style={{ fontWeight: 600, color: '#555', fontSize: 14 }}>Arrastra el archivo aquí o haz clic para seleccionar</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Formatos soportados: .xlsx (AXA Colpatria) · .xls (Colsanitas)</div>
            </>
          )}
        </div>

        {error && (
          <div style={{ background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            ⚠️ {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={upload}
          disabled={!file || uploading}
          style={{ width: '100%', fontWeight: 700, fontSize: 14, padding: '11px', background: '#880e4f', borderColor: '#880e4f' }}
        >
          {uploading
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><SpinnerIcon /> Procesando archivo...</span>
            : '⚙️ Procesar archivo'}
        </button>

        {/* Resultado */}
        {result && (
          <div style={{ marginTop: 20, background: result.registros_con_error > 0 ? '#fffde7' : '#e8f5e9', borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontWeight: 800, color: result.registros_con_error > 0 ? '#f57f17' : '#2e7d32', fontSize: 14, marginBottom: 12 }}>
              {result.registros_con_error > 0 ? '⚠️ Procesado con advertencias' : '✅ Procesado correctamente'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Total registros',  value: result.total_registros,       color: '#1565c0' },
                { label: 'Procesados',        value: result.registros_procesados,  color: '#2e7d32' },
                { label: 'Con error',         value: result.registros_con_error,   color: result.registros_con_error > 0 ? '#c62828' : '#aaa' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#888', textAlign: 'center' }}>
              Proveedor detectado: <strong>{PROVEEDOR_LABEL[result.proveedor] || result.proveedor}</strong>
              {result.archivo_id && <> · ID #{result.archivo_id}</>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Descarga Excel helper ───────────────────────────────────────────────── */
async function descargarExcel(url, nombreSugerido) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = nombreSugerido || 'SIGA_Beneficios.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
  } catch (e) {
    alert('No se pudo descargar el archivo Excel.');
  }
}

/* ── Tabla de historial ──────────────────────────────────────────────────── */
function TablaArchivos({ archivos, loading, onDetalle }) {
  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#aaa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <SpinnerIcon size={24} color="#aaa" /> <span>Cargando historial...</span>
      </div>
    );
  }

  if (archivos.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#aaa' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏥</div>
        <div style={{ fontWeight: 700, color: '#555', marginBottom: 6, fontSize: 15 }}>Sin archivos cargados</div>
        <div style={{ fontSize: 13 }}>Carga el primer archivo de AXA Colpatria o Colsanitas para comenzar.</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="api-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Archivo</th>
            <th>Proveedor</th>
            <th>Fecha recepción</th>
            <th style={{ textAlign: 'center' }}>Total</th>
            <th style={{ textAlign: 'center' }}>Procesados</th>
            <th style={{ textAlign: 'center' }}>Errores</th>
            <th>Estado</th>
            <th></th>
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
                <td>
                  <span style={{ ...pv, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>
                    {PROVEEDOR_LABEL[a.proveedor] || a.proveedor}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: '#666' }}>{fmtFecha(a.fecha_recepcion)}</td>
                <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#1565c0' }}>{a.total_registros}</td>
                <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#2e7d32' }}>{a.registros_procesados}</td>
                <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: a.registros_con_error > 0 ? '#c62828' : '#aaa' }}>
                  {a.registros_con_error}
                </td>
                <td>
                  <span style={{ ...ev, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>
                    {a.estado_procesamiento}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onDetalle(a)}
                    style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#555', fontWeight: 600 }}
                  >
                    Ver detalle →
                  </button>
                  <button
                    onClick={() => descargarExcel(`${SIGA}/exportar/?archivo_id=${a.id}`, `SIGA_Beneficios_${a.id}.xlsx`)}
                    style={{ background: 'none', border: '1px solid #a5d6a7', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#2e7d32', fontWeight: 600 }}
                    title="Exportar este archivo a Excel"
                  >
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

/* ── Página principal ────────────────────────────────────────────────────── */
export default function SigaPage() {
  const [archivos, setArchivos]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [detalleArchivo, setDetalle] = useState(null);

  // Feature: buscar por funcionario
  const [cedulaBusqueda, setCedulaBusqueda] = useState('');
  const [resultados, setResultados]         = useState([]);
  const [buscando, setBuscando]             = useState(false);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);

  // Feature: novedades entre períodos
  const [archivoNuevo, setArchivoNuevo]       = useState('');
  const [archivoAnterior, setArchivoAnterior] = useState('');
  const [novedades, setNovedades]             = useState(null);
  const [comparando, setComparando]           = useState(false);
  const [novedadesError, setNovedadesError]   = useState('');

  // Tablas colapsables novedades
  const [mostrarNuevos, setMostrarNuevos]           = useState(true);
  const [mostrarRetirados, setMostrarRetirados]     = useState(true);
  const [mostrarCambios, setMostrarCambios]         = useState(true);

  const cargarArchivos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SIGA}/archivos/`);
      if (res.ok) setArchivos(await res.json());
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  const buscarFuncionario = async (e) => {
    e.preventDefault();
    if (!cedulaBusqueda.trim()) return;
    setBuscando(true);
    setBusquedaRealizada(false);
    setResultados([]);
    try {
      const res = await fetch(`${SIGA}/beneficios/?cedula=${encodeURIComponent(cedulaBusqueda.trim())}`);
      if (res.ok) setResultados(await res.json());
    } catch { /* silencioso */ }
    finally { setBuscando(false); setBusquedaRealizada(true); }
  };

  const compararNovedades = async () => {
    if (!archivoNuevo || !archivoAnterior) return;
    setComparando(true);
    setNovedades(null);
    setNovedadesError('');
    try {
      const res = await fetch(`${SIGA}/novedades/?archivo_nuevo=${archivoNuevo}&archivo_anterior=${archivoAnterior}`);
      const data = await res.json();
      if (res.ok) {
        setNovedades(data);
      } else {
        setNovedadesError(data.error || `Error ${res.status}`);
      }
    } catch {
      setNovedadesError('No se pudo conectar con SIGA.');
    } finally {
      setComparando(false);
    }
  };

  const [dash, setDash] = useState(null);
  const cargarDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${SIGA}/dashboard/`);
      if (res.ok) setDash(await res.json());
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { cargarArchivos(); cargarDashboard(); }, [cargarArchivos, cargarDashboard]);

  // KPIs derivados
  const totalArchivos    = archivos.length;
  const totalRegistros   = archivos.reduce((s, a) => s + (a.total_registros || 0), 0);
  const totalErrores     = archivos.reduce((s, a) => s + (a.registros_con_error || 0), 0);
  const proveedores      = [...new Set(archivos.map(a => a.proveedor).filter(p => p !== 'desconocido'))];

  return (
    <div className="page">

      {/* Modal detalle */}
      {detalleArchivo && (
        <DetalleModal archivo={detalleArchivo} onClose={() => setDetalle(null)} />
      )}

      {/* Banner */}
      <div className="banner" style={{ marginBottom: 24 }}>
        <div className="banner-text">
          <h1>SIGA · Beneficios de Salud</h1>
          <p>
            Automatiza la recepción, procesamiento y almacenamiento de los archivos de beneficios de salud
            enviados por AXA Colpatria y Colsanitas. Detecta el proveedor, normaliza al modelo unificado y valida cada registro.
          </p>
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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: '📁', label: 'Archivos recibidos', value: totalArchivos,                      bg: '#e3f2fd', color: '#1565c0' },
          { icon: '👥', label: 'Beneficiarios',       value: totalRegistros.toLocaleString('es-CO'), bg: '#e8f5e9', color: '#2e7d32' },
          { icon: '⚠️', label: 'Con error',            value: totalErrores,                      bg: '#ffebee', color: totalErrores > 0 ? '#c62828' : '#aaa' },
          { icon: '🏢', label: 'Proveedores activos', value: proveedores.length,                 bg: '#fce4ec', color: '#880e4f' },
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

      {/* ── Dashboard visual ── */}
      {dash && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-header" style={{ marginBottom: 12 }}>
            <div className="section-title">Resumen del último período</div>
            <button className="btn btn-outline" onClick={cargarDashboard} style={{ fontSize: 11 }}>↺</button>
          </div>

          {/* Tarjetas por proveedor */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${dash.ultimos_periodos.length || 1}, 1fr)`, gap: 16, marginBottom: 20 }}>
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
                    <span style={{ background: color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                      Contrato {p.numero_contrato}
                    </span>
                  </div>
                  <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color }}>{p.total_beneficiarios.toLocaleString('es-CO')}</div>
                      <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Beneficiarios</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#1a2e1a' }}>
                        ${(p.valor_total / 1_000_000).toFixed(1)}M
                      </div>
                      <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Valor total</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: p.registros_con_error > 0 ? '#c62828' : '#2e7d32' }}>
                        {p.registros_procesados}/{p.total_beneficiarios}
                      </div>
                      <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Procesados OK</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{p.fecha_procesamiento}</div>
                      <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Fecha carga</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Distribución por parentesco + valor por proveedor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Parentesco */}
            <div className="card" style={{ margin: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: 13, color: '#333' }}>
                Distribución por parentesco
                <span style={{ fontSize: 11, fontWeight: 400, color: '#999', marginLeft: 8 }}>último período</span>
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

            {/* Valor por proveedor */}
            <div className="card" style={{ margin: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: 13, color: '#333' }}>
                Valor facturado por proveedor
                <span style={{ fontSize: 11, fontWeight: 400, color: '#999', marginLeft: 8 }}>último período</span>
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

                {/* Total consolidado */}
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#333', fontSize: 13 }}>Total período</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: '#1a2e1a' }}>
                    ${(dash.consolidado.valor_total_ultimo_periodo / 1_000_000).toFixed(2)}M
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload + Proveedores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, marginBottom: 28 }}>
        <UploadZone onUploaded={cargarArchivos} />

        {/* Info proveedores */}
        <div className="card" style={{ margin: 0, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #fafafa 0%, #f0f4ff 100%)', padding: '16px 22px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ fontWeight: 700, color: '#333', fontSize: 14 }}>Proveedores soportados</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Detección automática por nombre y columnas</div>
          </div>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              {
                nombre: 'AXA Colpatria',
                icono: '🔵',
                formato: '.xlsx',
                patron: 'AXACOLPATRIA*.xlsx',
                columnas: ['SUB CTO', 'NUMID', 'NOMBRE', 'PARENTESCO', 'SUBTOTAL', 'IVA', 'TOTAL'],
                nota: 'Encabezados en fila ~10. Sin descuento comercial separado.',
                color: '#1565c0',
                bg: '#e3f2fd',
              },
              {
                nombre: 'Colsanitas',
                icono: '🔴',
                formato: '.xls',
                patron: 'COLSANITAS*.xls',
                columnas: ['Número de Familia', 'Número de Documento', 'Apellidos', 'Nombres', 'Cuota', 'Descuento Comercial', 'IVA', 'Total Us'],
                nota: 'Encabezados en fila ~12. Filtra filas TOTAL FAMILIA X.',
                color: '#880e4f',
                bg: '#fce4ec',
              },
            ].map(p => (
              <div key={p.nombre} style={{ border: `1px solid ${p.bg}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: p.bg, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{p.icono}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: p.color, fontSize: 13 }}>{p.nombre}</div>
                    <div style={{ fontSize: 10, color: p.color, opacity: 0.8 }}>{p.patron}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', background: p.color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{p.formato}</span>
                </div>
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {p.columnas.map(c => (
                      <span key={c} style={{ background: '#f5f5f5', color: '#555', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>{c}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>{p.nota}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="section-header">
        <div className="section-title">Historial de archivos procesados ({totalArchivos})</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-outline"
            onClick={() => descargarExcel(`${SIGA}/exportar/`, 'SIGA_Beneficios_Consolidado.xlsx')}
            style={{ fontSize: 12, color: '#2e7d32', borderColor: '#a5d6a7' }}
          >
            ⬇ Exportar Excel
          </button>
          <button className="btn btn-outline" onClick={cargarArchivos} disabled={loading} style={{ fontSize: 12 }}>
            {loading ? 'Actualizando...' : '↺ Actualizar'}
          </button>
        </div>
      </div>

      <div className="card">
        <TablaArchivos archivos={archivos} loading={loading} onDetalle={setDetalle} />
      </div>

      {/* ── Buscar por funcionario ── */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <div className="section-title">Consulta por funcionario</div>
      </div>
      <div className="card" style={{ marginBottom: 28 }}>
        <form onSubmit={buscarFuncionario} style={{ padding: '18px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="text"
            value={cedulaBusqueda}
            onChange={e => setCedulaBusqueda(e.target.value)}
            placeholder="Ingrese número de cédula..."
            style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={buscando || !cedulaBusqueda.trim()}
            style={{ background: '#880e4f', borderColor: '#880e4f', fontWeight: 700, fontSize: 13, padding: '8px 20px' }}
          >
            {buscando ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SpinnerIcon /> Buscando...</span> : 'Buscar'}
          </button>
        </form>

        {busquedaRealizada && (
          <div>
            {resultados.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                No se encontraron registros para esa cédula.
              </div>
            ) : (
              <>
                <div style={{ padding: '10px 22px 6px', fontSize: 11, color: '#888', borderBottom: '1px solid #f5f5f5' }}>
                  {resultados.length} registro{resultados.length !== 1 ? 's' : ''} encontrado{resultados.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                  Total valor: <strong style={{ color: '#2e7d32' }}>{fmtCOP(resultados.reduce((s, r) => s + (Number(r.valor_total) || 0), 0))}</strong>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="api-table">
                    <thead>
                      <tr>
                        <th>Cédula</th>
                        <th>Nombre</th>
                        <th>Parentesco</th>
                        <th>Proveedor</th>
                        <th>Período</th>
                        <th style={{ textAlign: 'right' }}>Valor base</th>
                        <th style={{ textAlign: 'right' }}>IVA</th>
                        <th style={{ textAlign: 'right' }}>Valor total</th>
                        <th>Estado</th>
                      </tr>
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
                            <td>
                              <span style={{ ...pv, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                                {PROVEEDOR_LABEL[r.proveedor] || r.proveedor}
                              </span>
                            </td>
                            <td style={{ fontSize: 12 }}>{r.periodo_facturacion || '—'}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(r.valor_base)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(r.iva)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#1565c0' }}>{fmtCOP(r.valor_total)}</td>
                            <td>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                background: esAdv ? '#fff9c4' : '#e8f5e9',
                                color: esAdv ? '#f57f17' : '#2e7d32',
                              }}>
                                {r.estado_validacion || '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Novedades ── */}
      <div className="section-header">
        <div className="section-title">Novedades entre períodos</div>
      </div>
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Archivo nuevo</label>
            <select
              value={archivoNuevo}
              onChange={e => setArchivoNuevo(e.target.value)}
              style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}
            >
              <option value="">-- Seleccionar --</option>
              {archivos.filter(a => a.estado_procesamiento === 'PROCESADO').map(a => (
                <option key={a.id} value={a.id}>#{a.id} · {a.proveedor.toUpperCase()} · {a.periodo_facturacion || a.nombre_archivo}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Archivo anterior</label>
            <select
              value={archivoAnterior}
              onChange={e => setArchivoAnterior(e.target.value)}
              style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}
            >
              <option value="">-- Seleccionar --</option>
              {archivos.filter(a => a.estado_procesamiento === 'PROCESADO').map(a => (
                <option key={a.id} value={a.id}>#{a.id} · {a.proveedor.toUpperCase()} · {a.periodo_facturacion || a.nombre_archivo}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={compararNovedades}
            disabled={comparando || !archivoNuevo || !archivoAnterior}
            style={{ background: '#1565c0', borderColor: '#1565c0', fontWeight: 700, fontSize: 13, padding: '8px 24px' }}
          >
            {comparando ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SpinnerIcon /> Comparando...</span> : 'Comparar'}
          </button>
        </div>

        {novedadesError && (
          <div style={{ margin: '16px 22px', background: '#ffebee', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 12.5 }}>
            {novedadesError}
          </div>
        )}

        {novedades && (
          <div style={{ padding: '20px 22px' }}>
            {novedades.warning && (
              <div style={{ background: '#fff8e1', color: '#f57f17', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>
                ⚠ {novedades.warning}
              </div>
            )}

            {/* Info archivos comparados */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Archivo nuevo', data: novedades.archivo_nuevo, color: '#1565c0', bg: '#e3f2fd' },
                { label: 'Archivo anterior', data: novedades.archivo_anterior, color: '#6a1b9a', bg: '#f3e5f5' },
              ].map(({ label, data, color, bg }) => (
                <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2e1a' }}>#{data.id} · {data.nombre_archivo}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{data.proveedor?.toUpperCase()} · {data.periodo_facturacion || '—'}</div>
                </div>
              ))}
            </div>

            {/* Resumen cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Nuevos',          value: novedades.resumen.nuevos,        color: '#2e7d32', bg: '#e8f5e9' },
                { label: 'Retirados',       value: novedades.resumen.retirados,     color: '#c62828', bg: '#ffebee' },
                { label: 'Cambios de valor',value: novedades.resumen.cambios_valor, color: '#f57f17', bg: '#fff8e1' },
                { label: 'Sin cambios',     value: novedades.resumen.sin_cambios,   color: '#555',    bg: '#f5f5f5' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tabla Nuevos */}
            {novedades.nuevos.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={() => setMostrarNuevos(v => !v)}
                  style={{ background: '#e8f5e9', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#2e7d32', cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {mostrarNuevos ? '▾' : '▸'} Nuevos afiliados ({novedades.nuevos.length})
                </button>
                {mostrarNuevos && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="api-table">
                      <thead><tr><th>Cédula</th><th>Nombre</th><th>Parentesco</th><th style={{ textAlign: 'right' }}>Valor total</th></tr></thead>
                      <tbody>
                        {novedades.nuevos.map((r, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.cedula}</td>
                            <td style={{ fontSize: 12 }}>{r.nombre}</td>
                            <td style={{ fontSize: 12 }}>{r.parentesco || '—'}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#2e7d32', fontWeight: 700, fontSize: 12 }}>{fmtCOP(r.valor_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tabla Retirados */}
            {novedades.retirados.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={() => setMostrarRetirados(v => !v)}
                  style={{ background: '#ffebee', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#c62828', cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {mostrarRetirados ? '▾' : '▸'} Retirados ({novedades.retirados.length})
                </button>
                {mostrarRetirados && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="api-table">
                      <thead><tr><th>Cédula</th><th>Nombre</th><th>Parentesco</th><th style={{ textAlign: 'right' }}>Último valor</th></tr></thead>
                      <tbody>
                        {novedades.retirados.map((r, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.cedula}</td>
                            <td style={{ fontSize: 12 }}>{r.nombre}</td>
                            <td style={{ fontSize: 12 }}>{r.parentesco || '—'}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#c62828', fontWeight: 700, fontSize: 12 }}>{fmtCOP(r.valor_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tabla Cambios de valor */}
            {novedades.cambios_valor.length > 0 && (
              <div>
                <button
                  onClick={() => setMostrarCambios(v => !v)}
                  style={{ background: '#fff8e1', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#f57f17', cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {mostrarCambios ? '▾' : '▸'} Cambios de valor ({novedades.cambios_valor.length})
                </button>
                {mostrarCambios && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="api-table">
                      <thead>
                        <tr>
                          <th>Cédula</th>
                          <th>Nombre</th>
                          <th>Parentesco</th>
                          <th style={{ textAlign: 'right' }}>Valor anterior</th>
                          <th style={{ textAlign: 'right' }}>Valor nuevo</th>
                          <th style={{ textAlign: 'right' }}>Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {novedades.cambios_valor.map((r, i) => {
                          const dif = Number(r.diferencia);
                          return (
                            <tr key={i}>
                              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.cedula}</td>
                              <td style={{ fontSize: 12 }}>{r.nombre}</td>
                              <td style={{ fontSize: 12 }}>{r.parentesco || '—'}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(r.valor_anterior)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{fmtCOP(r.valor_nuevo)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: dif > 0 ? '#c62828' : '#2e7d32' }}>
                                {dif > 0 ? '+' : ''}{fmtCOP(dif)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
