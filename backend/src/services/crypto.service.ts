import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { CanonicalBatchPayload } from '../types';

export class CryptoService {
  private static keysDir = config.keys.storageDir;

  /**
   * Ensure the keys directory exists with appropriate safety
   */
  public static ensureKeysDirectory(): void {
    if (!fs.existsSync(this.keysDir)) {
      fs.mkdirSync(this.keysDir, { recursive: true });
    }
  }

  /**
   * Deterministically canonicalize a batch payload.
   * Ensures identical JSON representation regardless of object key order.
   */
  public static canonicalizePayload(payload: CanonicalBatchPayload): string {
    const sortedKeys = Object.keys(payload).sort() as (keyof CanonicalBatchPayload)[];
    const canonicalObj: Record<string, any> = {};
    for (const key of sortedKeys) {
      canonicalObj[key] = String(payload[key]);
    }
    return JSON.stringify(canonicalObj);
  }

  /**
   * Generate an Ed25519 key pair for a manufacturer.
   * - Public key is formatted as SPKI PEM (stored in PostgreSQL).
   * - Private key is formatted as PKCS8 PEM and saved securely to disk in keys/ directory (NEVER stored in DB).
   */
  public static generateManufacturerKeyPair(manufacturerId: string): {
    keyId: string;
    publicKeyPem: string;
    privateKeyPath: string;
  } {
    this.ensureKeysDirectory();

    const timestamp = Date.now();
    const keyId = `KEY-${manufacturerId.slice(0, 8).toUpperCase()}-${timestamp}`;

    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const privateKeyFilename = `${keyId}.pem`;
    const privateKeyPath = path.join(this.keysDir, privateKeyFilename);

    // Save private key to secure local file storage
    fs.writeFileSync(privateKeyPath, privateKeyPem, { mode: 0o600, encoding: 'utf-8' });

    return {
      keyId,
      publicKeyPem,
      privateKeyPath,
    };
  }

  /**
   * Sign canonical batch payload using the manufacturer's Ed25519 private key.
   */
  public static signPayload(keyId: string, canonicalPayload: string): string {
    const privateKeyPath = path.join(this.keysDir, `${keyId}.pem`);

    if (!fs.existsSync(privateKeyPath)) {
      throw new Error(`Signing key "${keyId}" private key file not found on server.`);
    }

    const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf-8');
    const privateKey = crypto.createPrivateKey({
      key: privateKeyPem,
      format: 'pem',
    });

    const dataBuffer = Buffer.from(canonicalPayload, 'utf-8');
    const signature = crypto.sign(null, dataBuffer, privateKey);

    return signature.toString('base64');
  }

  /**
   * Verify an Ed25519 signature against canonical payload using the public key.
   */
  public static verifySignature(
    publicKeyPem: string,
    canonicalPayload: string,
    signatureBase64: string
  ): boolean {
    try {
      const publicKey = crypto.createPublicKey({
        key: publicKeyPem,
        format: 'pem',
      });

      const dataBuffer = Buffer.from(canonicalPayload, 'utf-8');
      const signatureBuffer = Buffer.from(signatureBase64, 'base64');

      return crypto.verify(null, dataBuffer, publicKey, signatureBuffer);
    } catch (err) {
      console.error('[CryptoService] Signature verification exception:', err);
      return false;
    }
  }

  /**
   * Check if private key exists for a given key ID on this node
   */
  public static hasPrivateKey(keyId: string): boolean {
    const privateKeyPath = path.join(this.keysDir, `${keyId}.pem`);
    return fs.existsSync(privateKeyPath);
  }
}
