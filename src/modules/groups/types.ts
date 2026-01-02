import { z } from 'zod';
import { UserSchema, CurrencyCodeSchema } from '../auth/types';

export const GroupTypeSchema = z.enum(['trip', 'home', 'event', 'couple', 'other']);

export const GroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Nome do grupo é obrigatório').max(100, 'Nome muito longo'),
  type: GroupTypeSchema,
  coverImage: z.string().url().optional(),
  members: z.array(UserSchema),
  currency: CurrencyCodeSchema,
  dates: z.string().optional(),
  created_by: z.string().uuid().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const GroupDbSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: GroupTypeSchema,
  cover_image: z.string().nullable(),
  currency: CurrencyCodeSchema,
  dates: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const GroupMemberDbSchema = z.object({
  id: z.string().uuid().optional(),
  group_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member']),
  created_at: z.string().optional(),
});

export const CreateGroupInputSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  type: GroupTypeSchema,
  currency: CurrencyCodeSchema,
  memberIds: z.array(z.string().uuid()).min(1, 'Grupo deve ter pelo menos um membro'),
  dates: z.string().optional(),
});

export const UpdateGroupInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  type: GroupTypeSchema.optional(),
  currency: CurrencyCodeSchema.optional(),
  memberIds: z.array(z.string().uuid()).optional(),
  dates: z.string().optional(),
});

export type GroupType = z.infer<typeof GroupTypeSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type GroupDb = z.infer<typeof GroupDbSchema>;
export type GroupMemberDb = z.infer<typeof GroupMemberDbSchema>;
export type CreateGroupInput = z.infer<typeof CreateGroupInputSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupInputSchema>;
