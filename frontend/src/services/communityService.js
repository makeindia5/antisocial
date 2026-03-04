import { apiClient } from './apiClient';

export const communityService = {
    // Posts
    createPost: async (postData) => {
        // Multipart/form-data handling might be needed here, keeping logic simple for now or needing a special upload method in apiClient
        // For now, assuming JSON or handling upload separately.
        return await apiClient.post('/posts/create', postData);
    },

    likePost: async (postId, userId) => {
        return await apiClient.post('/posts/like', { postId, userId });
    },

    commentPost: async (postId, userId, text) => {
        return await apiClient.post('/posts/comment', { postId, userId, text });
    },

    fetchFeed: async (userId) => {
        // Assuming endpoint, usually /posts or /feed
        return await apiClient.get(`/posts/feed?userId=${userId}`);
    },

    fetchExplore: async () => {
        return await apiClient.get('/posts/explore');
    },

    fetchCommunities: async (userId) => {
        return await apiClient.get(`/community/list/${userId}`);
    },

    fetchStatuses: async () => {
        return await apiClient.get('/status/feed');
    },

    // Mutations
    createCommunity: async (communityData) => {
        return await apiClient.post('/community/create', communityData);
    },

    deleteCommunity: async (communityId) => {
        return await apiClient.delete(`/community/${communityId}`);
    },

    createStatus: async (statusData) => {
        return await apiClient.post('/status/create', statusData);
    },

    deleteStatus: async (statusId) => {
        return await apiClient.delete(`/status/${statusId}`);
    },

    viewStatus: async (statusId, userId) => {
        return await apiClient.post('/status/view', { statusId, userId });
    },

    uploadMedia: async (formData) => {
        return await apiClient.postForm('/upload', formData);
    }
};
