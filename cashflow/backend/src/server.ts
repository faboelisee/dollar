import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { Server } from 'socket.io';
import { createServer } from 'http';

import { authRoutes } from './routes/auth';
import { operationsRoutes } from './routes/operations';
import { cashRegistersRoutes } from './routes/cashRegisters';
import { contactsRoutes } from './routes/contacts';
import { bankRoutes } from './routes/bank';
import { accountingRoutes } from './routes/accounting';
import { reportsRoutes } from './routes/reports';
import { employeesRoutes } from './routes/employees';
import { dashboardRoutes } from './routes/dashboard';
import { subscriptionRoutes } from './routes/subscription';
import { ocrRoutes } from './routes/ocr';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

const PORT = Number(process.env.PORT ?? 4000);
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

async function build() {
  const app = Fastify({ logger: { level: 'info' }, trustProxy: true });

  // Plugins
  await app.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  await app.register(jwt, { secret: JWT_SECRET });

  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Trop de requêtes. Veuillez patienter.',
    }),
  });

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // Public routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(subscriptionRoutes, { prefix: '/api/v1/subscription' });

  // Protected routes (require JWT)
  await app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', authMiddleware);

    await protectedApp.register(dashboardRoutes, { prefix: '/companies' });
    await protectedApp.register(operationsRoutes, { prefix: '/operations' });
    await protectedApp.register(cashRegistersRoutes, { prefix: '/cash-registers' });
    await protectedApp.register(contactsRoutes, { prefix: '/contacts' });
    await protectedApp.register(bankRoutes, { prefix: '/bank-accounts' });
    await protectedApp.register(accountingRoutes, { prefix: '/accounting' });
    await protectedApp.register(reportsRoutes, { prefix: '/reports' });
    await protectedApp.register(employeesRoutes, { prefix: '/employees' });
    await protectedApp.register(ocrRoutes, { prefix: '/ocr' });
  }, { prefix: '/api/v1' });

  return app;
}

async function start() {
  const app = await build();
  const httpServer = createServer(app.server);

  // WebSocket for real-time updates
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join:company', (companyId: string) => {
      socket.join(`company:${companyId}`);
    });

    socket.on('leave:company', (companyId: string) => {
      socket.leave(`company:${companyId}`);
    });
  });

  // Expose io for use in routes
  app.decorate('io', io);

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`CashFlow CI API running on port ${PORT}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
