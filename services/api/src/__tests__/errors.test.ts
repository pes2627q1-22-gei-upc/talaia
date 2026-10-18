import express from 'express';
import request from 'supertest';
import { z } from 'zod';

import { errorHandler } from '../middleware/errors';

const Esquema = z.object({
  bbox: z.string().refine((v) => v.includes(','), { error: 'bbox ha de tenir 4 números' }),
  radi: z.number({ error: 'ha de ser un número' }),
});

const probe = express();
probe.get('/zod', () => Esquema.parse({ bbox: 'x', radi: 'y' }));
probe.use(errorHandler);

it('el 400 de validació llista els camps en una línia, sense el format de prettifyError', async () => {
  const res = await request(probe).get('/zod');
  expect(res.status).toBe(400);
  expect(res.body).toEqual({
    error: {
      code: 'validation_error',
      message: 'bbox ha de tenir 4 números; radi: ha de ser un número',
    },
  });
});
