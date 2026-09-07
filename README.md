# qr-experiencias

Páginas de regalo que se abren al escanear un QR. Next.js en Vercel, Supabase de base de datos y almacenamiento, cuatro temas visuales sobre una sola plantilla.

```
https://tudominio.pe/cumpleanos/g7k2mqx91a
                     └ ocasión  └ slug
```

La **ocasión** va en la URL porque es lo que el papel impreso lleva grabado para siempre. El **tema visual** vive en la base de datos: si el cliente cambia de opinión, el link y el QR siguen sirviendo.

---

## Los cuatro temas

| id | nombre | carrusel | pluma |
|---|---|---|---|
| `correspondencia` | Papel archivado, oxblood y latón | baraja de polaroids | Homemade Apple |
| `luz-de-vela` | Índigo con una sola luz cálida | coverflow 3D | Caveat |
| `herbario` | Salvia y rosa seca, papel de lino | abanico en mano | Shadows Into Light |
| `editorial` | Blanco, negro y coral eléctrico | tira con numerales | Nothing You Could Do |

Los colores viven en `app/globals.css` bajo `[data-tema="…"]`. Ningún componente escribe un color literal: todos usan variables. **Para agregar un quinto tema:** un bloque de variables en el CSS, una entrada en `lib/temas.ts`, y el valor nuevo en el enum `tema_visual` de Postgres. Nada más.

---

## Puesta en marcha

### 1. Supabase

Crea el proyecto, abre **SQL Editor → New query**, pega `supabase/schema.sql` completo y ejecútalo. Eso crea las tablas, las políticas de RLS, el bucket privado `media` y el job de caducidad.

Copia de **Project Settings → API**: la URL, la `anon key` y la `service_role key`.

### 2. Local

```bash
npm install
cp .env.example .env.local     # pega ahí las tres claves
npm run dev
```

Entra a `http://localhost:3000/admin`, crea un pedido de prueba y abre la URL que te devuelve.

### 3. Vercel

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel env add API_KEY
npx vercel env add ADMIN_PASSWORD
npx vercel env add NEXT_PUBLIC_SITE_URL
npx vercel --prod
```

O conecta el repo desde el panel de Vercel y pega las variables ahí — cada push a `main` redespliega solo.

`SUPABASE_SERVICE_ROLE_KEY` **nunca** lleva el prefijo `NEXT_PUBLIC_`. Esa clave salta todas las políticas de seguridad; si llega al navegador, cualquiera puede leer y borrar tus pedidos.

---

## Crear páginas desde Make

```
POST https://tudominio.pe/api/pedidos
x-api-key: <API_KEY>
content-type: application/json

{
  "ocasion": "cumpleanos",
  "tema": "herbario",
  "estado": "listo",
  "destinatario": "Cris",
  "pareja": "Greg & Cris",
  "frase_principal": "Hoy es el cumpleaños<br>de mi persona favorita",
  "fecha_texto": "18 de junio",
  "mensaje": "Primer párrafo.\n\nSegundo párrafo.",
  "frase_capitulo": "…",
  "frase_brindis": "…",
  "frase_final": "…",
  "fotos": ["pedidos/g7k2mqx91a/1.jpg", "pedidos/g7k2mqx91a/2.jpg"],
  "retencion": "12m",
  "comprador_email": "quien@compro.com"
}
```

Responde `201` con `{ url }`, lista para meter en el generador de QR.

El endpoint hace **upsert sobre `(ocasion, slug)`**: si Make reintenta el webhook —y lo hace— no se crean dos páginas ni se generan dos canciones. Si no mandas `slug`, se genera uno de 10 caracteres sin letras que se confundan al dictarlas por teléfono.

### Subir fotos

`POST /api/subir` con `{ "ruta": "pedidos/<slug>/1.jpg" }` devuelve una URL firmada para que el archivo suba **directo** a Supabase Storage, sin pasar por Vercel. Guarda esas rutas en el array `fotos`; la página las firma al renderizar.

---

## Cómo funciona la caducidad

El bucket es privado. La página no guarda URLs públicas: firma las rutas en cada render, con seis horas de vigencia. Eso es lo que hace que la caducidad sea real sin borrar nada.

- `media_expira_en` se calcula al crear el pedido, según `retencion` (`6m`, `12m`, `24m`, `siempre`).
- La vista `por_vencer` lista lo que vence en 30 días → Make manda el WhatsApp de upsell.
- `marcar_vencidos()` marca `archivada_en` al pasar la fecha.
- La página **nunca muere**: al vencer se pierde la descarga en alta, no la galería. El cliente ve el aviso de rescate y un botón.

El borrado físico va 30 días después, en un segundo job. La recuperación convierte mucho mejor que la prevención: la gente paga cuando ya siente la pérdida.

Ojo con el costo: mil pedidos de 30 MB son 30 GB. **Caducar no te ahorra dinero de servidor** — sirve para crear el momento de escasez que hace vendible el upsell. Comunícalo con honestidad.

---

## La letra manuscrita

`components/CartaManuscrita.tsx`. Cada palabra es su propio `<text>` con ángulo, desvío vertical y opacidad de tinta propios, y la punta de la pluma sube y baja mientras avanza. Eso es lo que la separa de una fuente de imitación pegada en un `div`.

El corte de renglones lo hace `lib/wrap.ts` **en el servidor**, no el navegador: el papel mide 292 unidades SVG de ancho y cada pluma tiene su propio calibre (`maxChars` por tema). Nunca cortes el mensaje a mano al crear el pedido: manda el texto corrido, con una línea en blanco entre párrafos.

**Siguiente escalón** — trazo real, la pluma dibujando el contorno de cada letra: fuente monolineal → rutas con `opentype.js` en el build → `stroke-dashoffset`. Solo cambia cómo se pintan las palabras; la secuencia de animación ya está servida.

---

## Voz y canción

`voz_url` y `cancion_url` son columnas nullable: si están vacías, la página simplemente no muestra el reproductor. Cuando conectes ElevenLabs y Suno, Make llena esas dos columnas y la página los toma sola.

Para sincronizar el resaltado palabra por palabra con la voz, pide el audio a ElevenLabs con `with_timestamps=true` y engancha el array al evento `timeupdate` del `<audio>`. El marcado ya está listo: cada palabra es un elemento independiente.

---

## Estructura

```
app/
  [ocasion]/[slug]/page.tsx   la página del regalo (server, lee de Supabase y firma las fotos)
  admin/                      panel con contraseña
  api/pedidos/                POST crear · GET listar
  api/subir/                  URL firmada de subida
  globals.css                 TODO el color y la tipografía, por tema
components/
  Experiencia.tsx             el recorrido: corazón, carrusel, sobre, cierre
  CartaManuscrita.tsx         la escritura a mano en SVG
  Carruseles.tsx              los cuatro
lib/
  temas.ts                    qué carrusel, qué fuentes, qué calibre de pluma
  wrap.ts                     corte de renglones
  supabase.ts                 cliente público y cliente admin
  slug.ts
supabase/schema.sql
middleware.ts                 protege /admin
```

---

## Migrar lo que ya vendiste

Las páginas del Docker de Render siguen vivas en sus URLs actuales; no las rompas. Para cada pedido histórico: inserta la fila aquí, sube las fotos al bucket, y en el Docker deja un redirect 301 de `/landing/<id>` a la ruta nueva. Los QR impresos siguen funcionando y puedes apagar Render cuando el tráfico llegue a cero.
