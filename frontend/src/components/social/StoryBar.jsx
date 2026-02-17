import React, { useMemo } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE } from '../../services/apiService';

const SERVER_ROOT = API_BASE.replace('/api/auth', '');

export default function StoryBar({ theme, statuses = [], onCreateStatus, onViewStatus, currentUser }) {

    const storyGroups = useMemo(() => {
        // Group statuses by user
        const groups = {};
        statuses.forEach(status => {
            const userId = status.user._id;
            if (!groups[userId]) {
                groups[userId] = {
                    user: status.user,
                    statuses: [],
                    latest: status.createdAt
                };
            }
            groups[userId].statuses.push(status);
        });

        // Convert to array
        let groupList = Object.values(groups);

        // Sort: My story first? Or just sort by latest
        // Actually, we want "My Story" to be a separate fixed item at the start usually
        // But if I have a story, it should be in the list? 
        // Let's standard approach: 
        // 1. "Add Story" / "My Story" (if exists) at index 0.
        // 2. Others sorted by latest.

        const myId = currentUser?._id;
        const myStory = groupList.find(g => g.user._id === myId);
        const others = groupList.filter(g => g.user._id !== myId).sort((a, b) => new Date(b.latest) - new Date(a.latest));

        return { myStory, others };
    }, [statuses, currentUser]);

    return (
        <View style={[styles.container, { borderBottomColor: theme.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* My Story Node */}
                <TouchableOpacity
                    style={styles.storyItem}
                    onPress={() => storyGroups.myStory ? onViewStatus(storyGroups.myStory) : onCreateStatus()}
                >
                    <View style={styles.ringContainer}>
                        {storyGroups.myStory ? (
                            <LinearGradient
                                colors={['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5']}
                                style={styles.gradientRing}
                            />
                        ) : null}
                        <View style={[styles.avatarContainer, { backgroundColor: theme.surface }]}>
                            {currentUser?.profilePic ? (
                                <Image source={{ uri: currentUser.profilePic.startsWith('http') ? currentUser.profilePic : `${SERVER_ROOT}${currentUser.profilePic}` }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, { backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center' }]}>
                                    <Ionicons name="person" size={30} color={theme.textSecondary} />
                                </View>
                            )}
                            {!storyGroups.myStory && (
                                <View style={[styles.addIcon, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
                                    <Ionicons name="add" size={14} color="white" />
                                </View>
                            )}
                        </View>
                    </View>
                    <Text style={[styles.storyName, { color: theme.textPrimary }]} numberOfLines={1}>
                        Your Story
                    </Text>
                </TouchableOpacity>

                {/* Other Stories */}
                {storyGroups.others.map((group) => (
                    <TouchableOpacity key={group.user._id} style={styles.storyItem} onPress={() => onViewStatus(group)}>
                        <View style={styles.ringContainer}>
                            <LinearGradient
                                colors={['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5']}
                                style={styles.gradientRing}
                            />
                            <View style={[styles.avatarContainer, { backgroundColor: theme.surface }]}>
                                {group.user.profilePic ? (
                                    <Image source={{ uri: group.user.profilePic.startsWith('http') ? group.user.profilePic : `${SERVER_ROOT}${group.user.profilePic}` }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatar, { backgroundColor: theme.inputBg }]} />
                                )}
                            </View>
                        </View>
                        <Text style={[styles.storyName, { color: theme.textPrimary }]} numberOfLines={1}>
                            {group.user.name}
                        </Text>
                    </TouchableOpacity>
                ))}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 10,
        borderBottomWidth: 0.5,
    },
    scrollContent: {
        paddingHorizontal: 10,
    },
    storyItem: {
        alignItems: 'center',
        marginRight: 15,
        width: 70,
    },
    ringContainer: {
        width: 72,
        height: 72,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 5,
    },
    gradientRing: {
        position: 'absolute',
        width: 72,
        height: 72,
        borderRadius: 36,
    },
    avatarContainer: {
        width: 66,
        height: 66,
        borderRadius: 33,
        padding: 3,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 30,
    },
    addIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    storyName: {
        fontSize: 11,
        fontWeight: '400',
    }
});
