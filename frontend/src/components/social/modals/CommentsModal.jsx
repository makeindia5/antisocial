import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, FlatList, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../../../services/apiService';

const CommentsModal = ({ visible, onClose, comments, onAddComment }) => {
    const [text, setText] = useState('');
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const panY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
            panY.setValue(0);
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: Animated.event([null, { dy: panY }], { useNativeDriver: false }),
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100) {
                    onClose();
                } else {
                    Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
                }
            },
        })
    ).current;

    const handleSend = () => {
        if (!text.trim()) return;
        onAddComment(text);
        setText('');
    };

    if (!visible) return null;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.commentModalOverlay}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={[styles.commentBackdrop, { zIndex: -1 }]} />
            </TouchableWithoutFeedback>

            <Animated.View
                style={[
                    styles.commentSheet,
                    {
                        opacity: fadeAnim,
                        transform: [
                            { translateY: Animated.add(fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }), panY) }
                        ]
                    }
                ]}
            >
                <View
                    style={styles.commentHeader}
                    {...panResponder.panHandlers}
                >
                    <View style={styles.grabber} />
                    <Text style={styles.commentTitle}>Comments ({comments.length})</Text>
                </View>

                <FlatList
                    data={comments}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={({ item }) => (
                        <View style={styles.commentItem}>
                            <View style={styles.commentAvatar}>
                                {item.user?.profilePic ? (
                                    <Image source={{ uri: `${API_BASE.replace('/api/auth', '')}${item.user.profilePic}` }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                                ) : (
                                    <Ionicons name="person-circle" size={32} color="#ccc" />
                                )}
                            </View>
                            <View style={styles.commentContent}>
                                <Text style={styles.commentUser}>{item.user?.name || 'User'}</Text>
                                <Text style={styles.commentText}>{item.text}</Text>
                            </View>
                        </View>
                    )}
                    style={styles.commentList}
                />

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Add a comment..."
                        placeholderTextColor="#666"
                        value={text}
                        onChangeText={setText}
                    />
                    <TouchableOpacity onPress={handleSend}>
                        <Text style={styles.sendText}>Post</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    commentModalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        zIndex: 1000,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    commentBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    commentSheet: {
        backgroundColor: '#1c1c1e',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '70%',
        paddingBottom: Platform.OS === 'ios' ? 100 : 90, // Further increased to clear the bottom nav bar (85px)
    },
    commentHeader: {
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#2c2c2e',
    },
    grabber: {
        width: 40,
        height: 5,
        backgroundColor: '#48484a',
        borderRadius: 2.5,
        marginBottom: 10,
    },
    commentTitle: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    commentList: {
        flex: 1,
    },
    commentItem: {
        flexDirection: 'row',
        padding: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: '#2c2c2e',
    },
    commentAvatar: {
        marginRight: 12,
    },
    commentContent: {
        flex: 1,
        justifyContent: 'center',
    },
    commentUser: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
        marginBottom: 2,
    },
    commentText: {
        color: '#ddd',
        fontSize: 14,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: '#2c2c2e',
        backgroundColor: '#1c1c1e',
    },
    input: {
        flex: 1,
        backgroundColor: '#2c2c2e',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        color: 'white',
        marginRight: 10,
    },
    sendText: {
        color: '#0a84ff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default CommentsModal;
