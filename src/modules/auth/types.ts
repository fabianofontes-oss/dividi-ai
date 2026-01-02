import { z } from 'zod';

export const UserPaymentHandleSchema = z.object({
  railId: z.string(),
  value: z.string(),
  isPrimary: z.boolean().optional(),
});

export const CurrencyCodeSchema = z.enum([
  'BRL', 'USD', 'EUR', 'CAD', 'CLP', 'GBP', 'INR', 'SGD', 'AUD', 'THB', 'SEK', 'PLN', 'MXN', 'PEN', 'COP'
]);

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email().optional(),
  avatar: z.string().url().optional(),
  defaultCurrency: CurrencyCodeSchema.optional(),
  activeCurrencies: z.array(CurrencyCodeSchema).optional(),
  paymentHandles: z.array(UserPaymentHandleSchema),
});

export const ProfileDbSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  avatar: z.string().nullable(),
  payment_handles: z.array(UserPaymentHandleSchema),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const LoginCredentialsSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const SignupCredentialsSchema = LoginCredentialsSchema.extend({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
});

export type UserPaymentHandle = z.infer<typeof UserPaymentHandleSchema>;
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;
export type User = z.infer<typeof UserSchema>;
export type ProfileDb = z.infer<typeof ProfileDbSchema>;
export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>;
export type SignupCredentials = z.infer<typeof SignupCredentialsSchema>;
