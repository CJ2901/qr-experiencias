import { NextResponse, type NextRequest } from 'next/server';
import { usuarioActual } from '@/lib/supabase-server';
import { procesarCobro } from '@/lib/pagos/cobrar';
import { errores, esErrorPago } from '@/lib/pagos/errores';

/**
 * POST /api/pagar
 *
 * Esta ruta ya no sabe cobrar. Solo hace lo que le toca a un adaptador
 * HTTP: averiguar quien pide, delegar en el caso de uso y traducir el
 * resultado a un codigo de estado. La logica vive en lib/pagos/.
 *
 * Codigos que devuelve, y que significan para el navegador:
 *   200  cobrado o en revision   → seguir al siguiente paso
 *   402  el banco lo rechazo     → mostrar el motivo, dejar reintentar
 *   400  el formulario vino mal  → recargar
 *   401  sesion caida            → volver a entrar
 *   502  Mercado Pago fallo      → no es culpa del comprador
 *   500  cobramos y no guardamos → caso grave, lleva codigo de reclamo
 */

export const runtime = 'nodejs';
export const preferredRegion = 'iad1';

export async function POST(req: NextRequest) {
  try {
    const usuario = await usuarioActual();
    if (!usuario) throw errores.sinSesion();

    const crudo = await req.json().catch(() => null);
    const cobro = await procesarCobro(crudo, { id: usuario.id, email: usuario.email });

    // 402 = "payment required": el sistema hizo bien su trabajo, el
    // rechazo fue del banco. Distinguirlo del 500 es lo que permite al
    // navegador decir "revisa el CVV" en vez de "algo salio mal".
    return NextResponse.json(
      cobro.ok ? cobro : { ...cobro, error: cobro.mensaje },
      { status: cobro.ok ? 200 : 402 }
    );
  } catch (e) {
    if (esErrorPago(e)) {
      console.error('[/api/pagar]', e.paso, e.codigo, JSON.stringify(e.detalle));
      return NextResponse.json(e.cuerpo(), { status: e.http });
    }
    // Nada deberia llegar aqui. Si llega, que quede el rastro completo:
    // un 500 en HTML sin cuerpo JSON es lo que el navegador confunde con
    // "se corto la conexion".
    console.error('[/api/pagar] excepcion no prevista:', e);
    return NextResponse.json(
      {
        ok: false,
        error:
          'Algo falló de nuestro lado y no se completó el pago. Revisa «Mis pedidos» antes de volver a intentar.',
        mensaje:
          'Algo falló de nuestro lado y no se completó el pago. Revisa «Mis pedidos» antes de volver a intentar.',
        codigo: 'excepcion_no_prevista',
        paso: 'desconocido',
        referencia: null,
      },
      { status: 500 }
    );
  }
}
