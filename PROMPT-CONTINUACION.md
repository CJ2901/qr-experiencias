# Prompt de continuación — qr-experiencias

> Copia todo lo que sigue y pégalo como primer mensaje en el chat nuevo.

---

Eres un desarrollador senior en Next.js 15 (App Router), Supabase y Tailwind CSS v4. Retomamos un proyecto ya avanzado. Lee este contexto completo antes de escribir código.

## El producto

"Experiencias QR": regalos digitales para parejas. El cliente compra una plantilla, sube su contenido, y recibe un QR imprimible. Al escanearlo se abre una página personalizada con una carta escrita a mano que se dibuja sola, sobre lacrado, galería de fotos y (a futuro) voz IA y canción generada.

Negocio en Perú, precios en soles. Repo local: `~/Documents/PyProjects/qr-apps/qr-experiencias`.

## Stack y decisiones ya tomadas — no las reabras sin razón

- **Next.js 15 App Router + TypeScript.** `params` es `Promise<...>`: siempre `const { x } = await params`.
- **Supabase**: Postgres + Auth (magic link) + Storage privado. Región East US; las rutas llevan `export const preferredRegion = 'iad1'` para quedar en el mismo datacenter.
- **Tailwind v4** para tienda y admin. La página del regalo NO usa Tailwind: usa un sistema de variables CSS en `app/globals.css` bajo `[data-tema="..."]`. `@import "tailwindcss"` va en la primera línea de ese archivo, antes de los temas, para que la cascada los proteja del preflight.
- **Mercado Pago**: Payment Bricks para tarjeta; Yape por Checkout API detrás de flag. El cobro está en capas bajo `lib/pagos/` (ver más abajo).

## URL pública

```
/[ocasion]/[slug]        →  /cumpleanos/4tuya2br6w
```

La **ocasión** va en la URL porque es lo que queda grabado en el papel impreso. El **tema visual** vive en la base de datos, para poder cambiarlo sin invalidar QR ya entregados.

## Los cuatro temas

`correspondencia` · `luz-de-vela` · `herbario` · `editorial`

Cada uno define paleta, tipografías, fuente manuscrita, tipo de carrusel (baraja / coverflow / abanico / tira) y `maxChars` de la carta. Colores en `globals.css`; el resto en `lib/temas.ts`.

**Para agregar un tema:** bloque de variables en el CSS + entrada en `lib/temas.ts` + valor nuevo en el enum `tema_visual` de Postgres. Nada más.

## Flujo del cliente

1. `/catalogo` → `/catalogo/[plantilla]` (preview y precio)
2. `/checkout/[plantilla]` → Payment Brick. Requiere sesión.
3. Pago aprobado → pedido nace en `pendiente_datos`, ya vinculado al comprador
4. `/pedido/[id]/completar` → formulario guiado de 4 pasos, guarda al avanzar
5. Publicar → estado `listo`, **inmutable para el cliente**
6. `/pedido/[id]/listo` → tarjeta con QR descargable en PNG 1080×1620
7. `/mis-pedidos` → recuperar un pedido si cerró la pestaña

El admin (`/admin`) tiene CRUD total sobre cualquier pedido, en cualquier estado. Entra con la **misma sesión de Supabase que los clientes** y además su correo tiene que estar en `ADMIN_EMAILS`. La contraseña compartida se eliminó: no identificaba a nadie y no se podía revocar. Habilitar Google después es activar el proveedor en Supabase; la lista de correos sigue siendo la puerta.

## Invariantes que NO se pueden romper

**El precio sale de la tabla `plantillas`, nunca del navegador.** Si el monto viaja en el cuerpo de la petición, cualquiera paga S/ 1 con un curl.

**La inmutabilidad vive en la base, no en la UI.** La política de UPDATE del cliente es `using (comprador_id = auth.uid() and estado::text = 'pendiente_datos')`: al pasar a `listo` la fila deja de cumplir el USING. Además un trigger bloquea cambios de precio, dueño y `mp_payment_id`, y solo deja pasar a la `service_role`.

**La ruta pública `/[ocasion]/[slug]` lee con la clave anónima y filtra `estado = 'listo'`.** Nunca con `supabaseAdmin()` sin filtro: sería exponer borradores ajenos. *(Esto ya se rompió una vez: alguien copió el formulario del admin encima de esa página. Si al escanear un QR aparece un formulario de edición, es eso.)*

**El bucket `media` es privado.** Las fotos se firman en cada render con `createSignedUrls`. Eso es lo que hace real la caducidad. Si ves 404 de imágenes resueltas relativo a la ruta, es que alguien dejó de firmar.

**El corte de renglones de la carta lo hace el servidor** (`lib/wrap.ts`), no el navegador: el papel mide 292 unidades SVG y cada pluma tiene su calibre. El mensaje se guarda corrido, con línea en blanco entre párrafos.

**Una server action es un endpoint público.** `generarUrlSubida` y `guardarPedidoAction` empiezan con `requerirAdmin()`. Sin eso, cualquiera pedía una URL firmada de escritura en el bucket privado o sobrescribía el pedido de otro con nuestra `API_KEY`. El middleware solo redirige; no autoriza.

**Una ruta del bucket NO va en un `<img src>`.** El bucket es privado: en la base viven rutas, y hay que firmarlas con `lib/media.ts` antes de mostrarlas. Si ves miniaturas rotas en el admin o en el formulario guiado, es esto.

**Usa `temaDe(fila.tema)` de `lib/temas.ts`**, nunca `TEMAS[...]` a mano: las filas de Supabase llegan como `any` e indexar con `any` es error bajo `strict`.

**`SUPABASE_SERVICE_ROLE_KEY` nunca lleva prefijo `NEXT_PUBLIC_`.**

## Arquitectura del cobro (refactor de setiembre)

`/api/pagar` ya no sabe cobrar: es un adaptador HTTP de 40 líneas. La lógica vive en `lib/pagos/`, una capa por responsabilidad:

```
contrato.ts    valida lo que entra. NUNCA acepta el monto.
mensajes.ts    traduce status_detail de MP a una frase con una ACCIÓN.
pasarela.ts    lo único que conoce la API de Mercado Pago.
repositorio.ts lo único que escribe en pedidos / intentos_pago.
cobrar.ts      el caso de uso: cuenta la historia completa de un cobro.
errores.ts     ErrorPago: paso + código + mensaje público + detalle interno.
cliente.ts     el único fetch del navegador hacia /api/pagar.
```

Reglas que sostienen ese diseño:

- **Un pago rechazado NO es una excepción.** Vuelve como `{ ok: false, mensaje, cambiarMedio }` y sale por HTTP 402. El 500 queda reservado para fallos nuestros. Esa distinción es la que permite decir «revisa el CVV» en vez de «algo salió mal».
- **El cliente nunca lee `hayError` para decidir qué mostrar.** Ese era un bug real: el estado seguía en `false` dentro del mismo render y el `catch` pisaba el motivo verdadero con «se cortó la conexión». Ahora `enviarPago()` distingue tres casos (sin red / respuesta no-JSON / error del servidor) y nunca lanza.
- **La ocasión se valida contra `lib/ocasiones.ts` antes de cobrar.** Es FK de `ocasiones`: descubrirlo en el INSERT sería descubrirlo después de mover plata.
- **Todo intento deja fila en `intentos_pago` antes de llamar a MP** y se cierra después, apruebe o reviente. El comprador recibe ese id como «código de tu intento».
- **El webhook rechaza con 401 si `MP_WEBHOOK_SECRET` está vacía.** Sin firma, cualquiera marca pedidos como pagados con un curl.

## Medios de pago

- **Tarjeta**: Payment Brick, como siempre.
- **Yape**: `components/tienda/PagoYape.tsx`, detrás de `NEXT_PUBLIC_MP_YAPE=1`. No va dentro del Brick: MP lo expone solo por Checkout API con su propio tokenizador (`mp.yape({otp, phoneNumber}).create()`), y se cobra con `payment_method_id: 'yape'`, `installments: 1`. Prueba: celular `111111111` + código `123456` = aprobado; `111111112` = rechazado.
- **Plin**: no existe en Mercado Pago. Para aceptarlo hay que ir a Izipay, Niubiz o Culqi, o a un QR estático fuera de la pasarela (sin conciliación automática).

## La página del regalo

- **El sobre es un sobre**: solapa triangular que gira en 3D al abrir, alas laterales, bolsa y lacre sobre el vértice. Al abrirlo estalla `Celebracion`, con partículas por tema (papelitos, chispas, pétalos, confeti duro). Respeta `prefers-reduced-motion`.
- **Las fotos se deslizan y se amplían.** `Visor` es un lightbox con pellizco, doble toque, arrastre y teclado; ~120 líneas y cero dependencias. Los carruseles pasan foto al deslizar y abren el visor al tocar la activa. La foto final tiene marco y también se amplía.
- **Ya no se avisa de la caducidad de las fotos.** Es información de la compra, no del regalo, y leerla después de la carta rompía el momento. Vive en «Mis pedidos».
- **El botón cierra compartiendo**, no guardando: `Compartir` usa `navigator.share` si existe, y si no ofrece WhatsApp y copiar enlace. Los pedidos con el `texto_boton` viejo («Guardar este momento») muestran el nuevo automáticamente.

## Estado actual

**Funciona:** catálogo, preview de temas, auth por magic link, «Mis pedidos», página del regalo con carta manuscrita, formulario guiado, generación del QR, panel admin. `npx tsc --noEmit` pasa limpio.

**Por verificar:** el cobro de prueba end-to-end. Con el refactor, cualquier fallo deja fila en `intentos_pago` con `paso` y `código`; se lee con `scripts/intentos.mjs`. Ese script sustituye al «mírame la consola del next dev».

**Pendiente:** correr la migración 004; desplegar en Vercel; configurar el webhook de MP y poner `MP_WEBHOOK_SECRET`; conectar ElevenLabs y Suno — las columnas `voz_url` y `cancion_url` ya existen y son nullable.

## Si el pago falla

1. `node --env-file=.env scripts/intentos.mjs error` → dice el paso y el código exactos.
2. Si `paso = pasarela` y el código es `forbidden` con «Payer email forbidden» → `scripts/pagador.mjs`: el comprador de prueba no pertenece a la cuenta del token. Otros códigos de pasarela → `scripts/diagnostico-mp.mjs`.
3. Si `paso = base_de_datos` → **se cobró y no se guardó**: revisar ese pago a mano en el panel de MP.
4. Si `paso = configuracion` → falta una variable; `scripts/verificar.mjs`.

Red de seguridad para el comprador: el botón «Ya pagué, revisar» en Mis pedidos consulta el estado real a MP y desbloquea el pedido sin depender del webhook.

## Scripts de diagnóstico

```bash
node --env-file=.env scripts/verificar.mjs       # variables, esquema, GRANT, RLS, bucket
node --env-file=.env scripts/pagos.mjs           # cruza pedidos con lo que dice MP de cada pago
node --env-file=.env scripts/diagnostico-mp.mjs  # aísla si el 500 es de la cuenta MP
node --env-file=.env scripts/usuario-prueba.mjs  # crea usuario de prueba y devuelve su correo
node --env-file=.env scripts/intentos.mjs        # ultimos intentos de pago, con el motivo del fallo
node --env-file=.env scripts/pagador.mjs         # quien cobra vs. quien paga (403 Payer email forbidden)
```

## Migraciones SQL, en orden

```
supabase/schema.sql                    base: pedidos, ocasiones, RLS, bucket, caducidad
supabase/permisos.sql                  GRANT del Data API (incluida service_role)
supabase/migracion-002-tienda.sql      estados de pago, comprador_id, plantillas, RLS de cliente
supabase/migracion-003-indice-pago.sql índice único NO parcial en mp_payment_id
supabase/migracion-004-intentos-pago.sql bitácora de intentos (solo service_role)
supabase/migracion-005-fotos-3-5.sql     max_fotos 5, min_fotos 3
```

Dos trampas ya pagadas: un índice **parcial** no sirve para `ON CONFLICT` (PostgREST no emite el WHERE), y no se puede usar un valor de enum recién creado en la misma transacción — por eso las comparaciones de estado van con `::text`.

## Cómo quiero trabajar

- Antes de reescribir un archivo, léelo. Hay dos asistentes tocando el repo.
- Cambios en SQL de producción: muéstrame el "antes / después" y espera mi confirmación.
- Pregunta solo lo indispensable; si falta un dato menor, asume lo razonable y dilo.
- Cuando un error sea tuyo, dilo directo y arregla la causa, no el síntoma.
- Prefiero un script que me dé datos antes que una hipótesis.

Confirma que leíste esto y dime por dónde propones empezar.
