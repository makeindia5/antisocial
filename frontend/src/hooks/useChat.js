import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '../services/chatService';

export const useChat = () => {
    const queryClient = useQueryClient();

    // --- Queries ---

    const useUserDetails = (userId) => {
        return useQuery({
            queryKey: ['user', userId],
            queryFn: () => chatService.fetchUserDetails(userId),
            enabled: !!userId, // Only run if userId is provided
        });
    };

    const useUsers = (currentUserId) => {
        return useQuery({
            queryKey: ['users', currentUserId],
            queryFn: () => chatService.fetchUsers(currentUserId),
            enabled: !!currentUserId,
        });
    };

    const useGroups = (userId) => {
        return useQuery({
            queryKey: ['groups', userId],
            queryFn: () => chatService.fetchGroups(userId),
            enabled: !!userId,
        });
    };

    const useArchivedChats = (userId) => {
        return useQuery({
            queryKey: ['archivedChats', userId],
            queryFn: () => chatService.fetchArchivedChats(userId),
            enabled: !!userId,
        });
    };

    const useDeletedChats = (userId) => {
        return useQuery({
            queryKey: ['deletedChats', userId],
            queryFn: () => chatService.fetchDeletedChats(userId),
            enabled: !!userId,
        });
    };

    const useBlockedUsers = (userId) => {
        return useQuery({
            queryKey: ['blockedUsers', userId],
            queryFn: () => chatService.fetchBlockedUsers(userId),
            enabled: !!userId,
        });
    };

    // --- Mutations ---

    const archiveChatMutation = useMutation({
        mutationFn: ({ userId, chatId }) => chatService.archiveChat(userId, chatId),
        onSuccess: () => {
            queryClient.invalidateQueries(['chats']); // Assuming we have a chats query eventually
        },
    });

    const blockUserMutation = useMutation({
        mutationFn: ({ userId, targetId }) => chatService.blockUser(userId, targetId),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries(['user', variables.targetId]);
            queryClient.invalidateQueries(['chats']);
        },
    });

    const deleteChatMutation = useMutation({
        mutationFn: ({ user1, user2 }) => chatService.deleteChat(user1, user2),
        onSuccess: () => {
            queryClient.invalidateQueries(['chats']);
        },
    });

    const exitGroupMutation = useMutation({
        mutationFn: ({ userId, groupId }) => chatService.exitGroup(userId, groupId),
        onSuccess: () => {
            queryClient.invalidateQueries(['chats']);
        },
    });

    const updateStatusPrivacyMutation = useMutation({
        mutationFn: ({ userId, privacy, excluded, included }) => chatService.updateStatusPrivacy(userId, privacy, excluded, included),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries(['user', variables.userId]);
        },
    });

    const createGroupMutation = useMutation({
        mutationFn: (groupData) => chatService.createGroup(groupData),
        onSuccess: () => {
            queryClient.invalidateQueries(['groups']);
        }
    });

    const deleteGroupMutation = useMutation({
        mutationFn: (groupId) => chatService.deleteGroup(groupId),
        onSuccess: () => {
            queryClient.invalidateQueries(['groups']);
        }
    });

    const uploadAvatarMutation = useMutation({
        mutationFn: (formData) => chatService.uploadAvatar(formData),
        onSuccess: (data, variables) => {
            // We might need to invalidate user query or update local user profile
            // The component updates local state manually often.
            // Invalidating 'user' query might be good if we used it for profile.
        }
    });

    return {
        useUserDetails,
        useUsers,
        useGroups,
        useArchivedChats,
        useDeletedChats,
        useBlockedUsers,
        archiveChat: archiveChatMutation,
        blockUser: blockUserMutation,
        deleteChat: deleteChatMutation,
        exitGroup: exitGroupMutation,
        updateStatusPrivacy: updateStatusPrivacyMutation,
        createGroup: createGroupMutation,
        deleteGroup: deleteGroupMutation,
        uploadAvatar: uploadAvatarMutation,
    };
};
