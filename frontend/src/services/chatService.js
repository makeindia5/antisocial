import { apiClient } from './apiClient';

export const chatService = {
    // Chat Management
    archiveChat: async (userId, chatId) => {
        return await apiClient.post('/chat/archive', { userId, chatId });
    },

    deleteChat: async (user1, user2) => {
        return await apiClient.post('/messages/clear', { user1, user2 });
    },

    exitGroup: async (userId, groupId) => {
        return await apiClient.post(`/chat/group/remove/${groupId}`, { userId });
    },

    // User Privacy & Blocking
    blockUser: async (userId, targetId) => {
        return await apiClient.post('/social/block', { userId, targetId });
    },

    fetchUserDetails: async (userId) => {
        return await apiClient.get(`/user/details/${userId}`);
    },

    updateStatusPrivacy: async (userId, privacy, excluded, included) => {
        return await apiClient.post('/user/status/privacy', {
            userId,
            privacy,
            excluded,
            included
        });
    },

    // Fetch Lists
    fetchUsers: async (currentUserId) => {
        return await apiClient.get(`/community/users?currentUserId=${currentUserId}`);
    },

    fetchGroups: async (userId) => {
        return await apiClient.get(`/chat/groups/${userId}`);
    },

    fetchArchivedChats: async (userId) => {
        return await apiClient.get(`/chat/archived/${userId}`);
    },

    fetchDeletedChats: async (userId) => {
        return await apiClient.get(`/chat/deleted/${userId}`);
    },

    fetchBlockedUsers: async (userId) => {
        return await apiClient.get(`/social/blocked/${userId}`);
    },

    // Mutations
    createGroup: async (groupData) => {
        return await apiClient.post('/chat/group/create', groupData);
    },

    deleteGroup: async (groupId) => {
        return await apiClient.delete(`/chat/group/${groupId}`);
    },

    uploadAvatar: async (formData) => {
        return await apiClient.postForm('/upload-avatar', formData);
    }
};
