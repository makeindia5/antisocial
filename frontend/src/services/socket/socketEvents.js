import AsyncStorage from '@react-native-async-storage/async-storage';

export const setupSocketListeners = (socket, { setOnlineUsers, setLastMessages, setUnreadCounts, setUserProfile, userId }) => {
    if (!socket) return;

    socket.on('connect', () => {
        console.log("Global Socket Connected");
        socket.emit('join', userId);
        socket.emit('getOnlineUsers', (users) => {
            setOnlineUsers(new Set(users));
        });
    });

    socket.on('userOnline', (uid) => {
        console.log("Socket Event: userOnline ->", uid);
        setOnlineUsers(prev => new Set([...prev, uid]));
    });

    socket.on('userOffline', (uid) => {
        console.log("Socket Event: userOffline ->", uid);
        setOnlineUsers(prev => {
            const updated = new Set(prev);
            updated.delete(uid);
            return updated;
        });
    });

    socket.on('receiveMessage', (msg) => {
        const senderId = String(msg.sender?._id || msg.sender);
        const recipientId = msg.recipient ? String(msg.recipient?._id || msg.recipient) : null;
        const groupId = msg.groupId ? String(msg.groupId?._id || msg.groupId) : null;

        if (groupId) {
            // Group Message
            setLastMessages(prev => ({
                ...prev,
                [`group_${groupId}`]: { text: msg.content, date: msg.createdAt, senderName: msg.sender?.name || 'User' }
            }));
        } else {
            // 1:1 Message
            const otherUserId = (senderId === String(userId)) ? recipientId : senderId;
            setLastMessages(prev => ({
                ...prev,
                [otherUserId]: { text: msg.content, date: msg.createdAt }
            }));

            if (recipientId === String(userId)) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [senderId]: (prev[senderId] || 0) + 1
                }));
            }
        }
    });

    socket.on('userUpdated', async (data) => {
        if (String(data.userId) === String(userId)) {
            if (data.profilePic) {
                await AsyncStorage.setItem('profilePic', data.profilePic);
                setUserProfile(prev => ({ ...prev, profilePic: data.profilePic }));
            }
            if (data.name) {
                await AsyncStorage.setItem('userName', data.name);
                setUserProfile(prev => ({ ...prev, name: data.name }));
            }
        }
        socket.emit('forceRefreshUsers');
    });
};
