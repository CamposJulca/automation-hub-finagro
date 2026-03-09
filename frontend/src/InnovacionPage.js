import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const TIPO_OPTS = ['Operativo', 'Normativo', 'Estrategico'];
const RIESGO_OPTS = [
  { value: 1, label: 'Bajo' },
  { value: 2, label: 'Medio' },
  { value: 3, label: 'Alto' },
];

const EMPTY_FORM = {
  area: '',
  proceso_asociado: '',
  responsable: '',
  situacion_actual: '',
  preocupaciones: '',
  necesidad: '',
  tipo_objetivo: 'Operativo',
  recurrencia_mensual: '',
  duracion_horas: '',
  riesgo: 2,
};

function scoreBand(score) {
  if (score >= 0.70) return { label: 'Alta', color: '#c62828', bg: '#ffebee' };
  if (score >= 0.50) return { label: 'Media', color: '#e65100', bg: '#fff3e0' };
  return { label: 'Baja', color: '#2e7d32', bg: '#e8f5e9' };
}

export default function InnovacionPage() {
  const [necesidades, setNecesidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);

  const fetchNecesidades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/innovacion/`);
      const data = await res.json();
      setNecesidades(data);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNecesidades(); }, [fetchNecesidades]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/innovacion/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          recurrencia_mensual: parseInt(form.recurrencia_mensual, 10),
          duracion_horas: parseFloat(form.duracion_horas),
          riesgo: parseInt(form.riesgo, 10),
        }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      const data = await res.json();
      setNecesidades(data);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      setError('Error al registrar la necesidad. Verifica los datos.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta necesidad?')) return;
    await fetch(`${API_URL}/innovacion/${id}/`, { method: 'DELETE' });
    fetchNecesidades();
  };

  return (
    <div className="page">

      {/* Banner */}
      <div className="banner">
        <div className="banner-text">
          <h1>Gestión de Innovación</h1>
          <p>
            Registra las necesidades de las áreas de Finagro. El sistema las clasifica
            y prioriza automáticamente según recurrencia, duración, riesgo y tipo de proceso.
          </p>
        </div>
        <div className="banner-stats">
          <div className="banner-stat">
            <div className="banner-stat-num">{necesidades.length}</div>
            <div className="banner-stat-label">Necesidades</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">
              {necesidades.filter(n => scoreBand(n.puntuacion).label === 'Alta').length}
            </div>
            <div className="banner-stat-label">Prioridad Alta</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">
              {[...new Set(necesidades.map(n => n.area))].length}
            </div>
            <div className="banner-stat-label">Áreas</div>
          </div>
        </div>
      </div>

      {/* Sección header + botón */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div className="section-title">Ranking de Priorización</div>
        <button
          className="btn-acceder"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowForm(v => !v)}
        >
          {showForm ? '✕ Cancelar' : '+ Nueva necesidad'}
        </button>
      </div>

      {/* Fórmula info */}
      <div style={{
        background: '#f0f7f0', border: '1px solid #c8e0c8', borderRadius: 8,
        padding: '12px 18px', marginBottom: 20, fontSize: 12.5, color: '#2a4a2a',
        display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
      }}>
        <strong>Fórmula de priorización:</strong>
        <span>Recurrencia × 30%</span>
        <span>+ Duración × 25%</span>
        <span>+ Riesgo × 30%</span>
        <span>+ Tipo proceso × 15%</span>
        <span style={{ marginLeft: 'auto', color: '#555' }}>
          Operativo=3 · Normativo=2 · Estratégico=1
        </span>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-header-title">Registrar nueva necesidad</span>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>

              <label className="form-group">
                <span className="form-label">Área *</span>
                <input className="form-input" name="area" value={form.area}
                  onChange={handleChange} required placeholder="ej. Secretaría CNCA" />
              </label>

              <label className="form-group">
                <span className="form-label">Proceso asociado *</span>
                <input className="form-input" name="proceso_asociado" value={form.proceso_asociado}
                  onChange={handleChange} required placeholder="ej. Administración de Riesgos" />
              </label>

              <label className="form-group">
                <span className="form-label">Responsable *</span>
                <input className="form-input" name="responsable" value={form.responsable}
                  onChange={handleChange} required placeholder="Nombre completo" />
              </label>

              <label className="form-group">
                <span className="form-label">Tipo de objetivo *</span>
                <select className="form-input" name="tipo_objetivo" value={form.tipo_objetivo}
                  onChange={handleChange}>
                  {TIPO_OPTS.map(t => <option key={t}>{t}</option>)}
                </select>
              </label>

              <label className="form-group" style={{ gridColumn: '1 / -1' }}>
                <span className="form-label">Necesidad identificada *</span>
                <textarea className="form-input" name="necesidad" value={form.necesidad}
                  onChange={handleChange} required rows={2}
                  placeholder="Describe la necesidad o proceso a automatizar" />
              </label>

              <label className="form-group" style={{ gridColumn: '1 / -1' }}>
                <span className="form-label">Situación actual</span>
                <textarea className="form-input" name="situacion_actual" value={form.situacion_actual}
                  onChange={handleChange} rows={2}
                  placeholder="Describe el escenario o contexto actual" />
              </label>

              <label className="form-group" style={{ gridColumn: '1 / -1' }}>
                <span className="form-label">Preocupaciones</span>
                <textarea className="form-input" name="preocupaciones" value={form.preocupaciones}
                  onChange={handleChange} rows={2}
                  placeholder="Dolores o riesgos de la situación actual" />
              </label>

              <label className="form-group">
                <span className="form-label">Recurrencia mensual *</span>
                <input className="form-input" type="number" name="recurrencia_mensual"
                  value={form.recurrencia_mensual} onChange={handleChange} required
                  min={1} placeholder="veces / mes" />
              </label>

              <label className="form-group">
                <span className="form-label">Duración (horas) *</span>
                <input className="form-input" type="number" name="duracion_horas"
                  value={form.duracion_horas} onChange={handleChange} required
                  min={0.5} step={0.5} placeholder="horas por ejecución" />
              </label>

              <label className="form-group" style={{ gridColumn: '1 / -1' }}>
                <span className="form-label">Riesgo identificado *</span>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {RIESGO_OPTS.map(r => (
                    <label key={r.value} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      cursor: 'pointer', fontSize: 13,
                    }}>
                      <input type="radio" name="riesgo" value={r.value}
                        checked={parseInt(form.riesgo) === r.value}
                        onChange={handleChange} />
                      {r.label}
                    </label>
                  ))}
                </div>
              </label>

            </div>

            {error && (
              <div style={{ color: '#c62828', fontSize: 13, marginTop: 10 }}>{error}</div>
            )}

            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button type="submit" className="btn-acceder" disabled={submitting}
                style={{ cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Guardando...' : 'Registrar y priorizar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="btn-acceder-disabled">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla ranking */}
      {error && !showForm && (
        <div style={{ color: '#c62828', fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-header-title">
            Necesidades priorizadas · ordenadas por score
          </span>
          <span style={{ fontSize: 12, color: '#888' }}>
            {necesidades.length} registros
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#888', fontSize: 13 }}>
            Cargando...
          </div>
        ) : necesidades.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
            No hay necesidades registradas aún. Haz clic en "Nueva necesidad" para comenzar.
          </div>
        ) : (
          <table className="api-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Prioridad</th>
                <th>Score</th>
                <th>Área</th>
                <th>Necesidad</th>
                <th>Responsable</th>
                <th>Tipo</th>
                <th>Rec.</th>
                <th>Dur.</th>
                <th>Riesgo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {necesidades.map((n, i) => {
                const band = scoreBand(n.puntuacion);
                return (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 700, color: '#888', width: 36 }}>{i + 1}</td>
                    <td>
                      <span style={{
                        background: band.bg, color: band.color,
                        fontWeight: 700, fontSize: 11, padding: '3px 9px',
                        borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.4,
                      }}>
                        {band.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 90 }}>
                        <div style={{
                          height: 6, width: 60, background: '#eee', borderRadius: 3, overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', width: `${(n.puntuacion * 100).toFixed(0)}%`,
                            background: band.color, borderRadius: 3,
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: band.color }}>
                          {(n.puntuacion * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12.5, fontWeight: 600 }}>{n.area}</td>
                    <td style={{ fontSize: 12.5, maxWidth: 220 }}>
                      <span title={n.necesidad}>
                        {n.necesidad.length > 80 ? n.necesidad.slice(0, 80) + '…' : n.necesidad}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{n.responsable}</td>
                    <td>
                      <span style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
                        background: n.tipo_objetivo === 'Operativo' ? '#e3f2fd'
                          : n.tipo_objetivo === 'Normativo' ? '#fff8e1' : '#f3e5f5',
                        color: n.tipo_objetivo === 'Operativo' ? '#1565c0'
                          : n.tipo_objetivo === 'Normativo' ? '#e65100' : '#6a1b9a',
                      }}>
                        {n.tipo_objetivo}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 12.5 }}>{n.recurrencia_mensual}x</td>
                    <td style={{ textAlign: 'center', fontSize: 12.5 }}>{n.duracion_horas}h</td>
                    <td style={{ textAlign: 'center', fontSize: 12.5 }}>
                      {['', 'Bajo', 'Medio', 'Alto'][n.riesgo]}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(n.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#ccc', fontSize: 16, padding: '2px 6px',
                        }}
                        title="Eliminar"
                      >✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
