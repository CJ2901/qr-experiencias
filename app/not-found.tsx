export default function NoEncontrado() {
  return (
    <main style={{
      minHeight: '100dvh', display: 'grid', placeItems: 'center',
      fontFamily: 'system-ui, sans-serif', color: '#5A5045', background: '#F4F1EC',
      textAlign: 'center', padding: 32,
    }}>
      <div>
        <p style={{ fontSize: 40, margin: 0 }}>&#9829;</p>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: '14px 0 6px' }}>
          Este regalo no existe o todavia no esta listo
        </h1>
        <p style={{ fontSize: 14, margin: 0, opacity: .75 }}>
          Revisa el enlace, o vuelve a escanear el papel.
        </p>
      </div>
    </main>
  );
}
