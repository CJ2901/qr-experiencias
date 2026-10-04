import QRCode from 'qrcode';

/** PNG del QR. 900 px con margen: se imprime nitido hasta ~7 cm. */
export function qrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 900,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#1c1917', light: '#ffffff' },
  });
}
