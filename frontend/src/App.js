import { useState } from 'react';
import './App.css';
import InnovacionPage from './InnovacionPage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

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
    url: process.env.REACT_APP_NLP_URL || 'http://localhost:8001',
    urlLabel: 'Abrir servicio NLP',
  },
  {
    id: 'facturacion',
    name: 'Facturación Electrónica',
    fullName: 'Gestión de facturación electrónica DIAN',
    icon: '🧾',
    iconBg: '#fff8e1',
    description:
      'Procesamiento, extracción de metadata y validación estructural de facturas electrónicas según normativa DIAN.',
    processes: ['Procesamiento de facturas', 'Extracción metadata', 'Validación DIAN'],
    status: 'desarrollo',
    url: null,
    urlLabel: null,
  },
  {
    id: 'mesa_ayuda',
    name: 'Mesa de Ayuda',
    fullName: 'Optimización de soporte institucional',
    icon: '🎧',
    iconBg: '#e8eaf6',
    description:
      'Clasificación automática, priorización inteligente y análisis de incidencias para optimizar la gestión de tickets de soporte.',
    processes: ['Clasificación de tickets', 'Priorización automática', 'Análisis de incidencias'],
    status: 'desarrollo',
    url: null,
    urlLabel: null,
  },
  {
    id: 'gestion_administrativa',
    name: 'Gestión Administrativa',
    fullName: 'Automatización de procesos administrativos',
    icon: '📋',
    iconBg: '#fce4ec',
    description:
      'Generación de reportes, consolidación de datos y validación documental para optimizar procesos administrativos internos.',
    processes: ['Generación de reportes', 'Consolidación de datos', 'Validación documental'],
    status: 'desarrollo',
    url: null,
    urlLabel: null,
  },
];

const API_ENDPOINTS = [
  { method: 'GET',  url: `${API_URL}/automations/`,         desc: 'Catálogo de automatizaciones' },
  { method: 'POST', url: `${API_URL}/automations/`,         desc: 'Registrar nueva automatización' },
  { method: 'GET',  url: `${API_URL}/executions/`,          desc: 'Historial de ejecuciones' },
  { method: 'POST', url: `${API_URL}/executions/`,          desc: 'Crear ejecución manual' },
  { method: 'GET',  url: `${API_URL}/logs/`,                desc: 'Logs de ejecución' },
  { method: 'POST', url: `${API_URL}/sarlaft/certificados/`,desc: 'Extraer certificados Cámara de Comercio' },
];

const NAV_ITEMS = [
  { icon: '⊞', label: 'Dashboard' },
  { icon: '💡', label: 'Innovación' },
  { icon: '⚙', label: 'Automatizaciones' },
  { icon: '▶', label: 'Ejecuciones' },
  { icon: '📄', label: 'Logs' },
  { icon: '👥', label: 'Usuarios' },
  { icon: '⚙', label: 'Configuración' },
];

function today() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function App() {
  const [activePage, setActivePage] = useState('Dashboard');
  const activeCount = MODULES.filter(m => m.status === 'activo').length;
  const devCount    = MODULES.filter(m => m.status === 'desarrollo').length;

  const pageTitles = {
    'Dashboard': 'Panel de Control · Automatizaciones',
    'Innovación': 'Gestión de Innovación · Priorización',
  };

  return (
    <div className="layout">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-badge">
            <div className="sidebar-logo-icon">🌿</div>
            <div className="sidebar-logo-text">
              <h2>Automation Hub</h2>
              <span>Finagro · 2026</span>
            </div>
          </div>
        </div>

        <div className="sidebar-section-label">Navegación</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${activePage === item.label ? 'active' : ''}`}
              onClick={() => setActivePage(item.label)}
            >
              <span className="nav-item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          Fondo para el Financiamiento<br />del Sector Agropecuario
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">

        {/* Topbar */}
        <header className="topbar">
          <span className="topbar-title">
            {pageTitles[activePage] || `${activePage}`}
          </span>
          <div className="topbar-right">
            <span className="topbar-date">{today()}</span>
            <span className="topbar-env">Desarrollo</span>
          </div>
        </header>

        {/* Innovación */}
        {activePage === 'Innovación' && <InnovacionPage />}

        {/* Contenido Dashboard */}
        {activePage !== 'Innovación' && <div className="page">

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
                <span>Servicio NLP · Puerto 8001</span>
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
                  {mod.url ? (
                    <a
                      className="btn-acceder"
                      href={mod.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {mod.urlLabel} →
                    </a>
                  ) : (
                    <button className="btn-acceder-disabled" disabled>
                      Próximamente
                    </button>
                  )}
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
              <span className="card-header-title">Rutas disponibles · {API_URL}</span>
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

        </div>}
      </div>
    </div>
  );
}
