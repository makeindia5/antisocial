import React, { useMemo } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE } from '../../services/apiService';

const SERVER_ROOT = API_BASE.replace('/api/auth', '');

export default function StoryBar({ theme, statuses = [], onCreateStatus, onViewStatus, currentUser }) {

    const storyGroups = useMemo(() => {
        // statuses is already an array of groups: { user, items, latestTime }

        const myId = currentUser?._id;
        const myStory = statuses.find(g => String(g.user?._id || g.user) === String(myId));
        const others = statuses.filter(g => String(g.user?._id || g.user) !== String(myId));

        return { myStory, others };
    }, [statuses, currentUser]);

    const isAllViewed = (group) => {
        if (!group || !group.items || group.items.length === 0) return true;
        return group.items.every(item =>
            item.viewers && item.viewers.some(v => String(v.user?._id || v.user) === String(currentUser?._id))
        );
    };

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
                            isAllViewed(storyGroups.myStory) ? (
                                <View style={[styles.gradientRing, { borderWidth: 2, borderColor: theme.border || '#ccc', backgroundColor: 'transparent' }]} />
                            ) : (
                                <LinearGradient
                                    colors={['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5']}
                                    style={styles.gradientRing}
                                />
                            )
                        ) : null}
                        <View style={[styles.avatarContainer, { backgroundColor: theme.surface }]}>
                            {currentUser?.profilePic ? (
                                <Image source={{ uri: currentUser.profilePic.startsWith('http') ? currentUser.profilePic : `${SERVER_ROOT}${currentUser.profilePic}` }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, { backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center' }]}>
                                    <Ionicons name="person" size={30} color={theme.textSecondary} />
                                </View>
                            )}
                            <TouchableOpacity
                                style={[styles.addIcon, { backgroundColor: theme.primary, borderColor: theme.surface }]}
                                onPress={onCreateStatus}
                            >
                                <Ionicons name="add" size={14} color="white" />
                            </TouchableOpacity>
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
                            {isAllViewed(group) ? (
                                <View style={[styles.gradientRing, { borderWidth: 2, borderColor: theme.border || '#ccc', backgroundColor: 'transparent' }]} />
                            ) : (
                                <LinearGradient
                                    colors={['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5']}
                                    style={styles.gradientRing}
                                />
                            )}
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
