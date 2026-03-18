import { Link } from 'react-router-dom';

const MODULES = [
  {
    id: 'sarlaft',
    name: 'SARLAFT',
    fullName: 'Sistema de Administración del Riesgo de LA/FT',
    icon: '🔍',
    iconBg: '#e8f2ec',
    description:
      'Extracción automática de datos de certificados de Cámara de Comercio para validación de listas restrictivas y análisis de riesgo de lavado de activos.',
    processes: ['Cruce de información', 'Listas restrictivas', 'Análisis de riesgo'],
    status: 'activo',
    route: '/sarlaft',
  },
  {
    id: 'facturacion',
    name: 'Facturación Electrónica',
    fullName: 'Gestión de Facturas Electrónicas DIAN',
    icon: '🧾',
    iconBg: '#e3f2fd',
    description:
      'Descarga, clasifica y extrae metadata de facturas electrónicas desde el buzón de correo de Finagro. Genera reportes consolidados para conciliación contable.',
    processes: ['Descarga automática', 'Clasificación XML', 'Exportar CSV'],
    status: 'activo',
    route: '/facturacion',
  },
  {
    id: 'icr',
    name: 'ICR',
    fullName: 'Incentivo a la Capitalización Rural',
    icon: '📊',
    iconBg: '#f3f0e8',
    description:
      'Gestiona el ciclo de vida completo de las inscripciones ICR: importación de operaciones AGROS, evaluación de reglas de elegibilidad por bolsa, preinscripción, formalización y auditoría.',
    processes: ['Importación AGROS', 'Evaluación de reglas', 'Formalización', 'Consecutivo'],
    status: 'activo',
    route: '/icr',
  },
  {
    id: 'siga',
    name: 'SIGA',
    fullName: 'Sistema Inteligente de Gestión Administrativa',
    icon: '🏥',
    iconBg: '#fce4ec',
    description:
      'Automatiza la recepción y procesamiento de archivos Excel de beneficios de salud enviados por proveedores (AXA Colpatria, Colsanitas). Normaliza, valida y consolida la información en una base única.',
    processes: ['Carga Excel', 'Detección proveedor', 'Normalización ETL', 'Trazabilidad'],
    status: 'activo',
    route: '/siga',
  },
];

const API_ENDPOINTS = [
  { method: 'GET',  url: '/api/executions/',              desc: 'Historial de ejecuciones' },
  { method: 'GET',  url: '/api/logs/',                    desc: 'Logs de ejecución' },
  { method: 'POST', url: '/api/sarlaft/certificados/',    desc: 'Extraer certificados Cámara de Comercio' },
  { method: 'POST', url: '/api/facturacion/descargar/',   desc: 'Descargar facturas desde buzón de correo' },
  { method: 'POST', url: '/api/facturacion/procesar/',    desc: 'Clasificar ZIPs y extraer metadata XML' },
  { method: 'GET',  url: '/api/facturacion/facturas/',    desc: 'Listar facturas procesadas' },
  { method: 'GET',  url: '/api/icr/contratos/',           desc: 'Listar contratos ICR' },
  { method: 'POST', url: '/api/icr/importar/',            desc: 'Importar operaciones AGROS (Excel/CSV)' },
  { method: 'POST', url: '/api/icr/preinscribir/',        desc: 'Evaluar reglas y preinscribir operaciones' },
  { method: 'POST', url: '/api/icr/formalizar/',          desc: 'Formalizar preinscripciones → inscrita' },
  { method: 'GET',  url: '/api/icr/inscripciones/',       desc: 'Listar inscripciones ICR con filtros' },
  { method: 'GET',  url: '/api/icr/stats/',               desc: 'KPIs y estadísticas del módulo ICR' },
  { method: 'POST', url: '/siga-api/beneficios-salud/upload/',    desc: 'SIGA · Cargar y procesar archivo Excel de proveedor' },
  { method: 'GET',  url: '/siga-api/beneficios-salud/archivos/',  desc: 'SIGA · Listar archivos de beneficios recibidos' },
  { method: 'GET',  url: '/siga-api/beneficios-salud/beneficios/', desc: 'SIGA · Consultar beneficios procesados' },
];

export default function HomePage() {
  const activeCount = MODULES.filter(m => m.status === 'activo').length;

  return (
    <div className="page">

      {/* Banner */}
      <div className="banner">
        <div className="banner-text">
          <h1>Plataforma de Automatización Institucional</h1>
          <p>
            Centraliza, ejecuta y monitorea los procesos automatizados de Finagro.
            Cada módulo integra tecnologías especializadas para optimizar la operación del sector agropecuario.
          </p>
        </div>
        <div className="banner-stats">
          <div className="banner-stat">
            <div className="banner-stat-num">{MODULES.length}</div>
            <div className="banner-stat-label">Módulos</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">{activeCount}</div>
            <div className="banner-stat-label">Activos</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">{API_ENDPOINTS.length}</div>
            <div className="banner-stat-label">Endpoints</div>
          </div>
        </div>
      </div>

      {/* Info row */}
      <div className="info-row">
        <div className="info-card">
          <div className="info-card-icon" style={{ background: '#e8f2ec' }}>🗄️</div>
          <div className="info-card-text">
            <strong>PostgreSQL</strong>
            <span>Base de datos · Activa</span>
          </div>
        </div>
        <div className="info-card">
          <div className="info-card-icon" style={{ background: '#fff8e1' }}>🤖</div>
          <div className="info-card-text">
            <strong>nlp-camara</strong>
            <span>Servicio NLP · Activo</span>
          </div>
        </div>
        <div className="info-card">
          <div className="info-card-icon" style={{ background: '#e3f2fd' }}>🧾</div>
          <div className="info-card-text">
            <strong>FactIA</strong>
            <span>Facturación DIAN · Activo</span>
          </div>
        </div>
        <div className="info-card">
          <div className="info-card-icon" style={{ background: '#fce4ec' }}>🏥</div>
          <div className="info-card-text">
            <strong>SIGA</strong>
            <span>Beneficios de Salud · Activo</span>
          </div>
        </div>
      </div>

      {/* Módulos */}
      <div className="section-header">
        <div className="section-title">Módulos de Automatización</div>
      </div>

      <div className="modules-grid">
        {MODULES.map((mod) => (
          <div className="module-card" key={mod.id}>
            <div className="module-card-header">
              <div className="module-card-icon" style={{ background: mod.iconBg }}>
                {mod.icon}
              </div>
              <span className={`badge badge-${mod.status}`}>
                {mod.status === 'activo' ? 'Activo' : 'En desarrollo'}
              </span>
            </div>

            <div className="module-card-body">
              <div className="module-card-name">{mod.name}</div>
              <div className="module-card-desc">{mod.description}</div>
              <div className="module-card-processes">
                {mod.processes.map((p) => (
                  <span className="process-tag" key={p}>{p}</span>
                ))}
              </div>
            </div>

            <div className="module-card-footer">
              <span style={{ fontSize: 11, color: 'var(--gris-texto)', fontStyle: 'italic' }}>
                {mod.fullName}
              </span>
              <Link to={mod.route} className="btn-acceder">
                Acceder →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Endpoints API */}
      <div className="section-header">
        <div className="section-title">Endpoints REST API</div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-header-title">Rutas disponibles · Backend API</span>
        </div>
        <table className="api-table">
          <thead>
            <tr>
              <th>Método</th>
              <th>Endpoint</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {API_ENDPOINTS.map((ep) => (
              <tr key={ep.url + ep.method}>
                <td>
                  <span className={`method-badge method-${ep.method.toLowerCase()}`}>
                    {ep.method}
                  </span>
                </td>
                <td><span className="endpoint-url">{ep.url}</span></td>
                <td>{ep.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
