import { z } from "zod";

export const paymentRequestSchema = z.object({
  planId: z.string().uuid(),
  senderName: z.string().trim().min(2).max(120),
  senderNumber: z.string().trim().min(6).max(32).regex(/^[+0-9 -]+$/),
  transactionId: z.string().trim().min(4).max(80).regex(/^[A-Za-z0-9_-]+$/),
  referenceNumber: z.string().trim().max(120).nullable(),
  paymentAt: z.string().datetime(),
  note: z.string().trim().max(500).nullable(),
  termsConfirmed: z.literal(true),
  idempotencyKey: z.string().uuid(),
});

export type PaymentRequestInput = z.infer<typeof paymentRequestSchema>;
