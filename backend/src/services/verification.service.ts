import { query } from '../database/db';
import { CryptoService } from './crypto.service';
import { config } from '../config';
import {
  VerificationResponse,
  VerificationResultCode,
  CanonicalBatchPayload,
  CdscoNsqAlert,
} from '../types';

export interface VerifyOptions {
  serialId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class VerificationService {
  /**
   * Main verification engine executing all 12 checks with safety prioritization.
   */
  public static async verifyMedicine(options: VerifyOptions): Promise<VerificationResponse> {
    const { serialId, userId, ipAddress, userAgent } = options;
    const cleanSerialId = serialId.trim();

    const conditions: string[] = [];
    const warnings: string[] = [];
    let resultCode: VerificationResultCode = 'VERIFIED';
    let isVerified = false;
    let explanation = '';

    // 1. Check if the batch exists by serial_id
    const batchResult = await query(
      `SELECT 
        b.id as batch_id,
        b.serial_id,
        b.batch_number,
        TO_CHAR(b.manufacturing_date, 'YYYY-MM-DD') as manufacturing_date,
        TO_CHAR(b.expiry_date, 'YYYY-MM-DD') as expiry_date,
        b.revision_number,
        b.status as batch_status,
        m.id as medicine_id,
        m.medicine_name,
        m.brand_name,
        m.composition,
        m.strength,
        m.dosage_form,
        m.therapeutic_class,
        mfg.id as manufacturer_id,
        mfg.company_name,
        mfg.license_number,
        mfg.approval_status as manufacturer_status,
        ds.key_id,
        ds.canonical_payload,
        ds.signature_base64,
        ds.created_at as signed_at,
        mk.public_key_pem,
        mk.algorithm,
        mk.status as key_status
      FROM medicine_batches b
      JOIN medicines m ON b.medicine_id = m.id
      JOIN manufacturers mfg ON b.manufacturer_id = mfg.id
      LEFT JOIN digital_signatures ds ON b.id = ds.batch_id
      LEFT JOIN manufacturer_keys mk ON ds.key_id = mk.key_id
      WHERE b.serial_id = $1`,
      [cleanSerialId]
    );

    // If batch does not exist
    if (batchResult.rows.length === 0) {
      resultCode = 'NOT_REGISTERED';
      conditions.push('Serial ID not found in authorized pharmaceutical registry.');
      warnings.push('CRITICAL: This medicine serial ID is not registered in the VICTORY national repository.');
      explanation = 'The scanned code or serial ID does not correspond to any officially registered pharmaceutical batch. Exercise extreme caution as this product may be counterfeit, unapproved, or mislabeled.';

      await this.recordScan({
        batchId: undefined,
        serialId: cleanSerialId,
        userId,
        ipAddress,
        userAgent,
        scanStatus: resultCode,
        verificationMessage: explanation,
      });

      return {
        code: resultCode,
        is_verified: false,
        security_principle_disclaimer: config.securityPrincipleDisclaimer,
        conditions,
        explanation,
        warnings,
      };
    }

    const row = batchResult.rows[0];

    // 2. Validate Ed25519 Cryptographic Signature
    let signatureValid = false;
    if (row.public_key_pem && row.canonical_payload && row.signature_base64) {
      signatureValid = CryptoService.verifySignature(
        row.public_key_pem,
        row.canonical_payload,
        row.signature_base64
      );

      // Verify canonical integrity: reconstruct canonical payload from live batch attributes
      const expectedPayloadObj: CanonicalBatchPayload = {
        serial_id: row.serial_id,
        medicine_id: row.medicine_id,
        manufacturer_id: row.manufacturer_id,
        batch_number: row.batch_number,
        manufacturing_date: String(row.manufacturing_date),
        expiry_date: String(row.expiry_date),
        revision_number: Number(row.revision_number),
      };

      const expectedCanonical = CryptoService.canonicalizePayload(expectedPayloadObj);
      if (expectedCanonical !== row.canonical_payload) {
        signatureValid = false;
        warnings.push('Data Tamper Alert: Batch records in database do not match signed canonical cryptographic payload.');
      }
    }

    if (!signatureValid) {
      resultCode = 'INVALID_SIGNATURE';
      conditions.push('Cryptographic Ed25519 digital signature validation failed.');
      warnings.push('CRITICAL: Digital signature verification failed. The digital record may have been altered or forged.');
    } else {
      conditions.push('Digital signature is cryptographically valid and signed by authorized manufacturer key.');
    }

    // 3. Manufacturer Approval Status Check
    if (row.manufacturer_status !== 'approved') {
      conditions.push(`Manufacturer regulatory status is "${row.manufacturer_status}".`);
      warnings.push(`Manufacturer Alert: ${row.company_name} is currently ${row.manufacturer_status}. Only approved manufacturers are legitimate.`);
      if (resultCode === 'VERIFIED') {
        resultCode = 'SUSPENDED';
      }
    }

    // 4. Key Status Check
    if (row.key_status === 'revoked') {
      conditions.push('Signing cryptographic key has been revoked by regulatory authority.');
      warnings.push('Security Warning: The Ed25519 key used to sign this batch has been revoked.');
      if (resultCode === 'VERIFIED') {
        resultCode = 'REVOKED';
      }
    }

    // 5. Batch Status Check (Active, Suspended, Revoked)
    if (row.batch_status === 'revoked') {
      resultCode = 'REVOKED';
      conditions.push('This specific medicine batch has been formally revoked.');
      warnings.push('CRITICAL WARNING: Batch has been recalled/revoked from distribution.');
    } else if (row.batch_status === 'suspended') {
      if (resultCode === 'VERIFIED') {
        resultCode = 'SUSPENDED';
      }
      conditions.push('This medicine batch has been temporarily suspended by regulators or manufacturer.');
      warnings.push('Caution: Batch is currently under regulatory suspension.');
    }

    // 6. Expiry Date Check
    const expiryDateObj = new Date(row.expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isExpired = expiryDateObj < today;

    if (isExpired) {
      conditions.push(`Medicine expired on ${expiryDateObj.toISOString().split('T')[0]}.`);
      warnings.push(`EXPIRED MEDICINE: This batch expired on ${expiryDateObj.toLocaleDateString('en-IN')}. Do NOT consume.`);
      // If signature is valid, set code to EXPIRED
      if (signatureValid && resultCode === 'VERIFIED') {
        resultCode = 'EXPIRED';
      }
    }

    // 7. Duplicate Scan / Suspicious Velocity Check
    const scanStatsResult = await query(
      `SELECT 
        COUNT(*) as total_scans_24h,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '15 minutes' THEN 1 END) as recent_scans_15m
       FROM scan_history
       WHERE serial_id = $1`,
      [cleanSerialId]
    );

    const totalScans24h = parseInt(scanStatsResult.rows[0]?.total_scans_24h || '0', 10);
    const recentScans15m = parseInt(scanStatsResult.rows[0]?.recent_scans_15m || '0', 10);
    let suspiciousActivity = false;

    if (recentScans15m >= 5 || totalScans24h >= 20) {
      suspiciousActivity = true;
      conditions.push(`High scan velocity detected: ${recentScans15m} scans in last 15 minutes, ${totalScans24h} scans in last 24h.`);
      warnings.push('Suspicious Activity: This specific unit has been scanned unusually frequently. Possible QR duplication/cloning.');
      if (resultCode === 'VERIFIED') {
        resultCode = 'SUSPICIOUS_ACTIVITY';
      }
    }

    // 8. CDSCO NSQ Regulatory Alert Cross-Check
    const cdscoAlertsResult = await query(
      `SELECT 
        id, medicine_name, manufacturer_name, batch_number, alert_month_year,
        reported_quality_issue, source_url, publication_details, alert_status, import_date
       FROM cdsco_nsq_alerts
       WHERE alert_status = 'active'
         AND (
           batch_number = $1
           OR (
             LOWER(medicine_name) = LOWER($2) 
             AND (manufacturer_name IS NULL OR LOWER(manufacturer_name) = LOWER($3))
           )
         )`,
      [row.batch_number, row.medicine_name, row.company_name]
    );

    const nsqAlerts: CdscoNsqAlert[] = cdscoAlertsResult.rows;
    if (nsqAlerts.length > 0) {
      conditions.push(`Found ${nsqAlerts.length} matching CDSCO Not of Standard Quality (NSQ) regulatory alert(s).`);
      for (const alert of nsqAlerts) {
        warnings.push(`CDSCO NSQ ALERT: Reported quality failure: "${alert.reported_quality_issue}" (${alert.alert_month_year || 'Recent'}).`);
      }
      if (resultCode === 'VERIFIED') {
        resultCode = 'NSQ_ALERT';
      }
    }

    // Determine final is_verified status:
    // Only true when: signature is valid, manufacturer is approved, key is active, batch is active, not expired, and no NSQ alerts
    isVerified = 
      signatureValid &&
      row.manufacturer_status === 'approved' &&
      row.key_status === 'active' &&
      row.batch_status === 'active' &&
      !isExpired &&
      nsqAlerts.length === 0;

    // Compose human-readable explanation
    if (isVerified) {
      explanation = `The digital record for ${row.brand_name || row.medicine_name} (Batch: ${row.batch_number}) has been verified with a cryptographically valid Ed25519 signature from ${row.company_name}. All regulatory and expiry checks passed.`;
    } else {
      explanation = `Verification concluded with status "${resultCode}". Review the specific safety conditions and warnings displayed below before administering or distributing this medicine.`;
    }

    // Record this scan attempt into scan_history
    await this.recordScan({
      batchId: row.batch_id,
      serialId: cleanSerialId,
      userId,
      ipAddress,
      userAgent,
      scanStatus: resultCode,
      verificationMessage: explanation,
    });

    return {
      code: resultCode,
      is_verified: isVerified,
      security_principle_disclaimer: config.securityPrincipleDisclaimer,
      conditions,
      explanation,
      warnings,
      medicine: {
        medicine_name: row.medicine_name,
        brand_name: row.brand_name,
        composition: row.composition,
        strength: row.strength,
        dosage_form: row.dosage_form,
        therapeutic_class: row.therapeutic_class,
      },
      batch: {
        serial_id: row.serial_id,
        batch_number: row.batch_number,
        manufacturing_date: String(row.manufacturing_date),
        expiry_date: String(row.expiry_date),
        status: row.batch_status,
        revision_number: Number(row.revision_number),
        is_expired: isExpired,
      },
      manufacturer: {
        company_name: row.company_name,
        license_number: row.license_number,
        approval_status: row.manufacturer_status,
      },
      cryptography: {
        algorithm: row.algorithm || 'Ed25519',
        key_id: row.key_id || 'UNKNOWN',
        key_status: row.key_status || 'active',
        signature_valid: signatureValid,
        signed_at: row.signed_at ? new Date(row.signed_at).toISOString() : undefined,
      },
      alerts: {
        cdsco_nsq: nsqAlerts,
        suspicious_activity_detected: suspiciousActivity,
        scan_count_last_24h: totalScans24h + 1,
      },
    };
  }

  /**
   * Internal helper to record every scan event into the scan_history table.
   */
  private static async recordScan(data: {
    batchId?: string;
    serialId: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    scanStatus: string;
    verificationMessage: string;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO scan_history (
          batch_id, serial_id, user_id, ip_address, user_agent, scan_status, verification_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          data.batchId || null,
          data.serialId,
          data.userId || null,
          data.ipAddress ? data.ipAddress.slice(0, 64) : null,
          data.userAgent || null,
          data.scanStatus,
          data.verificationMessage,
        ]
      );
    } catch (err) {
      console.error('[VerificationService] Failed to record scan history:', err);
    }
  }
}
