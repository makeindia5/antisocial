import React, { useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, Alert } from 'react-native';
import { GlobalStyles } from '../../styles/theme';
import StoryBar from './StoryBar';
import PostItem from './PostItem';
import CommentsModal from './modals/CommentsModal';
import ShareModal from './modals/ShareModal';
import { API_BASE } from '../../services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SocialFeed({ theme, posts, statuses, onCreateStatus, onViewStatus, currentUser, onRefresh, refreshing }) {
    const [selectedPost, setSelectedPost] = useState(null);
    const [commentsVisible, setCommentsVisible] = useState(false);
    const [shareVisible, setShareVisible] = useState(false);

    const handleOpenComments = (post) => {
        setSelectedPost(post);
        setCommentsVisible(true);
    };

    const handleOpenShare = (post) => {
        setSelectedPost(post);
        setShareVisible(true);
    };

    const handleAddComment = async (text) => {
        if (!selectedPost || !text.trim()) return;
        try {
            const userId = await AsyncStorage.getItem('userId');
            const url = `${API_BASE}/posts/comment`;
            const body = { postId: selectedPost._id, userId, text };

            console.log(`[SocialFeed] Adding comment to ${url}`, body);

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error(`[SocialFeed] Server error (${res.status}):`, errorText);
                throw new Error(`Server returned ${res.status}`);
            }

            const data = await res.json();
            if (data.success) {
                const updatedPost = { ...selectedPost, comments: data.comments };
                setSelectedPost(updatedPost);

                // Refresh main list if necessary (optimistic)
                if (posts) {
                    const postInList = posts.find(p => p._id === selectedPost._id);
                    if (postInList) postInList.comments = data.comments;
                }
            }
        } catch (e) {
            console.error("Add comment error:", e);
            Alert.alert("Error", `Could not add comment: ${e.message}`);
        }
    };

    const renderHeader = () => (
        <StoryBar
            theme={theme}
            statuses={statuses}
            onCreateStatus={onCreateStatus}
            onViewStatus={onViewStatus}
            currentUser={currentUser}
        />
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.surface }]}>
            <FlatList
                data={posts}
                keyExtractor={item => item._id}
                renderItem={({ item }) => (
                    <PostItem
                        post={selectedPost && selectedPost._id === item._id ? selectedPost : item}
                        theme={theme}
                        onOpenComments={handleOpenComments}
                        onOpenShare={handleOpenShare}
                    />
                )}
                ListHeaderComponent={renderHeader}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
                }
                ListEmptyComponent={() => (
                    <View style={GlobalStyles.containerCenter}>
                        <Text style={{ color: theme.textSecondary }}>No posts yet. Follow people to see their posts!</Text>
                    </View>
                )}
            />

            <CommentsModal
                visible={commentsVisible}
                onClose={() => setCommentsVisible(false)}
                comments={selectedPost?.comments || []}
                onAddComment={handleAddComment}
            />

            <ShareModal
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                currentUser={currentUser}
                selectedItem={selectedPost}
                itemType="post"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
