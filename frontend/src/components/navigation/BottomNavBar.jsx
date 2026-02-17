import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
        { key: 'create', label: 'Create', icon: 'add-circle' },
        { key: 'reels', label: 'Reels', icon: 'play' },
        { key: 'profile', label: 'Profile', icon: 'person' },
        { key: 'settings', label: 'Menu', icon: 'grid' }
    ]
};

import { useWindowDimensions } from 'react-native';

export default function BottomNavBar({ mode, activeTab, onTabPress, theme }) {
    const currentTabs = TABS[mode] || [];
    const indicatorAnim = React.useRef(new Animated.Value(0)).current;
    const { width } = useWindowDimensions(); // Reactive width

    React.useEffect(() => {
        const index = currentTabs.findIndex(t => t.key === activeTab);
        if (index !== -1) {
            Animated.spring(indicatorAnim, {
                toValue: index,
                useNativeDriver: false, // Essential for Web
                friction: 12,
                tension: 60
            }).start();
        }
    }, [activeTab, currentTabs, indicatorAnim]);

    if (currentTabs.length === 0) return null;

    const TAB_WIDTH = width / currentTabs.length;

    return (
        <View style={[styles.tabBar, { backgroundColor: theme.surface, borderTopColor: theme.outline || '#e0e0e0' }]}>
            {/* Sliding Indicator Background */}
            <Animated.View style={[
                styles.slidingIndicator,
                {
                    width: TAB_WIDTH * 0.6,
                    backgroundColor: mode === 'personal' ? '#00000015' : theme.primary + '15',
                    transform: [{
                        translateX: indicatorAnim.interpolate({
                            inputRange: currentTabs.map((_, i) => i),
                            outputRange: currentTabs.map((_, i) => (i * TAB_WIDTH) + (TAB_WIDTH * 0.2))
                        })
                    }]
                }
            ]} />

            {currentTabs.map((tab, index) => {
                const isActive = activeTab === tab.key;

                return (
                    <Pressable
                        key={tab.key}
                        onPress={() => onTabPress(tab.key)}
                        style={({ pressed }) => [
                            styles.tabItem,
                            pressed && { opacity: 0.7 }
                        ]}
                    >
                        <View>
                            <Animated.View style={{ transform: [{ scale: isActive ? 1.15 : 1 }] }}>
                                <Ionicons
                                    name={`${tab.icon}-outline`}
                                    size={26}
                                    color={isActive ? (mode === 'personal' ? '#000000' : theme.primary) : theme.textSecondary || '#8E8E93'}
                                />
                            </Animated.View>
                            {/* Example Badge UI */}
                            {tab.key === 'chats' && mode === 'personal' && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>85</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[
                            styles.tabLabel,
                            { color: isActive ? (mode === 'personal' ? '#000000' : theme.primary) : theme.textSecondary || '#8E8E93' }
                        ]}>
                            {tab.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View >
    );
}

const styles = StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
        height: Platform.OS === 'ios' ? 85 : 65,
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        paddingTop: 10,
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
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    tabLabel: {
        fontSize: 10,
        marginTop: 4,
        fontWeight: '500',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -8,
        backgroundColor: '#25D366', // WhatsApp green or theme.primary
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: '#fff'
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    slidingIndicator: {
        position: 'absolute',
        height: 40,
        borderRadius: 8,
        top: 6, // Vertically centered roughly (total height ~60 clickable area)
        zIndex: 0,
    }
});
