import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { generateTokens, verifyRefreshToken } from '../services/tokenService';
import { sendOtpSms } from '../services/smsService';
import { generateOtp, verifyOtp } from '../services/otpService';
import { auditLog } from '../services/auditService';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const otpSchema = z.object({
  otp: z.string().length(6),
  tempToken: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (req, reply) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { userCompanyRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'Identifiants incorrects' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      await auditLog({ userId: user.id, action: 'LOGIN_FAILED', entityType: 'user', entityId: user.id, ipAddress: req.ip });
      return reply.code(401).send({ error: 'Identifiants incorrects' });
    }

    // If 2FA enabled, send OTP and return temp token
    if (user.twoFactorEnabled) {
      const tempToken = await generateTokens.temp(user.id, app);
      await sendOtpSms(user.phone!, await generateOtp(user.id));
      return reply.send({ requiresOtp: true, tempToken });
    }

    const { accessToken, refreshToken } = await generateTokens.full(user, app);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await auditLog({ userId: user.id, action: 'LOGIN_SUCCESS', entityType: 'user', entityId: user.id, ipAddress: req.ip });

    return reply.send({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  });

  app.post('/verify-otp', async (req, reply) => {
    const { otp, tempToken } = otpSchema.parse(req.body);

    const payload = await app.jwt.verify(tempToken) as { sub: string; type: string };
    if (payload.type !== 'temp') {
      return reply.code(401).send({ error: 'Token invalide' });
    }

    const valid = await verifyOtp(payload.sub, otp);
    if (!valid) {
      return reply.code(401).send({ error: 'Code OTP invalide ou expiré' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return reply.code(404).send({ error: 'Utilisateur introuvable' });

    const { accessToken, refreshToken } = await generateTokens.full(user, app);
    return reply.send({ accessToken, refreshToken });
  });

  app.post('/refresh', async (req, reply) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const userId = await verifyRefreshToken(refreshToken, app);
    if (!userId) {
      return reply.code(401).send({ error: 'Token de rafraîchissement invalide' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'Compte inactif' });
    }

    const tokens = await generateTokens.full(user, app);
    return reply.send(tokens);
  });

  app.post('/logout', { onRequest: [async (req) => { await req.jwtVerify(); }] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    await prisma.userSession.deleteMany({ where: { userId: payload.sub } });
    return reply.send({ success: true });
  });

  app.get('/me', { onRequest: [async (req) => { await req.jwtVerify(); }] }, async (req, reply) => {
    const payload = req.user as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userCompanyRoles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
            company: true,
          },
        },
      },
    });

    if (!user) return reply.code(404).send({ error: 'Utilisateur introuvable' });
    return reply.send(user);
  });

  app.post('/forgot-password', async (req, reply) => {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Always return 200 to avoid email enumeration
    if (user) {
      // TODO: send password reset email with token
    }
    return reply.send({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
  });

  app.post('/reset-password', async (req, reply) => {
    const { token, password } = resetSchema.parse(req.body);
    // TODO: verify reset token and update password
    const passwordHash = await bcrypt.hash(password, 12);
    return reply.send({ success: true });
  });
}
