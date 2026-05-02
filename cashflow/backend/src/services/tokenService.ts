import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';
import type { User } from '@prisma/client';

const ACCESS_TOKEN_TTL = '2h';
const REFRESH_TOKEN_TTL = '30d';
const TEMP_TOKEN_TTL = '10m';

export const generateTokens = {
  full: async (user: User, app: FastifyInstance) => {
    const accessToken = app.jwt.sign(
      { sub: user.id, tenantId: null, type: 'access' },
      { expiresIn: ACCESS_TOKEN_TTL }
    );

    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');

    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  },

  temp: async (userId: string, app: FastifyInstance) => {
    return app.jwt.sign({ sub: userId, type: 'temp' }, { expiresIn: TEMP_TOKEN_TTL });
  },
};

export async function verifyRefreshToken(
  rawToken: string,
  app: FastifyInstance
): Promise<string | null> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.userSession.delete({ where: { tokenHash } });
    return null;
  }

  // Rotate refresh token
  await prisma.userSession.delete({ where: { tokenHash } });

  return session.userId;
}
