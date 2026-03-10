export default function GestionAdministrativaPage() {
  return (
    <div className="page">
      <div className="banner">
        <div className="banner-text">
          <h1>Gestión Administrativa</h1>
          <p>
            Automatización de procesos administrativos internos. Generación de reportes,
            consolidación de datos y validación documental para optimizar la operación
            del sector agropecuario.
          </p>
        </div>
        <div className="banner-stats">
          <div className="banner-stat">
            <div className="banner-stat-num">🚧</div>
            <div className="banner-stat-label">En desarrollo</div>
          </div>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title">Funcionalidades planificadas</div>
      </div>

      <div className="modules-grid">
        {[
          { icon: '📊', title: 'Generación de reportes',    desc: 'Creación automática de informes ejecutivos y operativos a partir de fuentes de datos institucionales.' },
          { icon: '📂', title: 'Consolidación de datos',    desc: 'Integración y normalización de información proveniente de múltiples sistemas administrativos.' },
          { icon: '📋', title: 'Validación documental',     desc: 'Verificación de completitud, consistencia y cumplimiento de requisitos en documentos internos.' },
          { icon: '🔔', title: 'Alertas y notificaciones',  desc: 'Sistema de alertas automáticas para vencimientos, aprobaciones pendientes y eventos críticos.' },
        ].map(item => (
          <div className="module-card" key={item.title}>
            <div className="module-card-header">
              <div className="module-card-icon" style={{ background: '#fce4ec', fontSize: 28 }}>
                {item.icon}
              </div>
              <span className="badge badge-desarrollo">En desarrollo</span>
            </div>
            <div className="module-card-body">
              <div className="module-card-name">{item.title}</div>
              <div className="module-card-desc">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-header-title">Estado del módulo</span>
        </div>
        <div style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#555', marginBottom: 8 }}>
            Módulo en construcción
          </div>
          <div style={{ fontSize: 13, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
            El equipo de Innovación de Finagro está desarrollando este módulo.
            Estará disponible en la próxima fase del proyecto.
          </div>
        </div>
      </div>
    </div>
  );
}
