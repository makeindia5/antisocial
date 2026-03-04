import { apiClient } from './apiClient';

export const reelsService = {
    // Reels
    likeReel: async (reelId, userId) => {
        return await apiClient.post('/reels/like', { reelId, userId });
    },

    commentReel: async (reelId, userId, text) => {
        return await apiClient.post('/reels/comment', { reelId, userId, text });
    },

    deleteReel: async (reelId, userId) => {
        return await apiClient.post('/reels/delete', { reelId, userId });
    },

    fetchReels: async () => {
        return await apiClient.get('/reels');
    }
};
