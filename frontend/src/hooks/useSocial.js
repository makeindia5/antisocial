import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communityService } from '../services/communityService';
import { reelsService } from '../services/reelsService';

export const useSocial = () => {
    const queryClient = useQueryClient();

    // --- Queries ---

    const useFeed = (userId) => {
        return useQuery({
            queryKey: ['feed', userId],
            queryFn: () => communityService.fetchFeed(userId),
        });
    };

    const useReels = () => {
        return useQuery({
            queryKey: ['reels'],
            queryFn: () => reelsService.fetchReels(),
        });
    };

    const useExplore = () => {
        return useQuery({
            queryKey: ['explore'],
            queryFn: () => communityService.fetchExplore(),
        });
    };

    const useCommunities = (userId) => {
        return useQuery({
            queryKey: ['communities', userId],
            queryFn: () => communityService.fetchCommunities(userId),
            enabled: !!userId,
        });
    };

    const useStatuses = () => {
        return useQuery({
            queryKey: ['statuses'],
            queryFn: () => communityService.fetchStatuses(),
        });
    };

    // --- Mutations ---

    const createPostMutation = useMutation({
        mutationFn: communityService.createPost,
        onSuccess: () => {
            queryClient.invalidateQueries(['feed']);
        },
    });

    const likePostMutation = useMutation({
        mutationFn: ({ postId, userId }) => communityService.likePost(postId, userId),
        onSuccess: (data, variables) => {
            // Optimistic update could go here, but for now simple invalidation
            queryClient.invalidateQueries(['feed']);
        },
    });

    const commentPostMutation = useMutation({
        mutationFn: ({ postId, userId, text }) => communityService.commentPost(postId, userId, text),
        onSuccess: () => {
            queryClient.invalidateQueries(['feed']);
        },
    });

    // Reels Mutations
    const likeReelMutation = useMutation({
        mutationFn: ({ reelId, userId }) => reelsService.likeReel(reelId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries(['reels']);
        },
    });

    const commentReelMutation = useMutation({
        mutationFn: ({ reelId, userId, text }) => reelsService.commentReel(reelId, userId, text),
        onSuccess: () => {
            queryClient.invalidateQueries(['reels']);
        },
    });

    const deleteReelMutation = useMutation({
        mutationFn: ({ reelId, userId }) => reelsService.deleteReel(reelId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries(['reels']);
        },
    });

    const createCommunityMutation = useMutation({
        mutationFn: (data) => communityService.createCommunity(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['communities']);
        }
    });

    const deleteCommunityMutation = useMutation({
        mutationFn: (id) => communityService.deleteCommunity(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['communities']);
        }
    });

    const createStatusMutation = useMutation({
        mutationFn: (data) => communityService.createStatus(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['statuses']);
        }
    });

    const deleteStatusMutation = useMutation({
        mutationFn: (id) => communityService.deleteStatus(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['statuses']);
        }
    });

    const viewStatusMutation = useMutation({
        mutationFn: ({ statusId, userId }) => communityService.viewStatus(statusId, userId),
    });

    const uploadMediaMutation = useMutation({
        mutationFn: (formData) => communityService.uploadMedia(formData),
    });

    return {
        useFeed,
        useReels,
        useExplore,
        useCommunities,
        useStatuses,
        createPost: createPostMutation,
        likePost: likePostMutation,
        commentPost: commentPostMutation,
        likeReel: likeReelMutation,
        commentReel: commentReelMutation,
        deleteReel: deleteReelMutation,
        createCommunity: createCommunityMutation,
        deleteCommunity: deleteCommunityMutation,
        createStatus: createStatusMutation,
        deleteStatus: deleteStatusMutation,
        viewStatus: viewStatusMutation,
        uploadMedia: uploadMediaMutation,
    };
};
