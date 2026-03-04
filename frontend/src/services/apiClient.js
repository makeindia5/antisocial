import AsyncStorage from '@react-native-async-storage/async-storage';

// const BASE_URL = "https://gurudipaksalviprivatelimited.com/api/auth"; // Development
const BASE_URL = "https://gurudipaksalviprivatelimited.com/api/auth"; // Production

const getHeaders = async () => {
    const token = await AsyncStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

export const apiClient = {
    get: async (endpoint) => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'GET',
                headers,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'API Error');
            return data;
        } catch (error) {
            console.error(`[GET] ${endpoint} Error:`, error);
            throw error;
        }
    },

    post: async (endpoint, body) => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'API Error');
            return data;
        } catch (error) {
            console.error(`[POST] ${endpoint} Error:`, error);
            throw error;
        }
    },

    put: async (endpoint, body) => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'API Error');
            return data;
        } catch (error) {
            console.error(`[PUT] ${endpoint} Error:`, error);
            throw error;
        }
    },

    delete: async (endpoint) => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'DELETE',
                headers,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'API Error');
            return data;
        } catch (error) {
            console.error(`[DELETE] ${endpoint} Error:`, error);
            throw error;
        }
    },

    postForm: async (endpoint, formData) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const headers = {
                // Content-Type for multipart/form-data is usually handled automatically by fetch when body is FormData
                // But we need Authorization
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            // Explicitly NOT setting Content-Type to multipart/form-data here because fetch/FormData does it with boundary

            const res = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'API Error');
            return data;
        } catch (error) {
            console.error(`[POST FORM] ${endpoint} Error:`, error);
            throw error;
        }
    }
};

export const API_BASE = BASE_URL;
