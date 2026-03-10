export default function FacturacionPage() {
  return (
    <div className="page">
      <div className="banner">
        <div className="banner-text">
          <h1>Facturación Electrónica · DIAN</h1>
          <p>
            Procesamiento, extracción de metadata y validación estructural de facturas
            electrónicas según la normativa DIAN. Optimiza el ciclo de vida de los
            documentos electrónicos de Finagro.
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
          { icon: '📥', title: 'Recepción de facturas',     desc: 'Ingesta automática de facturas XML desde el buzón DIAN y proveedores habilitados.' },
          { icon: '🔍', title: 'Extracción de metadata',    desc: 'Identificación y extracción de campos clave: CUFE, NIT, fecha, valor, impuestos.' },
          { icon: '✅', title: 'Validación estructural',    desc: 'Verificación de esquema XSD y reglas de negocio según normativa DIAN vigente.' },
          { icon: '📊', title: 'Reportes de conciliación', desc: 'Generación de reportes para conciliación contable y seguimiento de cartera.' },
        ].map(item => (
          <div className="module-card" key={item.title}>
            <div className="module-card-header">
              <div className="module-card-icon" style={{ background: '#fff8e1', fontSize: 28 }}>
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
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
