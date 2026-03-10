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
];

const API_ENDPOINTS = [
  { method: 'GET',  url: '/api/executions/',           desc: 'Historial de ejecuciones' },
  { method: 'GET',  url: '/api/logs/',                 desc: 'Logs de ejecución' },
  { method: 'POST', url: '/api/sarlaft/certificados/', desc: 'Extraer certificados Cámara de Comercio' },
];

export default function HomePage() {
  const activeCount = MODULES.filter(m => m.status === 'activo').length;
  const devCount    = MODULES.filter(m => m.status === 'desarrollo').length;

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
          <div className="info-card-icon" style={{ background: '#fce4ec' }}>🔄</div>
          <div className="info-card-text">
            <strong>Fase 1</strong>
            <span>{devCount} módulos en desarrollo</span>
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
