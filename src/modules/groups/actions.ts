import { groupsRepository } from './repository';
import { CreateGroupInputSchema, UpdateGroupInputSchema, Group } from './types';
import { mapProfileToUser } from '../auth/repository';
import { ZodError } from 'zod';

export const groupsActions = {
  async getGroupsByUser(userId: string): Promise<{ groups: Group[]; error: null } | { groups: null; error: string }> {
    try {
      const { groups: groupsDb, membersMap } = await groupsRepository.getGroupsByUserId(userId);

      const groups: Group[] = groupsDb.map(g => ({
        id: g.id,
        name: g.name,
        type: g.type,
        currency: g.currency,
        coverImage: g.cover_image || undefined,
        dates: g.dates || undefined,
        members: (membersMap.get(g.id) || []).map(mapProfileToUser),
        created_by: g.created_by || undefined,
        created_at: g.created_at,
        updated_at: g.updated_at,
      }));

      return { groups, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { groups: null, error: error.message };
      }
      return { groups: null, error: 'Erro ao carregar grupos' };
    }
  },

  async getGroupById(groupId: string, userId: string): Promise<{ group: Group; error: null } | { group: null; error: string }> {
    try {
      const result = await groupsRepository.getGroupById(groupId, userId);
      
      if (!result) {
        return { group: null, error: 'Grupo não encontrado' };
      }

      const group: Group = {
        id: result.group.id,
        name: result.group.name,
        type: result.group.type,
        currency: result.group.currency,
        coverImage: result.group.cover_image || undefined,
        dates: result.group.dates || undefined,
        members: result.members.map(mapProfileToUser),
        created_by: result.group.created_by || undefined,
        created_at: result.group.created_at,
        updated_at: result.group.updated_at,
      };

      return { group, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { group: null, error: error.message };
      }
      return { group: null, error: 'Erro ao carregar grupo' };
    }
  },

  async createGroup(
    input: unknown,
    currentUserId: string
  ): Promise<{ groupId: string; error: null } | { groupId: null; error: string }> {
    try {
      const validated = CreateGroupInputSchema.parse(input);

      const groupId = await groupsRepository.createGroup(
        validated.name,
        validated.type,
        validated.currency,
        currentUserId,
        validated.dates
      );

      const uniqueMemberIds = Array.from(new Set([currentUserId, ...validated.memberIds]));
      
      await groupsRepository.addMembersToGroup(
        groupId,
        uniqueMemberIds,
        'member'
      );

      return { groupId, error: null };
    } catch (error) {
      if (error instanceof ZodError) {
        return { groupId: null, error: error.issues[0].message };
      }
      if (error instanceof Error) {
        return { groupId: null, error: error.message };
      }
      return { groupId: null, error: 'Erro ao criar grupo' };
    }
  },

  async updateGroup(
    input: unknown,
    currentUserId: string
  ): Promise<{ success: true; error: null } | { success: false; error: string }> {
    try {
      const validated = UpdateGroupInputSchema.parse(input);

      const isAdmin = await groupsRepository.isUserAdminOfGroup(validated.id, currentUserId);
      if (!isAdmin) {
        return { success: false, error: 'Apenas administradores podem editar o grupo' };
      }

      const updates: Record<string, unknown> = {};
      if (validated.name) updates.name = validated.name;
      if (validated.type) updates.type = validated.type;
      if (validated.currency) updates.currency = validated.currency;
      if (validated.dates !== undefined) updates.dates = validated.dates || null;

      if (Object.keys(updates).length > 0) {
        await groupsRepository.updateGroup(validated.id, updates);
      }

      if (validated.memberIds) {
        const { group, members } = await groupsRepository.getGroupById(validated.id, currentUserId) || { group: null, members: [] };
        
        if (group && members) {
          const currentMemberIds = members.map(m => m.id);
          const newMemberIds = validated.memberIds.filter(id => !currentMemberIds.includes(id));
          const removedMemberIds = currentMemberIds.filter(id => !validated.memberIds!.includes(id));

          for (const memberId of newMemberIds) {
            await groupsRepository.addMembersToGroup(validated.id, [memberId], 'member');
          }

          for (const memberId of removedMemberIds) {
            if (memberId !== currentUserId) {
              await groupsRepository.removeMemberFromGroup(validated.id, memberId);
            }
          }
        }
      }

      return { success: true, error: null };
    } catch (error) {
      if (error instanceof ZodError) {
        return { success: false, error: error.issues[0].message };
      }
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Erro ao atualizar grupo' };
    }
  },

  async removeMember(
    groupId: string,
    memberId: string,
    currentUserId: string
  ): Promise<{ success: true; error: null } | { success: false; error: string }> {
    try {
      const isAdmin = await groupsRepository.isUserAdminOfGroup(groupId, currentUserId);
      const isSelf = memberId === currentUserId;

      if (!isAdmin && !isSelf) {
        return { success: false, error: 'Sem permissão para remover membro' };
      }

      await groupsRepository.removeMemberFromGroup(groupId, memberId);
      return { success: true, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Erro ao remover membro' };
    }
  },
};
