import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';

const TABS = {
    personal: [
        { key: 'chats', label: 'Chats', icon: 'chatbubbles' },
        { key: 'groups', label: 'Groups', icon: 'people' },
        { key: 'updates', label: 'Updates', icon: 'disc' },
        { key: 'calls', label: 'Calls', icon: 'call' },
        { key: 'settings', label: 'Menu', icon: 'grid' }
    ],
    work: [
        { key: 'home', label: 'Work', icon: 'briefcase' },
        { key: 'settings', label: 'Menu', icon: 'grid' }
    ],
    social: [
        { key: 'home', label: 'Home', icon: 'home' },
        { key: 'chats', label: 'Chats', icon: 'chatbubbles' },
        { key: 'reels', label: 'Reels', icon: 'play' },
        { key: 'profile', label: 'Profile', icon: 'person' },
        { key: 'settings', label: 'Menu', icon: 'grid' }
    ]
};

export default function BottomNavBar({ mode, activeTab, onTabPress, theme }) {
    const currentTabs = TABS[mode] || [];

    if (currentTabs.length === 0) return null;

    return (
        <View style={[styles.tabBar, { backgroundColor: theme.surface, borderTopColor: theme.outline || '#e0e0e0' }]}>
            {currentTabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                    <TabItem
                        key={`${mode}-${tab.key}`}
                        tab={tab}
                        isActive={isActive}
                        mode={mode}
                        theme={theme}
                        onPress={() => onTabPress(tab.key)}
                    />
                );
            })}
        </View >
    );
}

function TabItem({ tab, isActive, mode, theme, onPress }) {
    const activeAnim = useSharedValue(isActive ? 1 : 0);

    React.useEffect(() => {
        activeAnim.value = withSpring(isActive ? 1 : 0, {
            damping: 15,
            stiffness: 150,
        });
    }, [isActive]);

    const pillStyle = useAnimatedStyle(() => ({
        opacity: activeAnim.value,
        transform: [{ scale: 0.8 + (activeAnim.value * 0.2) }],
    }));

    const iconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: 1 + (activeAnim.value * 0.15) }],
    }));

    // Determine the highlight color based on mode and theme
    const highlightColor = mode === 'personal' ? '#00000015' : (theme.primary ? theme.primary + '20' : '#007AFF20');
    const activeContentColor = mode === 'personal' ? '#000000' : (theme.primary || '#007AFF');
    const inactiveContentColor = theme.textSecondary || '#8E8E93';

    return (
        <Pressable
            onPress={onPress}
            style={styles.tabItem}
        >
            <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                {/* Localized Animated Background Pill */}
                <Animated.View style={[
                    styles.localizedPill,
                    { backgroundColor: highlightColor },
                    pillStyle
                ]} />

                <Animated.View style={iconStyle}>
                    <Ionicons
                        name={`${tab.icon}${isActive ? '' : '-outline'}`}
                        size={24}
                        color={isActive ? activeContentColor : inactiveContentColor}
                    />
                </Animated.View>

                {/* Badge UI */}
                {tab.key === 'chats' && mode === 'personal' && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>85</Text>
                    </View>
                )}
                <Text style={[
                    styles.tabLabel,
                    {
                        color: isActive ? activeContentColor : inactiveContentColor,
                        fontWeight: isActive ? '700' : '500'
                    }
                ]}>
                    {tab.label}
                </Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
        height: Platform.OS === 'ios' ? 88 : 70,
        paddingBottom: Platform.OS === 'ios' ? 25 : 12,
        paddingTop: 8,
        width: '100%',
        borderTopWidth: 0.5,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'space-around',
        alignItems: 'center',
        elevation: 0,
        zIndex: 1000,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        position: 'relative',
    },
    tabLabel: {
        fontSize: 11,
        marginTop: 4,
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: 15, // Adjusted slightly since pill takes up space
        backgroundColor: '#25D366',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: '#fff',
        zIndex: 10,
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    localizedPill: {
        position: 'absolute',
        width: '80%', // Takes up 80% of the tab's width
        height: 44, // Slightly shorter than the 48 height before to fit nicely behind icon
        borderRadius: 16,
        top: -6, // Adjusted to perfectly center behind the icon
        zIndex: -1,
    }
});
