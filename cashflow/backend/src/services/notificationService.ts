import { prisma } from '../lib/prisma';
import type { AlertType, AlertSeverity } from '@prisma/client';

interface NotificationPayload {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function notifyCompany(
  companyId: string,
  payload: NotificationPayload
): Promise<void> {
  await prisma.alert.create({
    data: {
      companyId,
      userId: payload.userId,
      type: payload.type,
      severity: payload.severity,
      message: payload.message,
      metadata: payload.metadata ?? {},
    },
  });

  // TODO: trigger push notification, SMS, WhatsApp, email based on user preferences
}

export async function sendSmsAlert(phone: string, message: string): Promise<void> {
  // Integration with Africa's Talking or Orange CI API
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;
  if (!apiKey) return;

  try {
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
        from: process.env.SMS_SENDER_ID ?? 'CashFlowCI',
      }),
    });
    if (!response.ok) {
      console.error('SMS send failed:', await response.text());
    }
  } catch (err) {
    console.error('SMS service error:', err);
  }
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return;

  try {
    await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/\D/g, ''),
        type: 'text',
        text: { body: message },
      }),
    });
  } catch (err) {
    console.error('WhatsApp service error:', err);
  }
}
