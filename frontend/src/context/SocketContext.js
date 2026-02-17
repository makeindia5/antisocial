import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = "http://192.168.29.129:5000";

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const socket = useRef(null);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [unreadCounts, setUnreadCounts] = useState({});
    const [lastMessages, setLastMessages] = useState({});
    const [userId, setUserId] = useState(null);
    const [userProfile, setUserProfile] = useState({ name: '', profilePic: '' });

    useEffect(() => {
        const loadUser = async () => {
            const id = await AsyncStorage.getItem('userId');
            const name = await AsyncStorage.getItem('userName');
            const pic = await AsyncStorage.getItem('profilePic');
            setUserId(id);
            setUserProfile({ name: name || '', profilePic: pic || '' });
        };
        loadUser();
    }, []);

    useEffect(() => {
        if (!userId) return;

        console.log("Initializing Global Socket for:", userId);
        socket.current = io(SOCKET_URL);

        socket.current.on('connect', () => {
            console.log("Global Socket Connected");
            socket.current.emit('join', userId);
            socket.current.emit('getOnlineUsers', (users) => {
                setOnlineUsers(new Set(users));
            });
        });

        socket.current.on('userOnline', (uid) => {
            console.log("Socket Event: userOnline ->", uid);
            setOnlineUsers(prev => new Set([...prev, uid]));
        });

        socket.current.on('userOffline', (uid) => {
            console.log("Socket Event: userOffline ->", uid);
            setOnlineUsers(prev => {
                const updated = new Set(prev);
                updated.delete(uid);
                return updated;
            });
        });

        socket.current.on('receiveMessage', (msg) => {
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

        socket.current.on('userUpdated', async (data) => {
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
            socket.current.emit('forceRefreshUsers');
        });

        return () => {
            if (socket.current) {
                console.log("Disconnecting Global Socket");
                socket.current.disconnect();
            }
        };
    }, [userId]);

    const markAsRead = (otherUserId) => {
        setUnreadCounts(prev => ({ ...prev, [otherUserId]: 0 }));
    };

    return (
        <SocketContext.Provider value={{
            socket: socket.current,
            onlineUsers,
            unreadCounts,
            lastMessages,
            markAsRead,
            userProfile,
            setUserProfile,
            userId,
            setUserId
        }}>
            {children}
        </SocketContext.Provider>
    );
};
