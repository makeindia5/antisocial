
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { authRequest } from '../services/apiService';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [authInitialized, setAuthInitialized] = useState(false);
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        const loadUser = async () => {
            try {
                const storedUser = await AsyncStorage.getItem('user');
                const storedToken = await AsyncStorage.getItem('token'); // Assuming you store token separately or inside user object

                if (storedUser) {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    // If token is inside user object
                    if (parsedUser.token) setToken(parsedUser.token);
                    else if (storedToken) setToken(storedToken);
                }
            } catch (error) {
                console.error('Failed to load user', error);
            } finally {
                setIsLoading(false);
                setAuthInitialized(true);
            }
        };

        loadUser();
    }, []);

    // Protected Route Logic
    useEffect(() => {
        if (!authInitialized) return;

        const inAuthGroup = segments[0] === '(auth)';
        const inTabsGroup = segments[0] === '(tabs)';

        // If user is not logged in and not in auth group, redirect to login
        if (!user && !inAuthGroup) {
            // You might want to be careful here to not redirect if it's the splash screen or initial route
            // But for now, let's assume if no user, go to login.
            // However, index.jsx handles splash logic, so we might want to let handle it. 
            // Let's implement login/logout functions first and let individual screens or a separate hook handle protection for now 
            // to avoid infinite loops during refactor.
            console.log("Auth State Changed: No User");
        } else if (user && inAuthGroup) {
            // If user is logged in and in auth group, redirect to tabs
            // router.replace('/(tabs)/communityScreen');
            console.log("Auth State Changed: User Logged In");
        }
    }, [user, segments, authInitialized]);

    const login = async (email, password) => {
        setIsLoading(true);
        try {
            // ── Google Play reviewer bypass ──────────────────────────────────
            if (email === 'demo@intraa.com' && password === 'Demo@1234') {
                const reviewerUser = {
                    _id: 'reviewer_demo',
                    name: 'Demo User',
                    email: 'demo@intraa.com',
                    username: 'demo_intraa',
                    token: 'reviewer_bypass_token',
                    role: 'user',
                    profilePicture: null,
                };
                setUser(reviewerUser);
                setToken(reviewerUser.token);
                await AsyncStorage.setItem('user', JSON.stringify(reviewerUser));
                await AsyncStorage.setItem('token', reviewerUser.token);
                return { success: true };
            }
            // ────────────────────────────────────────────────────────────────

            const data = await authRequest('/login', { email, password });
            if (data.success || data.user) {
                const userData = data.user || data; // Adjust based on actual API response
                setUser(userData);
                setToken(userData.token);
                await AsyncStorage.setItem('user', JSON.stringify(userData));
                if (userData.token) await AsyncStorage.setItem('token', userData.token);
                return { success: true };
            } else {
                return { success: false, msg: data.message };
            }
        } catch (error) {
            return { success: false, msg: error.message };
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (userData) => {
        setIsLoading(true);
        try {
            // Registration usually returns success but might not auto-login depending on API
            // Adjust based on your API. Assuming it might return user or just success.
            const data = await authRequest('/register', userData);
            return data;
        } catch (error) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        try {
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('token');
            setUser(null);
            setToken(null);
            // Router replace to login is handled by the useEffect or manually
            router.replace('/(auth)/login');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, authInitialized }}>
            {children}
        </AuthContext.Provider>
    );
};
