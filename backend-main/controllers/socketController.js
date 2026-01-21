const socketIo = require('socket.io');
const Message = require('../models/message');
const User = require('../models/user');

let io;

exports.init = (server) => {
    io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Track online users: userId -> Set(socketIds)
    const onlineUsers = new Map();

    io.on('connection', (socket) => {
        console.log('New client connected', socket.id);

        socket.on('join', (userId) => {
            socket.join(userId);
            socket.userId = userId; // Store for disconnect

            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
                io.emit('userOnline', userId); // Broadcast only if first connection
            }
            onlineUsers.get(userId).add(socket.id);

            console.log(`User ${userId} joined room ${userId} (Online)`);
        });

        socket.on('checkOnlineStatus', (userId, callback) => {
            const isOnline = onlineUsers.has(userId);
            if (typeof callback === 'function') callback(isOnline);
        });

        socket.on('joinAnnouncement', (announcementId) => {
            socket.join(announcementId);
            console.log(`User joined announcement room ${announcementId}`);
        });



        socket.on('joinGD', () => {
            socket.join('finance-gd');
            console.log(`User ${socket.id} joined GD`);
        });

        socket.on('leaveGD', () => {
            socket.leave('finance-gd');
            console.log(`User ${socket.id} left GD`);
        });

        // Dynamic Group Chat (Announcements + Chat)
        socket.on('joinGroup', (groupId) => {
            const room = `group_${groupId}`;
            socket.join(room);
            console.log(`User ${socket.id} joined group room: ${room}`);
        });

        socket.on('leaveGroup', (groupId) => {
            const room = `group_${groupId}`;
            socket.leave(room);
            console.log(`User ${socket.id} left group room: ${room}`);
        });

        socket.on('sendMessage', async (data) => {
            console.log("Socket received message:", data);
            try {
                const newMessage = new Message(data);
                await newMessage.save();
                await newMessage.populate('sender', 'name profilePic role');

                if (data.recipient) {
                    // 1:1 Chat
                    console.log("Routing to 1:1:", data.recipient);
                    io.to(data.recipient).emit('receiveMessage', newMessage);
                    io.to(data.sender).emit('receiveMessage', newMessage);
                } else if (data.announcementId) {
                    // Announcement Broadcast
                    console.log("Routing to Announcement:", data.announcementId);
                    io.to(data.announcementId).emit('receiveAnnouncement', newMessage);
                } else if (data.groupId) {
                    // Check if it's the fixed GD group or a dynamic announcement group
                    if (data.groupId === 'finance-gd') {
                        console.log("Routing to GD Group:", data.groupId);
                        io.to(data.groupId).emit('receiveMessage', newMessage);
                    } else {
                        // Dynamic Group Room
                        const room = `group_${data.groupId}`;
                        console.log(`Routing to Group Room: ${room}`);
                        io.to(room).emit('receiveMessage', newMessage);
                    }
                } else {
                    console.log("Message has no routing target!");
                    socket.emit('messageError', { error: 'No routing target' });
                }
            } catch (err) {
                console.error("Message error:", err);
                socket.emit('messageError', { error: err.message });
            }
        });

        socket.on('markAsDelivered', async ({ msgId, userId }) => {
            try {
                const message = await Message.findById(msgId);
                if (message && message.status === 'sent') {
                    message.status = 'delivered';
                    await message.save();
                    io.to(message.sender.toString()).emit('messageStatusUpdate', { msgId, status: 'delivered' });
                }
            } catch (e) {
                console.error("Mark Delivered Error:", e);
            }
        });

        socket.on('markAsRead', async ({ msgId, userId }) => {
            try {
                const message = await Message.findById(msgId);
                if (!message) return;

                if (message.groupId) {
                    // Group Chat Read Logic
                    const alreadyRead = message.readBy.some(r => r.user.toString() === userId);
                    if (!alreadyRead) {
                        message.readBy.push({ user: userId });
                        await message.save();

                        // Notify group (including sender) that this user read the message
                        if (message.groupId === 'finance-gd') {
                            io.to('finance-gd').emit('messageReadBy', { msgId, userId });
                        } else {
                            io.to(`group_${message.groupId}`).emit('messageReadBy', { msgId, userId });
                        }
                    }
                } else {
                    // 1:1 Chat Logic
                    if (message.status !== 'read') {
                        message.status = 'read';
                        message.read = true;
                        await message.save();
                        io.to(message.sender.toString()).emit('messageStatusUpdate', { msgId, status: 'read' });
                    }
                }
            } catch (e) {
                console.error("Mark Read Error:", e);
            }
        });

        socket.on('deleteMessage', async ({ msgId, userId }) => {
            try {
                const message = await Message.findById(msgId);
                if (!message) return;

                // Verify ownership
                if (message.sender.toString() !== userId) {
                    console.log("Unauthorized delete attempt");
                    return;
                }

                await Message.findByIdAndDelete(msgId);
                console.log(`Message ${msgId} deleted`);

                // Notify relevant parties
                if (message.recipient) {
                    io.to(message.recipient.toString()).emit('messageDeleted', msgId);
                    io.to(message.sender.toString()).emit('messageDeleted', msgId);
                } else if (message.groupId) {
                    io.to(message.groupId).emit('messageDeleted', msgId);
                }
            } catch (err) {
                console.error("Delete error:", err);
            }
        });

        // WebRTC Signaling
        socket.on('join-meet', (roomId) => {
            socket.join(roomId);
            socket.to(roomId).emit('user-connected', socket.id);
        });

        socket.on('offer', (data) => {
            socket.to(data.roomId).emit('offer', data);
        });

        socket.on('answer', (data) => {
            socket.to(data.roomId).emit('answer', data);
        });

        socket.on('ice-candidate', (data) => {
            socket.to(data.roomId).emit('ice-candidate', data);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected', socket.id);
            if (socket.userId && onlineUsers.has(socket.userId)) {
                const userSockets = onlineUsers.get(socket.userId);
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    onlineUsers.delete(socket.userId);
                    io.emit('userOffline', socket.userId);
                    console.log(`User ${socket.userId} went offline`);
                }
            }
        });
    });
};

exports.getIo = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};
