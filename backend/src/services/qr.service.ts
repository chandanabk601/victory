import QRCode from 'qrcode';
import { config } from '../config';

export class QrService {
  /**
   * Constructs the canonical public verification URL for a given serial ID.
   */
  public static getVerificationUrl(serialId: string): string {
    return `${config.frontendUrl}/verify/${serialId}`;
  }

  /**
   * Generates a QR Code as Data URL (base64 image/png) containing the verification URL.
   */
  public static async generateQrDataUrl(serialId: string): Promise<string> {
    const url = this.getVerificationUrl(serialId);
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  }

  /**
   * Generates a QR Code as Buffer (PNG image) for direct download.
   */
  public static async generateQrBuffer(serialId: string): Promise<Buffer> {
    const url = this.getVerificationUrl(serialId);
    return await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 600,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  }
}
