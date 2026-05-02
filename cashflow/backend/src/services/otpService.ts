import crypto from 'crypto';

// In-memory OTP store (use Redis in production)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

export async function generateOtp(userId: string): Promise<string> {
  const otp = crypto.randomInt(100000, 999999).toString();
  otpStore.set(userId, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  return otp;
}

export async function verifyOtp(userId: string, otp: string): Promise<boolean> {
  const stored = otpStore.get(userId);
  if (!stored) return false;
  if (stored.expiresAt < Date.now()) {
    otpStore.delete(userId);
    return false;
  }
  if (stored.otp !== otp) return false;
  otpStore.delete(userId);
  return true;
}
