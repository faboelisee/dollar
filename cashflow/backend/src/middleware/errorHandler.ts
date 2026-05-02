import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  request.log.error(error);

  if (error instanceof ZodError) {
    reply.code(422).send({
      statusCode: 422,
      error: 'Validation Error',
      message: 'Données invalides',
      details: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      reply.code(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'Cette valeur existe déjà',
      });
      return;
    }
    if (error.code === 'P2025') {
      reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Ressource introuvable',
      });
      return;
    }
  }

  const statusCode = error.statusCode ?? 500;
  reply.code(statusCode).send({
    statusCode,
    error: error.name ?? 'Internal Server Error',
    message: statusCode === 500 ? 'Une erreur interne est survenue' : error.message,
  });
}
