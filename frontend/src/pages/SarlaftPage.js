import { useState, useRef } from 'react';

const API_URL = process.env.REACT_APP_API_URL || '/api';

function LoginForm({ onLogin, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="page">
      <div className="banner">
        <div className="banner-text">
          <h1>SARLAFT · Validador Cámara de Comercio</h1>
          <p>
            Extracción automática de datos de certificados de existencia y representación
            legal para validación de listas restrictivas y análisis de riesgo LA/FT.
          </p>
        </div>
        <div className="banner-stats">
          <div className="banner-stat">
            <div className="banner-stat-num">🔒</div>
            <div className="banner-stat-label">Acceso restringido</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 440, margin: '40px auto' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-header-title">Autenticación requerida</span>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            <label className="form-group">
              <span className="form-label">Usuario</span>
              <input
                className="form-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                placeholder="Nombre de usuario Django"
              />
            </label>

            <label className="form-group" style={{ marginTop: 14 }}>
              <span className="form-label">Contraseña</span>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </label>

            {error && (
              <div style={{
                color: '#c62828', background: '#ffebee', border: '1px solid #ffcdd2',
                borderRadius: 7, padding: '10px 14px', fontSize: 13, marginTop: 14,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-acceder"
              style={{ marginTop: 20, cursor: 'pointer' }}
            >
              Ingresar al módulo →
            </button>

            <p style={{ fontSize: 11, color: '#999', marginTop: 14, lineHeight: 1.5 }}>
              Acceso solo para usuarios autorizados. Contacta al administrador del sistema
              para obtener credenciales.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SarlaftPage() {
  const [creds, setCreds]             = useState(null);
  const [authError, setAuthError]     = useState(null);
  const [files, setFiles]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [resultado, setResultado]     = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef                  = useRef();

  const handleLogin = (username, password) => {
    setCreds({ username, password });
    setAuthError(null);
  };

  const handleLogout = () => {
    setCreds(null);
    setResultado(null);
    setFiles([]);
    setUploadError(null);
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
    setResultado(null);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setLoading(true);
    setUploadError(null);
    setResultado(null);

    const formData = new FormData();
    files.forEach(f => formData.append('archivos', f));

    const basicAuth = btoa(`${creds.username}:${creds.password}`);

    try {
      const res = await fetch(`${API_URL}/sarlaft/certificados/`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${basicAuth}` },
        body: formData,
      });

      if (res.status === 401 || res.status === 403) {
        setAuthError('Credenciales inválidas o sin permisos. Verifica tu usuario y contraseña.');
        setCreds(null);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Error al procesar los archivos.');
        return;
      }

      setResultado(data);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setUploadError('No se pudo conectar con el servidor. Verifica que el servicio esté activo.');
    } finally {
      setLoading(false);
    }
  };

  if (!creds) {
    return <LoginForm onLogin={handleLogin} error={authError} />;
  }

  return (
    <div className="page">

      {/* Banner */}
      <div className="banner">
        <div className="banner-text">
          <h1>SARLAFT · Validador Cámara de Comercio</h1>
          <p>
            Carga los certificados de existencia y representación legal en PDF.
            El sistema extrae automáticamente razón social, NIT y representante legal
            para cruce con listas restrictivas.
          </p>
        </div>
        <div className="banner-stats">
          <div className="banner-stat">
            <div className="banner-stat-num">{files.length}</div>
            <div className="banner-stat-label">Archivos</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">{resultado?.resultados?.length ?? '–'}</div>
            <div className="banner-stat-label">Procesados</div>
          </div>
          <div className="banner-stat">
            <div className="banner-stat-num">{resultado?.errores?.length ?? '–'}</div>
            <div className="banner-stat-label">Errores</div>
          </div>
        </div>
      </div>

      {/* Upload card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-header-title">Cargar certificados PDF</span>
          <button
            onClick={handleLogout}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            👤 {creds.username} · Cerrar sesión
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <label className="form-group">
            <span className="form-label">Archivos PDF (uno o varios)</span>
            <input
              ref={fileInputRef}
              className="form-input"
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFileChange}
              style={{ cursor: 'pointer' }}
            />
          </label>

          {files.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {files.map(f => (
                <div key={f.name} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12.5, color: '#444', padding: '5px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}>
                  <span>📄</span>
                  <span style={{ flex: 1 }}>{f.name}</span>
                  <span style={{ color: '#aaa', fontSize: 11 }}>{(f.size / 1024).toFixed(0)} KB</span>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <div style={{
              color: '#c62828', background: '#ffebee', border: '1px solid #ffcdd2',
              borderRadius: 7, padding: '10px 14px', fontSize: 13, marginTop: 14,
            }}>
              {uploadError}
            </div>
          )}

          <button
            className="btn-acceder"
            style={{
              marginTop: 18, cursor: files.length && !loading ? 'pointer' : 'not-allowed',
              opacity: files.length && !loading ? 1 : 0.55,
            }}
            onClick={handleUpload}
            disabled={!files.length || loading}
          >
            {loading
              ? '⏳ Procesando...'
              : `Extraer datos · ${files.length} archivo${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {/* Resultados */}
      {resultado && (
        <>
          {resultado.resultados?.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <span className="card-header-title">
                  Datos extraídos · {resultado.resultados.length} certificado(s)
                </span>
                <span style={{ fontSize: 12, color: '#888' }}>
                  Ejecución #{resultado.execution_id}
                </span>
              </div>
              <table className="api-table">
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Razón Social</th>
                    <th>NIT</th>
                    <th>Representante Legal</th>
                    <th>Tipo Doc.</th>
                    <th>Cédula</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.resultados.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>📄 {r.archivo}</td>
                      <td style={{ fontWeight: 600 }}>
                        {r.razon_social || <span style={{ color: '#bbb' }}>No encontrado</span>}
                      </td>
                      <td>
                        <span className="endpoint-url">{r.nit || '–'}</span>
                      </td>
                      <td>{r.representante || <span style={{ color: '#bbb' }}>–</span>}</td>
                      <td style={{ fontSize: 12 }}>{r.tipo_doc || '–'}</td>
                      <td style={{ fontSize: 12 }}>{r.cedula || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resultado.errores?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-header-title" style={{ color: '#c62828' }}>
                  ⚠ Errores · {resultado.errores.length} archivo(s) no procesado(s)
                </span>
              </div>
              <table className="api-table">
                <thead>
                  <tr><th>Archivo</th><th>Detalle del error</th></tr>
                </thead>
                <tbody>
                  {resultado.errores.map((e, i) => (
                    <tr key={i}>
                      <td>📄 {e.archivo}</td>
                      <td style={{ color: '#c62828', fontSize: 12 }}>{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
