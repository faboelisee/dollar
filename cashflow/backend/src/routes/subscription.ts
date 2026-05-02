import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const upgradSchema = z.object({
  planId: z.string().uuid(),
  paymentMethod: z.enum(['orange_money', 'mtn_momo', 'wave', 'card']),
  phone: z.string().optional(),
});

export async function subscriptionRoutes(app: FastifyInstance) {
  app.get('/plans', async (_req, reply) => {
    const plans = await prisma.plan.findMany({ orderBy: { monthlyPrice: 'asc' } });
    return reply.send({ items: plans });
  });

  app.get('/', { onRequest: [async (req) => { await req.jwtVerify(); }] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const user = await prisma.userCompanyRole.findFirst({
      where: { userId: payload.sub },
      include: { company: { include: { tenant: { include: { subscription: { include: { plan: true } } } } } } },
    });

    if (!user?.company?.tenant?.subscription) {
      return reply.code(404).send({ error: 'Abonnement introuvable' });
    }

    return reply.send(user.company.tenant.subscription);
  });

  app.post('/upgrade', { onRequest: [async (req) => { await req.jwtVerify(); }] }, async (req, reply) => {
    const { planId, paymentMethod, phone } = upgradSchema.parse(req.body);

    // TODO: initiate payment via CinetPay / Orange Money / MTN MoMo
    // For now, return payment initiation info
    return reply.send({
      paymentInitiated: true,
      message: `Paiement via ${paymentMethod} initié. Veuillez confirmer sur votre téléphone.`,
      redirectUrl: null,
    });
  });

  app.post('/pay/mobile', async (req, reply) => {
    const { amount, method, phone } = req.body as { amount: number; method: string; phone: string };

    // CinetPay integration
    const cinetpayPayload = {
      apikey: process.env.CINETPAY_API_KEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: `CF-${Date.now()}`,
      amount,
      currency: 'XOF',
      description: 'Abonnement CashFlow CI',
      customer_phone_number: phone,
      channels: method === 'orange_money' ? 'OM' : method === 'mtn_momo' ? 'MOMO' : 'WAVE',
    };

    return reply.send({
      transactionId: cinetpayPayload.transaction_id,
      status: 'pending',
      message: 'Vérifiez votre téléphone pour confirmer le paiement',
    });
  });
}
