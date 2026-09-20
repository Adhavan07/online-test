import crypto from 'crypto';

/**
 * Hash a password using scrypt with a cryptographic salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verify a plain password against a stored scrypt hash in constant time
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false;
  }
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;

  try {
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKeyBuffer = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKeyBuffer);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure 6-digit numeric OTP code
 */
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash an OTP code using salted scrypt
 */
export function hashOtp(otp: string): string {
  return hashPassword(otp);
}

/**
 * Verify an OTP code against stored scrypt hash
 */
export function verifyOtpCode(otp: string, storedHash: string | null | undefined): boolean {
  return verifyPassword(otp, storedHash);
}
