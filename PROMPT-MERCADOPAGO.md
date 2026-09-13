# Mercado Pago · cómo quedó, y por qué

Resuelto el 13 de septiembre de 2026. Este archivo reemplaza al prompt de
continuación anterior, que partía de tres hipótesis que resultaron falsas.

## La regla del sandbox de Mercado Pago en Perú

Tres cosas, y ninguna estaba en nuestras suposiciones iniciales:

1. **Las credenciales `TEST-` no cobran.** Lo dijo MP al rechazar
   `POST /v1/orders`: *"Test credentials are not supported, use test users
   with production credentials to sandbox environment."* El sandbox real
   son las credenciales **`APP_USR-` de un usuario de prueba**.
2. **El pagador tiene que ser otro usuario de prueba.** Su correo no
   aparece en el panel porque esa casilla no existe: se deriva del nombre
   de usuario. `TESTUSER7378515948445158953` →
   `test_user_7378515948445158953@testuser.com`.
3. **`X-Test-Token: true` va solo en el cobro, jamás al tokenizar.** Un
   token creado con esa cabecera pertenece a otro ambiente: la propia
   cuenta lo lee con 404 y el cobro muere con `invalid_card_token` — o con
   un 500 opaco, si se lo mandas al endpoint viejo.

## Por qué el proyecto usa la Orders API

Con el par de prueba bien montado, `POST /v1/payments` no tiene **ninguna**
combinación que funcione. Las cuatro, medidas:

| token | cobro | resultado |
|---|---|---|
| sin cabecera | sin `X-Test-Token` | 401 code 7 · unauthorized use of live credentials |
| sin cabecera | con `X-Test-Token` | 400 code 2006 · Card Token not found |
| con cabecera | con `X-Test-Token` | 500 internal_error |
| con cabecera | sin `X-Test-Token` | 401 code 7 |

`POST /v1/orders` con el mismo token cobra `processed / accredited`, con y
sin la cabecera. Por eso `lib/pagos/pasarela.ts` habla con órdenes.

La Orders API no tiene `metadata` ni `issuer_id`. La metadata se
reemplazó por el id del intento en `external_reference`, que el webhook
lee de vuelta contra `intentos_pago`; el emisor lo deduce MP del token.

## La cuenta real está rota, y no es el código

`christian.cj2901@gmail.com` · id `3672073900`. Con esa cuenta,
`POST /v1/payments` devuelve 500 `internal_error` con `cause` vacío
**incluso para `pagoefectivo_atm`**, que no lleva tarjeta ni token. En la
misma cuenta, `GET /users/me`, `GET /v1/payment_methods`,
`POST /v1/card_tokens` y `POST /checkout/preferences` funcionan (201).

Si algún día hay que cobrar de verdad con ella, eso es un ticket a
soporte, no una corrección de código. `x-request-id` como evidencia:
`3e2a0914-36ad-4240-9ad7-4b75a72eb8ad` (pagoefectivo),
`c3ef1cf3-9724-4a6f-9c48-ca7604758adc` (tarjeta).

## El `.env` que funciona

```
MP_ACCESS_TOKEN=APP_USR-…            # del VENDEDOR de prueba
NEXT_PUBLIC_MP_PUBLIC_KEY=APP_USR-…  # misma aplicación, misma pantalla
MP_TEST_PAYER_EMAIL=test_user_7378515948445158953@testuser.com
MP_MODO=prueba
```

`MP_MODO` no es opcional: con credenciales `APP_USR-` el código ya no
puede deducir por el prefijo que esto es un sandbox, y sin ella el
checkout se cree en producción (pierde el cartel de "modo prueba" y
descarta `MP_TEST_PAYER_EMAIL`).

Tarjeta de prueba: Mastercard `5031 7557 3453 0604`, titular `APRO`,
cualquier fecha futura, CVV `123`.

## Los scripts

```bash
node --env-file=.env scripts/diagnostico-500.mjs         # ¿la cuenta puede crear pagos?
node --env-file=.env scripts/probar-orders.mjs           # ¿y órdenes?
node --env-file=.env scripts/probar-vendedor-prueba.mjs  # el par vendedor+comprador de prueba
node --env-file=.env scripts/probar-orden-token.mjs      # matriz de tokenización · el que lo resolvió
node --env-file=.env scripts/probar-pago-final.mjs       # ¿sobrevive /v1/payments? (no)
```

`probar-pago.mjs` y `probar-pago-2.mjs` son los originales y quedaron
obsoletos: abortan si el token no empieza con `TEST-`, que es justo lo que
ya no hay que usar.
