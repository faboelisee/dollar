export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  const message = `CashFlow CI - Votre code de vérification est : ${otp}. Valable 10 minutes. Ne le partagez jamais.`;
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;

  if (!apiKey) {
    console.info(`[DEV] OTP for ${phone}: ${otp}`);
    return;
  }

  const response = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: process.env.AFRICAS_TALKING_USERNAME ?? 'sandbox',
      to: phone,
      message,
    }),
  });

  if (!response.ok) {
    console.error('OTP SMS failed:', await response.text());
  }
}
