import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/styles/theme';
import { Platform } from 'react-native';

export default function TabLayout() {
    return (
        <Tabs screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: Colors.secondary,
            tabBarInactiveTintColor: Colors.textLight,
            tabBarStyle: {
                backgroundColor: Colors.surface,
                borderTopColor: Colors.border,
                height: Platform.OS === 'ios' ? 85 : 60,
                paddingBottom: Platform.OS === 'ios' ? 30 : 10,
                paddingTop: 10,
                elevation: 8,
                shadowColor: '#000',
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
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />
                }}
            />
        </Tabs>
    );
}
