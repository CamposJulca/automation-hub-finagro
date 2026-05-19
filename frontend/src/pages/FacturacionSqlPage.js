import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || '/api';
const AUTH_KEY = 'facturacion_auth';

/* ── Catálogo de queries listas ───────────────────────────────────────── */
const CATALOGO = [
  {
    id: 'total_rango',
    nombre: 'Validar Total facturas en rango',
    descripcion: 'Cuenta facturas cuya fecha de emisión está dentro del rango. Equivalente al KPI "Total facturas".',
    sql: ({ desde, hasta }) =>
`SELECT COUNT(*) AS total_facturas
FROM facturacion_facturaelectronica
WHERE fecha_emision BETWEEN '${desde}' AND '${hasta}'`,
    params: [
      { name: 'desde', label: 'Desde', tipo: 'date', def: '2026-01-01' },
      { name: 'hasta', label: 'Hasta', tipo: 'date', def: '2026-12-31' },
    ],
  },
  {
    id: 'valor_total_rango',
    nombre: 'Validar Valor total facturado',
    descripcion: 'Suma valor_factura en el rango. Equivalente al KPI "Valor total".',
    sql: ({ desde, hasta }) =>
`SELECT
  COUNT(*)              AS facturas,
  SUM(valor_factura)    AS valor_total,
  AVG(valor_factura)    AS valor_promedio
FROM facturacion_facturaelectronica
WHERE fecha_emision BETWEEN '${desde}' AND '${hasta}'`,
    params: [
      { name: 'desde', label: 'Desde', tipo: 'date', def: '2026-01-01' },
      { name: 'hasta', label: 'Hasta', tipo: 'date', def: '2026-12-31' },
    ],
  },
  {
    id: 'top_proveedores',
    nombre: 'Top 10 proveedores por valor',
    descripcion: 'NITs que más han facturado a Finagro.',
    sql: () =>
`SELECT
  proveedor_nit,
  COUNT(*)              AS facturas,
  SUM(valor_factura)    AS total_facturado
FROM facturacion_facturaelectronica
GROUP BY proveedor_nit
ORDER BY total_facturado DESC NULLS LAST
LIMIT 10`,
    params: [],
  },
  {
    id: 'sin_fecha',
    nombre: 'Facturas sin fecha de emisión',
    descripcion: 'Facturas con fecha_emision NULL. Equivalente al KPI "Sin fecha emisión".',
    sql: () =>
`SELECT id, proveedor_nit, numero_factura, valor_factura, archivo, procesado_en
FROM facturacion_facturaelectronica
WHERE fecha_emision IS NULL
ORDER BY procesado_en DESC
LIMIT 50`,
    params: [],
  },
  {
    id: 'por_mes',
    nombre: 'Facturas y valor por mes',
    descripcion: 'Agrupa por mes de emisión. Equivalente a la sección "Valor por mes".',
    sql: () =>
`SELECT
  TO_CHAR(fecha_emision, 'YYYY-MM') AS mes,
  COUNT(*)                          AS facturas,
  SUM(valor_factura)                AS valor_total
FROM facturacion_facturaelectronica
WHERE fecha_emision IS NOT NULL
GROUP BY mes
ORDER BY mes DESC`,
    params: [],
  },
  {
    id: 'por_tipo',
    nombre: 'Distribución por tipo de documento',
    descripcion: 'Cuántas facturas, notas crédito, débito, etc.',
    sql: () =>
`SELECT
  tipo_documento,
  COUNT(*)              AS cantidad,
  SUM(valor_factura)    AS valor_total
FROM facturacion_facturaelectronica
GROUP BY tipo_documento
ORDER BY cantidad DESC`,
    params: [],
  },
  {
    id: 'duplicados',
    nombre: 'Duplicados (mismo NIT + número)',
    descripcion: 'Detecta posibles duplicados en la BD.',
    sql: () =>
`SELECT proveedor_nit, numero_factura, COUNT(*) AS copias
FROM facturacion_facturaelectronica
GROUP BY proveedor_nit, numero_factura
HAVING COUNT(*) > 1
ORDER BY copias DESC
LIMIT 20`,
    params: [],
  },
  {
    id: 'ultimas_corridas',
    nombre: 'Últimas corridas del pipeline',
    descripcion: 'Detalle de las últimas Executions del módulo facturación.',
    sql: () =>
`SELECT
  e.id,
  e.status,
  e.start_time,
  e.end_time,
  a.name           AS automation,
  COUNT(f.id)      AS facturas_creadas
FROM execution_execution e
JOIN automation_automation a ON a.id = e.automation_id
LEFT JOIN facturacion_facturaelectronica f ON f.execution_id = e.id
WHERE a.module = 'facturacion'
GROUP BY e.id, a.name
ORDER BY e.start_time DESC
LIMIT 10`,
    params: [],
  },
  {
    id: 'logs_recientes',
    nombre: 'Últimos logs del pipeline',
    descripcion: 'Mensajes recientes registrados por el pipeline (errores, warnings, info).',
    sql: () =>
`SELECT l.created_at, l.level, l.message, e.id AS execution_id
FROM logs_executionlog l
JOIN execution_execution e ON e.id = l.execution_id
ORDER BY l.created_at DESC
LIMIT 50`,
    params: [],
  },
];

/* ── Diagrama ER en sintaxis mermaid ──────────────────────────────────── */
const SCHEMA_MERMAID = `
erDiagram
  AUTOMATION ||--o{ EXECUTION : "ejecuta"
  EXECUTION ||--o{ FACTURA : "produce"
  EXECUTION ||--o{ LOG : "registra"
  USER ||--o{ EXECUTION : "dispara"

  AUTOMATION {
    int id PK
    string module
    string name
    text description
  }
  EXECUTION {
    int id PK
    int automation_id FK
    string status
    datetime start_time
    datetime end_time
    int triggered_by FK
  }
  FACTURA {
    int id PK
    int execution_id FK
    string tipo_documento
    string proveedor_nit
    string numero_factura
    decimal valor_factura
    date fecha_emision
    date fecha_vencimiento
    datetime procesado_en
  }
  LOG {
    int id PK
    int execution_id FK
    string level
    text message
    datetime created_at
  }
  USER {
    int id PK
    string username
  }
`;

/* ── Login (idéntico al de FacturacionPage para reutilizar el flujo) ──── */
function getBasicAuthHeader(u, p) {
  return 'Basic ' + btoa(`${u}:${p}`);
}

function LoginForm({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const auth = getBasicAuthHeader(user, pass);
    try {
      const res = await fetch(`${API}/facturacion/sql/schema/`, { headers: { Authorization: auth } });
      if (!res.ok) { setErr('Usuario o contraseña inválidos.'); return; }
      localStorage.setItem(AUTH_KEY, auth);
      onLogin(auth);
    } catch { setErr('No se pudo conectar.'); }
  };
  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 360, margin: '60px auto', padding: '28px 32px' }}>
      <h2 style={{ marginTop: 0, marginBottom: 18, color: '#1565c0' }}>Acceso al módulo</h2>
      <input className="input" placeholder="Usuario" value={user} onChange={e => setUser(e.target.value)} style={{ marginBottom: 10, width: '100%' }} />
      <input className="input" type="password" placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} style={{ marginBottom: 10, width: '100%' }} />
      {err && <div style={{ color: '#d32f2f', fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <button className="btn btn-primary" style={{ width: '100%' }}>Entrar</button>
    </form>
  );
}

/* ── Componente del diagrama ER ───────────────────────────────────────── */
function ErDiagram() {
  const ref = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const m = (await import('mermaid')).default;
        m.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', er: { useMaxWidth: true } });
        const { svg } = await m.render('er-diagram-' + Date.now(), SCHEMA_MERMAID);
        if (!cancel && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancel) setError(String(e));
      }
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <div className="card" style={{ padding: '18px 22px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
        🔗 Esquema de tablas relacionadas con facturación
      </div>
      {error ? (
        <div style={{ color: '#d32f2f', fontSize: 13 }}>No se pudo cargar el diagrama: {error}</div>
      ) : (
        <div ref={ref} style={{ overflow: 'auto', textAlign: 'center', minHeight: 200 }}>
          <div style={{ color: '#888', fontSize: 12, padding: '40px 0' }}>Cargando diagrama...</div>
        </div>
      )}
      <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
        Las consultas libres solo pueden leer tablas con prefijo <code>facturacion_</code>, <code>execution_</code>, <code>automation_</code> o <code>logs_</code>. La tabla <code>auth_user</code> aparece en el diagrama solo como referencia y está bloqueada para queries.
      </div>
    </div>
  );
}

/* ── Tarjeta de query del catálogo ────────────────────────────────────── */
function QueryCard({ q, onRun }) {
  const [params, setParams] = useState(() =>
    Object.fromEntries(q.params.map(p => [p.name, p.def]))
  );
  const sql = q.sql(params);
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 700, color: '#1565c0', fontSize: 14 }}>{q.nombre}</div>
      <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>{q.descripcion}</div>
      {q.params.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {q.params.map(p => (
            <label key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#555' }}>
              {p.label}
              <input
                type={p.tipo}
                value={params[p.name]}
                onChange={e => setParams(s => ({ ...s, [p.name]: e.target.value }))}
                style={{ fontSize: 12, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }}
              />
            </label>
          ))}
        </div>
      )}
      <pre style={{
        background: '#f8f9fa', border: '1px solid #eceff1', borderRadius: 6,
        padding: '10px 12px', fontSize: 11, lineHeight: 1.4, color: '#37474f',
        maxHeight: 140, overflow: 'auto', margin: 0,
      }}>{sql}</pre>
      <button
        type="button"
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start', fontSize: 12, padding: '6px 14px' }}
        onClick={() => onRun(sql)}
      >▶ Ejecutar</button>
    </div>
  );
}

/* ── Tabla de resultados ──────────────────────────────────────────────── */
function ResultTable({ result }) {
  if (!result) return null;
  if (result.error) {
    return (
      <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #d32f2f', background: '#fff5f5' }}>
        <div style={{ fontWeight: 700, color: '#d32f2f', marginBottom: 4 }}>Error</div>
        <div style={{ fontSize: 13, color: '#37474f', whiteSpace: 'pre-wrap' }}>{result.error}</div>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <div style={{
        fontSize: 12, color: '#666', marginBottom: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
      }}>
        <span>
          <strong style={{ color: '#1565c0' }}>{result.count}</strong> filas · {result.took_ms} ms
          {result.limited && <span style={{ marginLeft: 8, color: '#e65100' }}>(limitado a 500)</span>}
        </span>
        <button
          type="button"
          className="btn btn-outline"
          style={{ fontSize: 11, padding: '4px 10px' }}
          onClick={() => {
            const csv = [
              result.columns.join(','),
              ...result.rows.map(r => r.map(v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`).join(',')),
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `query_${Date.now()}.csv`;
            a.click();
          }}
          disabled={!result.rows.length}
        >↓ CSV</button>
      </div>
      <div style={{ overflow: 'auto', maxHeight: 460, border: '1px solid #eceff1', borderRadius: 6 }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f5f7fa', position: 'sticky', top: 0 }}>
            <tr>
              {result.columns.map((c, i) => (
                <th key={i} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #eceff1', fontWeight: 700, color: '#37474f' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #f0f3f5', background: ri % 2 ? '#fafbfc' : '#fff' }}>
                {row.map((v, ci) => (
                  <td key={ci} style={{
                    padding: '6px 12px',
                    fontFamily: typeof v === 'number' ? 'monospace' : 'inherit',
                    color: v == null ? '#bbb' : '#37474f',
                    whiteSpace: 'nowrap',
                  }}>{v == null ? 'null' : String(v)}</td>
                ))}
              </tr>
            ))}
            {result.rows.length === 0 && (
              <tr><td colSpan={result.columns.length || 1} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Sin filas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Página principal ──────────────────────────────────────────────────── */
function SqlDashboard({ authHeader, onLogout }) {
  const [advanced,  setAdvanced]  = useState(false);
  const [sqlLibre,  setSqlLibre]  = useState('SELECT proveedor_nit, COUNT(*) AS facturas\nFROM facturacion_facturaelectronica\nGROUP BY proveedor_nit\nORDER BY facturas DESC\nLIMIT 10');
  const [running,   setRunning]   = useState(false);
  const [result,    setResult]    = useState(null);
  const navigate = useNavigate();

  const ejecutar = useCallback(async (sql) => {
    setRunning(true); setResult(null);
    try {
      const res = await fetch(`${API}/facturacion/sql/run/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body:    JSON.stringify({ query: sql }),
      });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      setResult(res.ok ? data : { error: data.error || 'Error desconocido' });
    } catch (e) {
      setResult({ error: 'Error de red: ' + e.message });
    } finally {
      setRunning(false);
    }
  }, [authHeader, onLogout]);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button className="btn btn-outline" onClick={() => navigate('/facturacion')} style={{ fontSize: 12 }}>← Volver a Facturación</button>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1565c0' }}>SQL Console · Facturación</h1>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-outline" onClick={onLogout} style={{ fontSize: 12 }}>Cerrar sesión</button>
        </div>
      </div>

      <div style={{
        background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8,
        padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#5d4037',
      }}>
        <strong>Solo lectura.</strong> Las consultas se ejecutan con <code>SET TRANSACTION READ ONLY</code> y <code>statement_timeout = 10s</code>. Solo se admiten <code>SELECT</code> sobre tablas del módulo facturación. Se aplica <code>LIMIT 500</code> automáticamente si la consulta no lo trae.
      </div>

      <div style={{ marginBottom: 24 }}><ErDiagram /></div>

      <div className="section-header" style={{ marginBottom: 12 }}>
        <div className="section-title">Consultas listas</div>
        <div style={{ fontSize: 11, color: '#888' }}>Útiles para validar los KPIs del dashboard</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14, marginBottom: 24 }}>
        {CATALOGO.map(q => <QueryCard key={q.id} q={q} onRun={ejecutar} />)}
      </div>

      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: advanced ? 12 : 0 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#37474f' }}>Modo avanzado</div>
            <div style={{ fontSize: 11, color: '#888' }}>Escribir SQL libre. Mismas restricciones aplican.</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={advanced} onChange={e => setAdvanced(e.target.checked)} />
            Activar
          </label>
        </div>
        {advanced && (
          <>
            <textarea
              value={sqlLibre}
              onChange={e => setSqlLibre(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 140, fontFamily: 'monospace', fontSize: 13,
                padding: 12, border: '1px solid #cfd8dc', borderRadius: 6,
                resize: 'vertical', color: '#37474f', background: '#f8f9fa',
              }}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '6px 14px' }}
                onClick={() => ejecutar(sqlLibre)}
                disabled={running || !sqlLibre.trim()}
              >▶ Ejecutar</button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: 12, padding: '6px 14px' }}
                onClick={() => setSqlLibre('')}
                disabled={!sqlLibre}
              >Limpiar</button>
            </div>
          </>
        )}
      </div>

      {running && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 16, color: '#888', fontSize: 13 }}>
          Ejecutando consulta...
        </div>
      )}

      {result && <ResultTable result={result} />}
    </div>
  );
}

export default function FacturacionSqlPage() {
  const [authHeader, setAuthHeader] = useState(() => localStorage.getItem(AUTH_KEY));
  if (!authHeader) {
    return <LoginForm onLogin={setAuthHeader} />;
  }
  return (
    <SqlDashboard
      authHeader={authHeader}
      onLogout={() => { localStorage.removeItem(AUTH_KEY); setAuthHeader(null); }}
    />
  );
}
