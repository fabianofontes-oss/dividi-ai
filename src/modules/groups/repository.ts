import { supabase } from '../../lib/supabase';
import { GroupDb, GroupDbSchema, GroupMemberDb } from './types';
import { ProfileDb, ProfileDbSchema } from '../auth/types';

export const groupsRepository = {
  async getGroupsByUserId(userId: string): Promise<{ groups: GroupDb[]; membersMap: Map<string, ProfileDb[]> }> {
    const { data: memberships, error: membershipError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('profile_id', userId);

    if (membershipError) throw membershipError;

    const groupIds = memberships?.map(m => m.group_id) || [];

    if (groupIds.length === 0) {
      return { groups: [], membersMap: new Map() };
    }

    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds);

    if (groupsError) throw groupsError;

    const groups = (groupsData || []).map(g => GroupDbSchema.parse(g));

    const { data: allMembersData, error: allMembersError } = await supabase
      .from('group_members')
      .select(`
        group_id,
        profile:profiles(*)
      `)
      .in('group_id', groupIds);

    if (allMembersError) throw allMembersError;

    const membersMap = new Map<string, ProfileDb[]>();
    allMembersData?.forEach((item: { group_id: string; profile: unknown }) => {
      const groupId = item.group_id;
      const profile = ProfileDbSchema.parse(item.profile);
      
      if (!membersMap.has(groupId)) {
        membersMap.set(groupId, []);
      }
      membersMap.get(groupId)!.push(profile);
    });

    return { groups, membersMap };
  },

  async getGroupById(groupId: string, userId: string): Promise<{ group: GroupDb; members: ProfileDb[] } | null> {
    const isMember = await this.isUserMemberOfGroup(groupId, userId);
    if (!isMember) throw new Error('Acesso negado ao grupo');

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError) throw groupError;
    if (!groupData) return null;

    const group = GroupDbSchema.parse(groupData);

    const { data: membersData, error: membersError } = await supabase
      .from('group_members')
      .select(`
        profile:profiles(*)
      `)
      .eq('group_id', groupId);

    if (membersError) throw membersError;

    const members = (membersData || []).map((item: { profile: unknown }) => 
      ProfileDbSchema.parse(item.profile)
    );

    return { group, members };
  },

  async createGroup(
    name: string,
    type: string,
    currency: string,
    createdBy: string,
    dates?: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('groups')
      .insert({
        name,
        type,
        currency,
        created_by: createdBy,
        dates: dates || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  },

  async addMembersToGroup(groupId: string, memberIds: string[], role: 'owner' | 'admin' | 'member' = 'member'): Promise<void> {
    const membersPayload = memberIds.map(profileId => ({
      group_id: groupId,
      profile_id: profileId,
      role,
    }));

    const { error } = await supabase
      .from('group_members')
      .insert(membersPayload);

    if (error) throw error;
  },

  async updateGroup(groupId: string, updates: Partial<GroupDb>): Promise<void> {
    const { error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', groupId);

    if (error) throw error;
  },

  async removeMemberFromGroup(groupId: string, profileId: string): Promise<void> {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('profile_id', profileId);

    if (error) throw error;
  },

  async isUserMemberOfGroup(groupId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('profile_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },

  async isUserAdminOfGroup(groupId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('profile_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data?.role === 'owner' || data?.role === 'admin';
  },
};
