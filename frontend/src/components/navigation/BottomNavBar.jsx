import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../styles/theme';

const TABS = {
    personal: [
        { key: 'chats', label: 'Chats', icon: 'chatbubbles' },
        { key: 'status', label: 'Updates', icon: 'radio-button-on' },
        { key: 'groups', label: 'Communities', icon: 'people' },
        { key: 'calls', label: 'Calls', icon: 'call' }
    ],
    work: [
        { key: 'gd', label: 'GD', icon: 'people-circle' },
        { key: 'announcement', label: 'Announcement', icon: 'megaphone' },
        { key: 'admin', label: 'Admin', icon: 'shield-checkmark' },
        { key: 'video', label: 'Video Meet', icon: 'videocam' }
    ],
    social: [
        { key: 'home', label: 'Home', icon: 'home' },
        { key: 'reels', label: 'Reels', icon: 'film' },
        { key: 'message', label: 'Message', icon: 'paper-plane' },
        { key: 'search', label: 'Search', icon: 'search' },
        { key: 'profile', label: 'Profile', icon: 'person' }
    ]
};

export default function BottomNavBar({ mode, activeTab, onTabPress, theme }) {
    const currentTabs = TABS[mode] || [];

    return (
        <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            {currentTabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        onPress={() => onTabPress(tab.key)}
                        style={styles.tabBtn}
                    >
                        <Ionicons
                            name={isActive ? tab.icon : `${tab.icon}-outline`}
                            size={24}
                            color={isActive ? theme.secondary : theme.textSecondary || '#999'}
                        />
                        <Text style={[
                            styles.tabLabel,
                            { color: isActive ? theme.secondary : theme.textSecondary || '#999' }
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 10,
        paddingBottom: Platform.OS === 'ios' ? 25 : 10,
        borderTopWidth: 1,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    tabBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1
    },
    tabLabel: {
        fontSize: 10,
        marginTop: 4,
        fontWeight: '500'
    }
});
