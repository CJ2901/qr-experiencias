import { MARCA } from '@/lib/marca';

/**
 * Los correos, en HTML de tablas con estilos en linea: es lo unico que
 * Gmail, Outlook y Apple Mail pintan igual. Nada de CSS externo ni SVG.
 * Todo texto que viene del cliente pasa por `esc`.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function marco(contenido: string, pie: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#292524">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="padding:28px 32px 8px;font-size:15px;font-weight:700;letter-spacing:.02em;color:#1c1917">${MARCA}</td></tr>
<tr><td style="padding:8px 32px 32px">${contenido}</td></tr>
</table>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#78716c">${pie}</p>
</td></tr></table></body></html>`;
}

function boton(url: string, texto: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr>
<td style="background:#9f1239;border-radius:12px"><a href="${esc(url)}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${texto}</a></td>
</tr></table>`;
}

export function correoEnlace(d: { url: string; plantilla: string }) {
  const asunto = 'Tu dedicatoria te espera';
  const html = marco(
    `<h1 style="margin:0;font-size:22px;line-height:1.3;color:#1c1917">Ya está pagado. Ahora viene lo bonito.</h1>
<p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#44403c">Compraste la plantilla <strong>${esc(d.plantilla)}</strong>. Con este enlace escribes la carta y subes tus fotos, a tu ritmo: se guarda solo.</p>
${boton(d.url, 'Escribir mi dedicatoria')}
<p style="margin:0;font-size:13px;line-height:1.6;color:#78716c">Este enlace es personal: quien lo tenga puede editar tu regalo hasta que lo publiques. No lo reenvíes.</p>`,
    `Si el botón no funciona, copia esta dirección en tu navegador:<br>${esc(d.url)}`
  );
  const texto = `Ya está pagado. Escribe tu dedicatoria aquí:\n${d.url}\n\nEste enlace es personal: no lo reenvíes.`;
  return { asunto, html, texto };
}

export function correoPublicado(d: { url: string; urlQr: string; destinatario: string }) {
  const para = d.destinatario.trim() || 'esa persona';
  const asunto = `El regalo para ${para} ya está listo`;
  const html = marco(
    `<h1 style="margin:0;font-size:22px;line-height:1.3;color:#1c1917">El regalo para ${esc(para)} ya está listo</h1>
<p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#44403c">Imprime este código o envía el enlace. Al escanearlo, se abre todo lo que escribiste.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto"><tr><td align="center" style="padding:16px;border:1px solid #e7e5e4;border-radius:16px">
<img src="${esc(d.urlQr)}" width="220" height="220" alt="Código QR del regalo" style="display:block;width:220px;height:220px">
</td></tr></table>
${boton(d.url, 'Ver el regalo')}
<p style="margin:0;font-size:13px;line-height:1.6;color:#78716c">Adjuntamos el QR en alta calidad para imprimir. El enlace funciona durante 5 años.</p>`,
    `Enlace del regalo:<br>${esc(d.url)}`
  );
  const texto = `El regalo para ${para} ya está listo.\n\nEnlace: ${d.url}\n\nAdjuntamos el QR para imprimir. Funciona durante 5 años.`;
  return { asunto, html, texto };
}

export function correoReenvio(d: { enlaces: { titulo: string; url: string }[] }) {
  const asunto = 'Tus enlaces de Dile.pe';
  const lista = d.enlaces
    .map(
      (e) =>
        `<tr><td style="padding:10px 0;border-top:1px solid #f5f5f4;font-size:14px"><a href="${esc(e.url)}" style="color:#9f1239;font-weight:600">${esc(e.titulo)}</a></td></tr>`
    )
    .join('');
  const html = marco(
    `<h1 style="margin:0;font-size:20px;color:#1c1917">Aquí están tus enlaces</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">${lista}</table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#78716c">Los enlaces para editar son personales: no los reenvíes.</p>`,
    'Si no pediste este correo, puedes ignorarlo.'
  );
  const texto = d.enlaces.map((e) => `${e.titulo}: ${e.url}`).join('\n');
  return { asunto, html, texto };
}
