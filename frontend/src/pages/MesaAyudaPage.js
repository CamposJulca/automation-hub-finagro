export default function MesaAyudaPage() {
  return (
    <div className="page">
      <div className="banner">
        <div className="banner-text">
          <h1>Mesa de Ayuda · Soporte Institucional</h1>
          <p>
            Clasificación automática, priorización inteligente y análisis de incidencias
            para optimizar la gestión de tickets de soporte y mejorar los tiempos de
            respuesta al usuario final.
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
          { icon: '🎯', title: 'Clasificación automática',  desc: 'Categorización inteligente de tickets por tipo, área responsable y nivel de urgencia usando NLP.' },
          { icon: '⚡', title: 'Priorización dinámica',     desc: 'Asignación automática de prioridades basada en impacto, SLA y carga del equipo de soporte.' },
          { icon: '📈', title: 'Análisis de incidencias',   desc: 'Identificación de patrones recurrentes y generación de reportes de tendencias para mejora continua.' },
          { icon: '🤖', title: 'Respuestas automáticas',    desc: 'Sugerencia de soluciones a problemas frecuentes mediante base de conocimiento institucional.' },
        ].map(item => (
          <div className="module-card" key={item.title}>
            <div className="module-card-header">
              <div className="module-card-icon" style={{ background: '#e8eaf6', fontSize: 28 }}>
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎧</div>
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
