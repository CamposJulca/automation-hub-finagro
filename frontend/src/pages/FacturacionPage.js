import { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || '/api';

const AUTH_KEY = 'facturacion_auth';

function getBasicAuthHeader(user, pass) {
  return 'Basic ' + btoa(`${user}:${pass}`);
}

function LoginForm({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const header = getBasicAuthHeader(user, pass);
    try {
      const res = await fetch(`${API}/facturacion/facturas/`, {
        headers: { Authorization: header },
      });
      if (res.ok) {
        sessionStorage.setItem(AUTH_KEY, JSON.stringify({ user, pass }));
        onLogin(header);
      } else {
        setError('Credenciales incorrectas.');
      }
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="banner">
        <div className="banner-text">
          <h1>Facturación Electrónica · DIAN</h1>
          <p>Descarga, clasifica y extrae metadata de facturas electrónicas desde el buzón de Finagro.</p>
        </div>
      </div>
      <div style={{ maxWidth: 380, margin: '48px auto' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-header-title">Acceso al módulo</span>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              className="input"
              type="text"
              placeholder="Usuario"
              value={user}
              onChange={e => setUser(e.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Contraseña"
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
            />
            {error && <div style={{ color: '#e53935', fontSize: 13 }}>{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function FacturacionDashboard({ authHeader, onLogout }) {
  const [facturas, setFacturas] = useState([]);
  const [total, setTotal] = useState(0);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensajeDescarga, setMensajeDescarga] = useState(null);
  const [mensajeProceso, setMensajeProceso] = useState(null);
  const [error, setError] = useState(null);

  const cargarFacturas = useCallback(async () => {
    setLoadingFacturas(true);
    try {
      const res = await fetch(`${API}/facturacion/facturas/`, {
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      setFacturas(data.facturas || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError('Error cargando facturas.');
    } finally {
      setLoadingFacturas(false);
    }
  }, [authHeader, onLogout]);

  useEffect(() => { cargarFacturas(); }, [cargarFacturas]);

  const descargar = async () => {
    setDescargando(true);
    setMensajeDescarga(null);
    setError(null);
    try {
      const res = await fetch(`${API}/facturacion/descargar/`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      if (res.ok) {
        setMensajeDescarga(`Descarga completada. Mensajes en histórico: ${data.mensajes_procesados ?? 0}`);
      } else {
        setError(data.error || 'Error en la descarga.');
      }
    } catch (e) {
      setError('Error al conectar con el servicio.');
    } finally {
      setDescargando(false);
    }
  };

  const procesar = async () => {
    setProcesando(true);
    setMensajeProceso(null);
    setError(null);
    try {
      const res = await fetch(`${API}/facturacion/procesar/`, {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      if (res.ok) {
        setMensajeProceso(`Procesamiento completado. Facturas extraídas: ${data.total ?? 0} | Errores: ${data.errores ?? 0}`);
        await cargarFacturas();
      } else {
        setError(data.error || 'Error en el procesamiento.');
      }
    } catch (e) {
      setError('Error al conectar con el servicio.');
    } finally {
      setProcesando(false);
    }
  };

  const exportarCSV = () => {
    if (!facturas.length) return;
    const headers = ['NIT Proveedor', 'Número Factura', 'Código', 'Valor Factura', 'IVA', 'Fecha Emisión', 'Fecha Vencimiento', 'Observaciones'];
    const rows = facturas.map(f => [
      f.proveedor_nit, f.numero_factura, f.codigo,
      f.valor_factura, f.iva_facturado_proveedor,
      f.fecha_emision, f.fecha_vencimiento, f.observaciones,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="banner">
        <div className="banner-text">
          <h1>Facturación Electrónica · DIAN</h1>
          <p>Descarga y extrae metadata de facturas electrónicas desde el buzón de Finagro.</p>
        </div>
        <div className="banner-stats">
          <div className="banner-stat">
            <div className="banner-stat-num">{total}</div>
            <div className="banner-stat-label">Facturas en BD</div>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="section-header">
        <div className="section-title">Pipeline de procesamiento</div>
        <button
          className="btn btn-outline"
          style={{ fontSize: 13 }}
          onClick={onLogout}
        >
          Cerrar sesión
        </button>
      </div>

      <div className="modules-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {/* Paso 1 */}
        <div className="card">
          <div className="card-header">
            <span className="card-header-title">Paso 1 — Descargar del correo</span>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
              Conecta con el buzón <strong>facturacion@finagro.com.co</strong> vía Microsoft Graph
              y descarga los ZIPs de facturas electrónicas.
            </p>
            <button
              className="btn btn-primary"
              onClick={descargar}
              disabled={descargando || procesando}
            >
              {descargando ? 'Descargando... (puede tardar varios minutos)' : 'Descargar del correo'}
            </button>
            {mensajeDescarga && (
              <div style={{ fontSize: 13, color: '#2e7d32', background: '#e8f5e9', padding: '8px 12px', borderRadius: 6 }}>
                {mensajeDescarga}
              </div>
            )}
          </div>
        </div>

        {/* Paso 2 */}
        <div className="card">
          <div className="card-header">
            <span className="card-header-title">Paso 2 — Clasificar y extraer metadata</span>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
              Clasifica los ZIPs por tipo de documento y extrae los campos clave de
              cada factura XML (NIT, número, valor, IVA, fechas).
            </p>
            <button
              className="btn btn-primary"
              onClick={procesar}
              disabled={descargando || procesando}
            >
              {procesando ? 'Procesando...' : 'Clasificar y extraer metadata'}
            </button>
            {mensajeProceso && (
              <div style={{ fontSize: 13, color: '#2e7d32', background: '#e8f5e9', padding: '8px 12px', borderRadius: 6 }}>
                {mensajeProceso}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ margin: '12px 0', padding: '12px 16px', background: '#ffebee', color: '#c62828', borderRadius: 6, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Tabla de facturas */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <div className="section-title">Facturas extraídas ({total})</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={cargarFacturas} disabled={loadingFacturas} style={{ fontSize: 13 }}>
            {loadingFacturas ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button className="btn btn-outline" onClick={exportarCSV} disabled={!facturas.length} style={{ fontSize: 13 }}>
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="card">
        {loadingFacturas ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>Cargando facturas...</div>
        ) : facturas.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
            <div style={{ fontWeight: 700, color: '#555', marginBottom: 6 }}>Sin facturas aún</div>
            <div style={{ fontSize: 13 }}>Ejecuta el pipeline para descargar y procesar facturas.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {['NIT Proveedor', 'Número Factura', 'Código', 'Valor', 'IVA', 'F. Emisión', 'F. Vencimiento'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e0e0e0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {facturas.map((f, i) => (
                  <tr key={f.id || i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '9px 12px' }}>{f.proveedor_nit}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>{f.numero_factura}</td>
                    <td style={{ padding: '9px 12px', color: '#888' }}>{f.codigo || '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      {f.valor_factura ? `$${Number(f.valor_factura).toLocaleString('es-CO')}` : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      {f.iva_facturado_proveedor ? `$${Number(f.iva_facturado_proveedor).toLocaleString('es-CO')}` : '—'}
                    </td>
                    <td style={{ padding: '9px 12px' }}>{f.fecha_emision || '—'}</td>
                    <td style={{ padding: '9px 12px' }}>{f.fecha_vencimiento || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FacturacionPage() {
  const [authHeader, setAuthHeader] = useState(() => {
    const saved = sessionStorage.getItem(AUTH_KEY);
    if (!saved) return null;
    const { user, pass } = JSON.parse(saved);
    return getBasicAuthHeader(user, pass);
  });

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthHeader(null);
  };

  if (!authHeader) {
    return <LoginForm onLogin={setAuthHeader} />;
  }

  return <FacturacionDashboard authHeader={authHeader} onLogout={handleLogout} />;
}
