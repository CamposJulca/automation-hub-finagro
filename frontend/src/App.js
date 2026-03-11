import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import './App.css';
import HomePage from './pages/HomePage';
import SarlaftPage from './pages/SarlaftPage';
import InnovacionPage from './InnovacionPage';
import FacturacionPage from './pages/FacturacionPage';

const PAGE_TITLES = {
  '/': 'Panel de Control · Automatizaciones',
  '/sarlaft': 'SARLAFT · Certificados Cámara de Comercio',
  '/innovacion': 'Innovación · Priorización de Necesidades',
  '/facturacion': 'Facturación Electrónica · DIAN',
};

const NAV_MAIN = [
  { icon: '⊞', label: 'Dashboard', to: '/' },
];

const NAV_MODULES = [
  { icon: '🔍', label: 'SARLAFT', to: '/sarlaft', status: 'activo' },
  { icon: '🧾', label: 'Facturación', to: '/facturacion', status: 'activo' },
  { icon: '💡', label: 'Innovación', to: '/innovacion', status: 'activo' },
];

function today() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function navClass({ isActive }) {
  return `nav-item${isActive ? ' active' : ''}`;
}

function Layout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'Automation Hub · Finagro';
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`layout${collapsed ? ' sidebar-collapsed' : ''}`}>

      {/* ── Sidebar ── */}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-badge">
            <div className="sidebar-logo-icon"><img src="/images/logo-finagro.png" alt="Finagro" style={{ width: 36, height: 36, objectFit: 'contain' }} /></div>
            {!collapsed && (
              <div className="sidebar-logo-text">
                <h2>Automation Hub</h2>
                <span>Finagro · 2026</span>
              </div>
            )}
          </div>
        </div>

        {!collapsed && <div className="sidebar-section-label">Navegación</div>}
        <nav className="sidebar-nav">
          {NAV_MAIN.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navClass} title={collapsed ? item.label : undefined}>
              <span className="nav-item-icon">{item.icon}</span>
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        {!collapsed && <div className="sidebar-section-label">Módulos</div>}
        {collapsed && <div className="sidebar-section-label" style={{ padding: '20px 0 8px', textAlign: 'center' }}>·</div>}
        <nav className="sidebar-nav">
          {NAV_MODULES.map(item => (
            <NavLink key={item.to} to={item.to} className={navClass} title={collapsed ? item.label : undefined}>
              <span className="nav-item-icon">{item.icon}</span>
              {!collapsed && item.label}
              {!collapsed && item.status === 'activo' && (
                <span style={{
                  marginLeft: 'auto', fontSize: 8, background: '#00853f',
                  color: '#fff', padding: '2px 6px', borderRadius: 8, letterSpacing: 0.5,
                }}>
                  ACTIVO
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <div className="sidebar-footer">
            Fondo para el Financiamiento<br />del Sector Agropecuario
          </div>
        )}

        {/* Botón colapsar */}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expandir sidebar' : 'Minimizar sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-right">
            <span className="topbar-date">{today()}</span>
            <span className="topbar-env">Producción</span>
          </div>
        </header>

        <Routes>
          <Route path="/"            element={<HomePage />} />
          <Route path="/sarlaft"     element={<SarlaftPage />} />
          <Route path="/facturacion" element={<FacturacionPage />} />
          <Route path="/innovacion"  element={<InnovacionPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
