'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generarUrlSubida, guardarPedidoAction } from '@/app/api/admin/actions';
import { OCASIONES } from '@/lib/ocasiones';

/**
 * Formulario del panel.
 *
 * DOS COSAS QUE HAY QUE TENER PRESENTES
 *
 * 1. `ruta` y `preview` NO son lo mismo. En la base guardamos la ruta del
 *    bucket privado ("pedidos/abc/1.jpg"); eso es lo que se vuelve a
 *    guardar. Un <img> no puede mostrar una ruta: necesita una URL
 *    firmada, que llega desde el servidor en `previews`. Confundirlas era
 *    justo el bug de las miniaturas rotas al editar.
 *
 * 2. El tema se guarda con el id real del enum de Postgres
 *    (correspondencia | luz-de-vela | herbario | editorial). Antes este
 *    select mandaba 'a','c','d','e', que la base rechaza.
 */

/** Maximo de fotos del carrusel. Coincide con plantillas.max_fotos. */
const MAX_FOTOS = 5;
/** Minimo para publicar: con menos, el carrusel se ve pobre. */
const MIN_FOTOS = 3;

const TEMAS = [
  ['correspondencia', 'Correspondencia · papel, lacre y matasellos'],
  ['luz-de-vela', 'Luz de vela · noche cálida'],
  ['herbario', 'Herbario · botánico, salvia y lino'],
  ['editorial', 'Editorial · blanco, negro y coral'],
] as const;

type FotoItem = {
  id: string;
  /** Ruta en el bucket. Existe si la foto ya estaba guardada. */
  ruta?: string;
  /** Archivo recien elegido, aun sin subir. */
  file?: File;
  /** URL mostrable: firmada (si venia de la base) o blob local. */
  preview?: string;
};

type PedidoData = {
  id?: string;
  slug?: string;
  destinatario?: string;
  frase_principal?: string;
  ocasion?: string;
  tema?: string;
  mensaje?: string;
  fotos?: string[];
  foto_final?: string;
};

/** URLs firmadas por el servidor, en el mismo orden que initialData.fotos. */
type Previews = { fotos: string[]; fotoFinal: string | null };

export default function ExperienciaForm({
  initialData = null,
  previews,
}: {
  initialData?: PedidoData | null;
  previews?: Previews;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState('');

  const [formData, setFormData] = useState({
    destinatario: initialData?.destinatario || '',
    frase_principal: initialData?.frase_principal || '',
    ocasion: initialData?.ocasion || 'cumpleanos',
    tema: initialData?.tema || 'correspondencia',
    mensaje: initialData?.mensaje || '',
  });

  const [fotos, setFotos] = useState<FotoItem[]>([]);
  const [fotoFinal, setFotoFinal] = useState<FotoItem | null>(null);

  useEffect(() => {
    if (initialData?.fotos && Array.isArray(initialData.fotos)) {
      setFotos(
        initialData.fotos.map((ruta: string, i: number) => ({
          id: `guardada-${i}`,
          ruta,
          // Si por lo que sea no llego la firma, no ponemos la ruta cruda:
          // un <img> con una ruta da 404 y ensucia la consola.
          preview: previews?.fotos?.[i],
        }))
      );
    }
    if (initialData?.foto_final) {
      setFotoFinal({
        id: 'guardada-final',
        ruta: initialData.foto_final,
        preview: previews?.fotoFinal ?? undefined,
      });
    }
  }, [initialData, previews]);

  // Los blob: de las fotos nuevas se liberan al desmontar.
  useEffect(() => {
    return () => {
      [...fotos, fotoFinal].forEach((f) => {
        if (f?.file && f.preview) URL.revokeObjectURL(f.preview);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSugerenciaCarrusel = () => {
    switch (formData.tema) {
      case 'correspondencia': return 'Sugerencia: formato 1:1 (cuadradas, 1080×1080)';
      case 'luz-de-vela':
      case 'herbario': return 'Sugerencia: formato 4:5 (verticales, tipo retrato)';
      case 'editorial': return 'Sugerencia: formato 9:16 (verticales largas, tipo historia)';
      default: return '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isFinal: boolean = false) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        preview: URL.createObjectURL(file)
      }));

      if (isFinal) {
        setFotoFinal(newFiles[0]);
      } else {
        // Recortar aqui y no solo deshabilitar el input: el usuario puede
        // seleccionar 8 archivos de una sola vez en el dialogo del sistema.
        setFotos(prev => [...prev, ...newFiles].slice(0, MAX_FOTOS));
      }
      e.target.value = '';
    }
  };

  const removeFoto = (id: string, isFinal: boolean = false) => {
    if (isFinal) {
      if (fotoFinal?.file && fotoFinal.preview) URL.revokeObjectURL(fotoFinal.preview);
      setFotoFinal(null);
    } else {
      setFotos(prev => {
        const fuera = prev.find(f => f.id === id);
        if (fuera?.file && fuera.preview) URL.revokeObjectURL(fuera.preview);
        return prev.filter(f => f.id !== id);
      });
    }
  };

  const uploadFoto = async (file: File) => {
    const folderId = initialData?.slug || Math.random().toString(36).substring(2, 10);
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '');
    const ruta = `pedidos/${folderId}/${Date.now()}-${cleanFileName}`;

    const { signedUrl, path } = await generarUrlSubida(ruta);

    const res = await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    });

    if (!res.ok) {
      throw new Error(`Error en subida de imagen: ${res.status}`);
    }

    return path; 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAviso('');

    if (fotos.length < MIN_FOTOS) {
      setAviso(`Faltan fotos: el carrusel necesita al menos ${MIN_FOTOS}. Llevas ${fotos.length}.`);
      return;
    }

    setLoading(true);

    try {
      // 1. Subir fotos del carrusel
      const urlsCarrusel = await Promise.all(
        fotos.map(async (foto) => {
          if (foto.ruta) return foto.ruta;
          if (foto.file) return await uploadFoto(foto.file); 
          return null;
        })
      );

      // 2. Subir foto final
      let urlFinal = null;
      if (fotoFinal?.ruta) urlFinal = fotoFinal.ruta;
      else if (fotoFinal?.file) urlFinal = await uploadFoto(fotoFinal.file);

      // 3. Estructurar el payload exactamente como tu API lo exige
      const payload = {
        ...formData,
        slug: initialData?.slug, // Vital para que haga UPDATE en vez de crear uno nuevo
        estado: 'listo',
        fotos: urlsCarrusel.filter(Boolean),
        foto_final: urlFinal,
      };

      // 4. Enviar mediante la Server Action
      await guardarPedidoAction(payload);

      router.push('/admin');
      router.refresh();
      
    } catch (error) {
      // Nada de alert(): rompe el flujo y no se puede copiar el mensaje.
      console.error(error);
      setAviso(`No se pudo guardar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ef-container">
      <form onSubmit={handleSubmit} className="ef-form">
        
        <div className="ef-grid">
          <div className="ef-field">
            <label>Destinatario *</label>
            <input type="text" required value={formData.destinatario} 
                   onChange={e => setFormData({...formData, destinatario: e.target.value})} 
                   placeholder="Ej: Ana" />
          </div>
          <div className="ef-field">
            <label>Ocasión *</label>
            {/* Es clave foránea de `ocasiones`: texto libre reventaba el guardado. */}
            <select required value={formData.ocasion}
                    onChange={e => setFormData({...formData, ocasion: e.target.value})}>
              {OCASIONES.map(o => (
                <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="ef-field">
          <label>Frase Principal *</label>
          <input type="text" required value={formData.frase_principal}
                 onChange={e => setFormData({...formData, frase_principal: e.target.value})} 
                 placeholder="Ej: Feliz cumpleaños mi amor" />
        </div>
        
        <div className="ef-field">
          <label>Mensaje *</label>
          <textarea required value={formData.mensaje} rows={3}
                 onChange={e => setFormData({...formData, mensaje: e.target.value})} 
                 placeholder="Escribe la carta aquí..." className="w-full p-2 border rounded" />
        </div>

        <div className="ef-field">
          <label>Tema Visual</label>
          <select value={formData.tema} onChange={e => setFormData({...formData, tema: e.target.value})}>
            {TEMAS.map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </div>

        <div className="ef-upload-box">
          <label>
            Fotos del carrusel{' '}
            <span className={fotos.length < MIN_FOTOS ? 'ef-cuenta-falta' : 'ef-cuenta'}>
              {fotos.length} de {MAX_FOTOS} · mínimo {MIN_FOTOS}
            </span>
          </label>
          <p className="ef-sugerencia">{getSugerenciaCarrusel()}</p>

          <input type="file" multiple accept="image/*" onChange={(e) => handleFileChange(e, false)}
                 disabled={fotos.length >= MAX_FOTOS} />

          <div className="ef-preview-grid">
            {fotos.map(foto => (
              <div key={foto.id} className="ef-preview-item">
                {foto.preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={foto.preview} alt="" />
                ) : (
                  <span className="ef-preview-vacio">sin vista previa</span>
                )}
                <button type="button" onClick={() => removeFoto(foto.id, false)} aria-label="Quitar foto">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="ef-upload-box">
          <label>Foto Final (Cierre)</label>
          <p className="ef-sugerencia">Sugerencia: Formato Horizontal o Panorámico</p>
          
          {!fotoFinal ? (
            <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, true)} />
          ) : (
            <div className="ef-preview-item ef-preview-final">
              {fotoFinal.preview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={fotoFinal.preview} alt="" />
              ) : (
                <span className="ef-preview-vacio">sin vista previa</span>
              )}
              <button type="button" onClick={() => removeFoto(fotoFinal.id, true)} aria-label="Quitar foto">✕</button>
            </div>
          )}
        </div>

        {aviso && <p className="ef-aviso">{aviso}</p>}

        <button type="submit" disabled={loading} className="ef-submit">
          {loading ? 'Guardando...' : (initialData ? 'Actualizar Experiencia' : 'Crear Experiencia')}
        </button>
      </form>

      <style>{`
        .ef-container { max-width: 650px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); font-family: system-ui, -apple-system, sans-serif; color: #333; }
        .ef-form { display: flex; flex-direction: column; gap: 24px; }
        .ef-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ef-field label, .ef-upload-box label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px; }
        .ef-field input, .ef-field select, .ef-field textarea { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; background: #fafafa; }
        .ef-field input:focus, .ef-field select:focus, .ef-field textarea:focus { outline: none; border-color: #3b82f6; background: #fff; }
        .ef-upload-box { border: 2px dashed #e5e7eb; padding: 20px; border-radius: 8px; background: #f9fafb; }
        .ef-sugerencia { font-size: 13px; color: #2563eb; margin: 0 0 12px 0; }
        .ef-upload-box input[type="file"] { margin-bottom: 16px; font-size: 14px; }
        .ef-preview-grid { display: flex; flex-wrap: wrap; gap: 12px; }
        .ef-preview-item { position: relative; width: 100px; height: 100px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .ef-preview-final { width: 160px; height: 90px; }
        .ef-preview-item img { width: 100%; height: 100%; object-fit: cover; }
        .ef-preview-item button { position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ef-preview-item button:hover { background: rgb(220, 38, 38); }
        .ef-submit { background: #111827; color: white; padding: 14px; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .ef-submit:hover:not(:disabled) { background: #374151; }
        .ef-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .ef-cuenta { font-weight: 400; color: #6b7280; font-size: 13px; }
        .ef-cuenta-falta { font-weight: 600; color: #b91c1c; font-size: 13px; }
        .ef-preview-vacio { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: #f3f4f6; color: #9ca3af; font-size: 11px; text-align: center; padding: 6px; }
        .ef-aviso { margin: 0; padding: 12px 14px; border-radius: 8px; background: #fef2f2; color: #991b1b; font-size: 14px; border: 1px solid #fecaca; }
      `}</style>
    </div>
  );
}