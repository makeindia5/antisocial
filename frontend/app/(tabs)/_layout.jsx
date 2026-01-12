import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { Platform } from 'react-native';

export default function TabLayout() {
    const { colors } = useTheme();
    const theme = colors || Colors;

    return (
        <Tabs screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.secondary,
            tabBarInactiveTintColor: theme.textSecondary || theme.textLight,
            tabBarStyle: {
                display: 'none',
                backgroundColor: theme.surface,
                borderTopColor: theme.border,
                height: Platform.OS === 'ios' ? 85 : 60,
                paddingBottom: Platform.OS === 'ios' ? 30 : 10,
                paddingTop: 10,
                elevation: 8,
                shadowColor: theme.shadow,
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            tabBarLabelStyle: {
                fontWeight: '600',
                fontSize: 10
            }
        }}>
            <Tabs.Screen
                name="communityScreen"
                options={{
                    title: '',
                    tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />
                }}
            />
        </Tabs>
    );
}
