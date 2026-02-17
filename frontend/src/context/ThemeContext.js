import React, { createContext, useState, useEffect, useContext } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors } from '../styles/theme';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const systemScheme = useColorScheme(); // 'light' or 'dark'
    const [themeMode, setThemeMode] = useState('system'); // 'light', 'dark', 'system'
    const [loaded, setLoaded] = useState(false);

    const [activeMode, setActiveMode] = useState('personal'); // 'personal', 'work', 'social'

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const stored = await AsyncStorage.getItem('appThemeMode');
            if (stored) {
                setThemeMode(stored);
            }
        } catch (e) {
            console.log("Theme load error", e);
        } finally {
            setLoaded(true);
        }
    };

    const setScheme = async (mode) => {
        setThemeMode(mode);
        try {
            await AsyncStorage.setItem('appThemeMode', mode);
        } catch (e) {
            console.log("Theme save error", e);
        }
    };

    // Calculate effective dark mode
    const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
    const colors = isDark ? DarkColors : LightColors;

    if (!loaded) return null;

    return (
        <ThemeContext.Provider value={{ isDark, themeMode, setScheme, colors, activeMode, setActiveMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
