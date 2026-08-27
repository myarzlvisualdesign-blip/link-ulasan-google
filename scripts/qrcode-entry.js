/* Titik masuk bundel vendor. Jalankan `npm run build:vendor` setelah menaikkan versi qrcode. */
import QRCode from 'qrcode/lib/browser.js';

export default QRCode;
export const toCanvas = QRCode.toCanvas;
export const toString = QRCode.toString;
export const toDataURL = QRCode.toDataURL;
export const create = QRCode.create;
