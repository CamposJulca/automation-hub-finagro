import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const TIPO_OPTS = ['Operativo', 'Normativo', 'Estrategico'];
const RIESGO_OPTS = [
  { value: 1, label: 'Bajo' },
  { value: 2, label: 'Medio' },
  { value: 3, label: 'Alto' },
];
const EMPTY_FORM = {
  area: '', proceso_asociado: '', responsable: '',
  situacion_actual: '', preocupaciones: '', necesidad: '',
  tipo_objetivo: 'Operativo', recurrencia_mensual: '', duracion_horas: '', riesgo: 2,
};

const TIPO_STYLE = {
  Operativo:   { bg: '#e3f2fd', color: '#1565c0' },
  Normativo:   { bg: '#fff8e1', color: '#e65100' },
  Estrategico: { bg: '#f3e5f5', color: '#6a1b9a' },
};

function scoreBand(s) {
  if (s >= 0.70) return { label: 'Alta',  color: '#c62828', bg: '#ffebee' };
  if (s >= 0.50) return { label: 'Media', color: '#e65100', bg: '#fff3e0' };
  return               { label: 'Baja',  color: '#2e7d32', bg: '#e8f5e9' };
}

/* ── KPI card ─────────────────────────────────────────────── */
function KpiCard({ icon, value, label, accent }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--gris-borde)',
      borderRadius: 12, padding: '20px 22px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: 'var(--sombra-card)', flex: 1,
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 11,
        background: accent + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#1a2e1a', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--gris-texto)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/* ── Ranking horizontal bars ──────────────────────────────── */
function RankingChart({ necesidades }) {
  const sorted = [...necesidades].sort((a, b) => b.puntuacion - a.puntuacion);
  if (!sorted.length) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: '#bbb', fontSize: 13 }}>
      Sin necesidades registradas
    </div>
  );
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {sorted.map((n, i) => {
        const band = scoreBand(n.puntuacion);
        const pct  = (n.puntuacion * 100).toFixed(1);
        const ts   = TIPO_STYLE[n.tipo_objetivo] || {};
        const etiq = n.necesidad.length > 55 ? n.necesidad.slice(0, 55) + '…' : n.necesidad;
        return (
          <div key={n.id}>
            {/* fila superior */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: band.bg, color: band.color,
                  fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, color: '#1a2e1a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {etiq}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                <span style={{
                  background: band.bg, color: band.color,
                  fontSize: 10, fontWeight: 800, padding: '2px 8px',
                  borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.4,
                }}>
                  {band.label}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: band.color, minWidth: 48, textAlign: 'right' }}>
                  {pct}%
                </span>
              </div>
            </div>
            {/* barra */}
            <div style={{ height: 12, background: '#f0f4f1', borderRadius: 6, overflow: 'hidden', marginBottom: 7 }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: `linear-gradient(90deg, ${band.color}99, ${band.color})`,
                borderRadius: 6, transition: 'width 0.7s cubic-bezier(.4,0,.2,1)',
              }} />
            </div>
            {/* meta */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, color: '#888', alignItems: 'center' }}>
              {n.area && <span style={{ fontWeight: 600, color: '#555' }}>{n.area}</span>}
              {n.area && <span>·</span>}
              <span style={{ ...ts, padding: '1px 7px', borderRadius: 4, fontWeight: 600, fontSize: 10.5 }}>
                {n.tipo_objetivo}
              </span>
              <span>·</span>
              <span>Rec: <strong>{n.recurrencia_mensual}×</strong></span>
              <span>·</span>
              <span>Dur: <strong>{n.duracion_horas}h</strong></span>
              <span>·</span>
              <span>Riesgo: <strong>{['', 'Bajo', 'Medio', 'Alto'][n.riesgo]}</strong></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Mini distribución ────────────────────────────────────── */
function MiniDist({ title, items }) {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
        {title}
      </div>
      {items.map(it => (
        <div key={it.label} style={{ marginBottom: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#2a3a2a' }}>{it.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: it.color }}>{it.count}</span>
          </div>
          <div style={{ height: 7, background: '#f0f4f1', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: max ? `${(it.count / max) * 100}%` : '0%',
              background: it.color,
              borderRadius: 4,
              transition: 'width 0.7s cubic-bezier(.4,0,.2,1)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Componente principal ─────────────────────────────────── */
export default function InnovacionPage() {
  const [necesidades, setNecesidades] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [importing,   setImporting]   = useState(false);
  const [importMsg,   setImportMsg]   = useState(null);
  const [showForm,    setShowForm]    = useState(false);
  const [showTable,   setShowTable]   = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [editId,      setEditId]      = useState(null);   // null = crear, number = editar
  const [error,       setError]       = useState(null);

  const fetchNecesidades = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/innovacion/`);
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
    const payload = {
      ...form,
      recurrencia_mensual: parseInt(form.recurrencia_mensual, 10),
      duracion_horas:      parseFloat(form.duracion_horas),
      riesgo:              parseInt(form.riesgo, 10),
    };
    try {
      const url    = editId ? `${API_URL}/innovacion/${editId}/` : `${API_URL}/innovacion/`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setForm(EMPTY_FORM);
      setEditId(null);
      setShowForm(false);
      fetchNecesidades();
    } catch {
      setError('Error al guardar. Verifica los datos.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (n) => {
    setForm({
      area:                n.area,
      proceso_asociado:    n.proceso_asociado,
      responsable:         n.responsable,
      situacion_actual:    n.situacion_actual,
      preocupaciones:      n.preocupaciones,
      necesidad:           n.necesidad,
      tipo_objetivo:       n.tipo_objetivo,
      recurrencia_mensual: n.recurrencia_mensual,
      duracion_horas:      n.duracion_horas,
      riesgo:              n.riesgo,
    });
    setEditId(n.id);
    setShowForm(true);
    setShowTable(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta necesidad?')) return;
    await fetch(`${API_URL}/innovacion/${id}/`, { method: 'DELETE' });
    fetchNecesidades();
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    const fd = new FormData();
    fd.append('archivo', file);
    try {
      const res  = await fetch(`${API_URL}/innovacion/importar/`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar.');
      setNecesidades(data.necesidades);
      setImportMsg({
        type: 'ok',
        text: `${data.creados} necesidad(es) importada(s) correctamente.` +
              (data.errores.length ? ` (${data.errores.length} filas omitidas)` : ''),
      });
    } catch (err) {
      setImportMsg({ type: 'err', text: err.message });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleExport = () => {
    window.open(`${API_URL}/innovacion/exportar/`, '_blank');
  };

  /* ── Métricas derivadas ── */
  const total      = necesidades.length;
  const alta       = necesidades.filter(n => scoreBand(n.puntuacion).label === 'Alta').length;
  const media      = necesidades.filter(n => scoreBand(n.puntuacion).label === 'Media').length;
  const baja       = necesidades.filter(n => scoreBand(n.puntuacion).label === 'Baja').length;
  const avgScore   = total ? (necesidades.reduce((s, n) => s + n.puntuacion, 0) / total * 100).toFixed(1) : '—';
  const areas      = [...new Set(necesidades.map(n => n.area).filter(Boolean))].length;

  const distTipo = [
    { label: 'Normativo',   color: '#e65100', count: necesidades.filter(n => n.tipo_objetivo === 'Normativo').length },
    { label: 'Operativo',   color: '#1565c0', count: necesidades.filter(n => n.tipo_objetivo === 'Operativo').length },
    { label: 'Estratégico', color: '#6a1b9a', count: necesidades.filter(n => n.tipo_objetivo === 'Estrategico').length },
  ];
  const distRiesgo = [
    { label: 'Alto',  color: '#c62828', count: necesidades.filter(n => n.riesgo === 3).length },
    { label: 'Medio', color: '#e65100', count: necesidades.filter(n => n.riesgo === 2).length },
    { label: 'Bajo',  color: '#2e7d32', count: necesidades.filter(n => n.riesgo === 1).length },
  ];
  const distPrioridad = [
    { label: 'Alta',  color: '#c62828', count: alta },
    { label: 'Media', color: '#e65100', count: media },
    { label: 'Baja',  color: '#2e7d32', count: baja },
  ];

  return (
    <div className="page">

      {/* ── Banner ── */}
      <div className="banner">
        <div className="banner-text">
          <h1>Gestión de Innovación</h1>
          <p>
            Priorización automática de necesidades según recurrencia, duración, riesgo y tipo de proceso.
          </p>
        </div>
        <div className="banner-stats">
          <div className="banner-stat">
            <div className="banner-stat-num">{total}</div>
            <div className="banner-stat-label">Necesidades</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">{alta}</div>
            <div className="banner-stat-label">Prioridad Alta</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">{areas}</div>
            <div className="banner-stat-label">Áreas</div>
          </div>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <KpiCard icon="📋" value={total}         label="Total necesidades"    accent="#006633" />
        <KpiCard icon="🔴" value={alta}           label="Prioridad alta"       accent="#c62828" />
        <KpiCard icon="📊" value={loading ? '…' : `${avgScore}%`} label="Score promedio" accent="#c9a227" />
        <KpiCard icon="🏢" value={areas}          label="Áreas involucradas"   accent="#1565c0" />
      </div>

      {/* ── Fórmula ── */}
      <div style={{
        background: '#f0f7f0', border: '1px solid #c8e0c8',
        borderRadius: 8, padding: '11px 18px', marginBottom: 20,
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 12,
      }}>
        <strong style={{ color: '#2a4a2a' }}>Fórmula:</strong>
        {[['Recurrencia','30%'],['Duración','25%'],['Riesgo','30%'],['Tipo proceso','15%']].map(([name, w], i) => (
          <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ color: '#aaa' }}>+</span>}
            <span style={{
              background: '#fff', border: '1px solid #c8e0c8',
              borderRadius: 5, padding: '3px 9px', color: '#2a4a2a',
            }}>
              <strong>{name}</strong> × {w}
            </span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: '#666', fontSize: 11 }}>
          Normativo = 3 · Operativo = 2 · Estratégico = 1
        </span>
      </div>

      {/* ── Dashboard principal ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, marginBottom: 24 }}>

        {/* Ranking chart */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <span className="card-header-title">Ranking de Priorización</span>
            <span style={{ fontSize: 11.5, color: '#888' }}>
              {loading ? 'Cargando…' : `${total} necesidades · ordenadas por score`}
            </span>
          </div>
          {loading
            ? <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontSize: 13 }}>Cargando…</div>
            : <RankingChart necesidades={necesidades} />
          }
        </div>

        {/* Panel derecho */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Distribución prioridad */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <span className="card-header-title">Distribución</span>
            </div>
            <div style={{ padding: '18px 20px' }}>
              <MiniDist title="Por prioridad" items={distPrioridad} />
              <MiniDist title="Por tipo de proceso" items={distTipo} />
              <MiniDist title="Por nivel de riesgo" items={distRiesgo} />
            </div>
          </div>

        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="section-header" style={{ marginBottom: importMsg ? 10 : 16 }}>
        <div className="section-title">Detalle completo</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Importar Excel */}
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#1565c0', color: '#fff', border: 'none',
            borderRadius: 7, padding: '8px 16px', fontSize: 12.5,
            fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer',
            opacity: importing ? 0.7 : 1,
          }}>
            {importing ? '⏳ Importando…' : '📥 Importar Excel'}
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              onChange={handleImport} disabled={importing} />
          </label>

          {/* Exportar Excel */}
          <button
            className="btn-acceder"
            style={{ cursor: 'pointer', background: '#2e7d32' }}
            onClick={handleExport}
            disabled={necesidades.length === 0}
          >
            📤 Exportar Excel
          </button>

          <button
            className="btn-acceder"
            style={{ cursor: 'pointer', background: showTable ? '#555' : undefined }}
            onClick={() => setShowTable(v => !v)}
          >
            {showTable ? '▲ Ocultar tabla' : '▼ Ver tabla'}
          </button>
          <button
            className="btn-acceder"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              if (showForm) { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); }
              else          { setShowForm(true);  setShowTable(true); }
            }}
          >
            {showForm ? '✕ Cancelar' : '+ Nueva necesidad'}
          </button>
        </div>
      </div>

      {/* Mensaje importación */}
      {importMsg && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13,
          background: importMsg.type === 'ok' ? '#e8f5e9' : '#ffebee',
          color:      importMsg.type === 'ok' ? '#2e7d32' : '#c62828',
          border:     `1px solid ${importMsg.type === 'ok' ? '#a5d6a7' : '#ef9a9a'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{importMsg.type === 'ok' ? '✅' : '❌'} {importMsg.text}</span>
          <button onClick={() => setImportMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16 }}>
            ✕
          </button>
        </div>
      )}

      {/* ── Formulario ── */}
      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-header-title">
              {editId ? '✏️ Editar necesidad' : 'Registrar nueva necesidad'}
            </span>
            {editId && (
              <span style={{ fontSize: 11.5, color: '#888' }}>ID #{editId}</span>
            )}
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
                  value={form.recurrencia_mensual} onChange={handleChange}
                  required min={1} placeholder="veces / mes" />
              </label>

              <label className="form-group">
                <span className="form-label">Duración (horas) *</span>
                <input className="form-input" type="number" name="duracion_horas"
                  value={form.duracion_horas} onChange={handleChange}
                  required min={0.5} step={0.5} placeholder="horas por ejecución" />
              </label>

              <label className="form-group" style={{ gridColumn: '1 / -1' }}>
                <span className="form-label">Riesgo identificado *</span>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  {RIESGO_OPTS.map(r => (
                    <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" name="riesgo" value={r.value}
                        checked={parseInt(form.riesgo) === r.value}
                        onChange={handleChange} />
                      {r.label}
                    </label>
                  ))}
                </div>
              </label>

            </div>

            {error && <div style={{ color: '#c62828', fontSize: 13, marginTop: 10 }}>{error}</div>}

            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button type="submit" className="btn-acceder" disabled={submitting}
                style={{ cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Guardando…' : editId ? '💾 Guardar cambios' : 'Registrar y priorizar'}
              </button>
              <button type="button" className="btn-acceder-disabled"
                onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tabla detallada ── */}
      {showTable && (
        <div className="card">
          <div className="card-header">
            <span className="card-header-title">Necesidades priorizadas · ordenadas por score</span>
            <span style={{ fontSize: 12, color: '#888' }}>{total} registros</span>
          </div>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#888', fontSize: 13 }}>Cargando…</div>
          ) : total === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
              No hay necesidades registradas aún.
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
                {[...necesidades].sort((a, b) => b.puntuacion - a.puntuacion).map((n, i) => {
                  const band = scoreBand(n.puntuacion);
                  const ts   = TIPO_STYLE[n.tipo_objetivo] || {};
                  return (
                    <tr key={n.id}>
                      <td style={{ fontWeight: 700, color: '#888', width: 36 }}>{i + 1}</td>
                      <td>
                        <span style={{
                          background: band.bg, color: band.color,
                          fontWeight: 700, fontSize: 10.5, padding: '3px 9px',
                          borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.4,
                        }}>
                          {band.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 90 }}>
                          <div style={{ height: 6, width: 60, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
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
                          {n.necesidad.length > 70 ? n.necesidad.slice(0, 70) + '…' : n.necesidad}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{n.responsable}</td>
                      <td>
                        <span style={{ ...ts, fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>
                          {n.tipo_objetivo}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 12.5 }}>{n.recurrencia_mensual}×</td>
                      <td style={{ textAlign: 'center', fontSize: 12.5 }}>{n.duracion_horas}h</td>
                      <td style={{ textAlign: 'center', fontSize: 12.5 }}>
                        {['', 'Bajo', 'Medio', 'Alto'][n.riesgo]}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => handleEdit(n)}
                            style={{
                              background: 'none', border: '1px solid #c8e0c8',
                              borderRadius: 5, cursor: 'pointer',
                              color: '#006633', fontSize: 12, padding: '3px 8px',
                            }}
                            title="Editar"
                          >✏️</button>
                          <button
                            onClick={() => handleDelete(n.id)}
                            style={{
                              background: 'none', border: '1px solid #f5c6c6',
                              borderRadius: 5, cursor: 'pointer',
                              color: '#c62828', fontSize: 12, padding: '3px 8px',
                            }}
                            title="Eliminar"
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  );
}
