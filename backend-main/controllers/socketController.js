const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
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

        socket.on('join', async (userId) => {
            if (!userId) return;
            socket.join(userId);
            socket.userId = userId;

            console.log(`User ${userId} joined room ${userId}`);

            if (!onlineUsers.has(userId)) {
                onlineUsers.set(userId, new Set());
                // Update DB to online
                try {
                    await User.findByIdAndUpdate(userId, { status: 'online' });
                    io.emit('userOnline', userId);
                    console.log(`Broadcasted userOnline for ${userId}`);
                } catch (e) {
                    console.error("DB Status Update Error:", e);
                }
            }
            onlineUsers.get(userId).add(socket.id);
        });

        socket.on('getOnlineUsers', (callback) => {
            const users = Array.from(onlineUsers.keys());
            if (typeof callback === 'function') callback(users);
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
                    const targetRoom = String(data.recipient);
                    console.log(`Routing to 1:1 Room: ${targetRoom}, Sender: ${data.sender}`);
                    io.to(targetRoom).emit('receiveMessage', newMessage);
                    io.to(String(data.sender)).emit('receiveMessage', newMessage);
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
                    io.to(message.groupId === 'finance-gd' ? 'finance-gd' : `group_${message.groupId}`).emit('messageDeleted', msgId);
                }
            } catch (err) {
                console.error("Delete error:", err);
            }
        });

        socket.on('deleteMessageForMe', async ({ msgId, userId }) => {
            try {
                const message = await Message.findById(msgId);
                if (!message) return;

                // Add to deletedFor if not already there
                if (!message.deletedFor.includes(userId)) {
                    message.deletedFor.push(userId);
                    await message.save();
                }

                // Notify ONLY the requesting user
                io.to(userId).emit('messageDeleted', msgId);
            } catch (err) {
                console.error("Delete For Me Error:", err);
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

        // --- QR Code Login Handshake ---

        // Map to store QR Code -> User Agent (OS/Browser info)
        const qrCodeInfo = new Map();

        // 1. Web Client requests a QR Code ID
        socket.on('web:request_qr', () => {
            const qrCodeId = uuidv4();
            socket.join(`qr_${qrCodeId}`);

            // Capture User-Agent from handshake headers
            const userAgent = socket.request.headers['user-agent'] || '';
            qrCodeInfo.set(qrCodeId, userAgent);

            socket.emit('web:qr_generated', qrCodeId);
            console.log(`QR Generated for socket ${socket.id}: ${qrCodeId}`);
        });

        // 2. Mobile App scans QR and sends token
        socket.on('mobile:scan_qr', async ({ qrCodeId, token, userId }) => {
            console.log(`Mobile scanned QR ${qrCodeId} for user ${userId}`);

            // Allow storing device
            try {
                const user = await User.findById(userId);
                if (user) {

                    // Parse User-Agent
                    let deviceName = 'Web Browser';
                    const ua = qrCodeInfo.get(qrCodeId) || '';
                    if (ua.includes('Windows')) deviceName = 'Windows';
                    else if (ua.includes('Macintosh')) deviceName = 'Mac OS';
                    else if (ua.includes('Linux')) deviceName = 'Linux';
                    else if (ua.includes('Android')) deviceName = 'Android Tablet';
                    else if (ua.includes('iPad')) deviceName = 'iPad';

                    if (ua.includes('Chrome')) deviceName += ' (Chrome)';
                    else if (ua.includes('Firefox')) deviceName += ' (Firefox)';
                    else if (ua.includes('Safari') && !ua.includes('Chrome')) deviceName += ' (Safari)';
                    else if (ua.includes('Edge')) deviceName += ' (Edge)';

                    const newDevice = {
                        deviceId: uuidv4(),
                        name: deviceName,
                        lastActive: new Date()
                    };
                    user.linkedDevices.push(newDevice);
                    await user.save();

                    // Cleanup
                    qrCodeInfo.delete(qrCodeId);
                }
            } catch (e) {
                console.error("Error saving linked device:", e);
            }

            // Notify the specific Web Client in the room
            io.to(`qr_${qrCodeId}`).emit('web:auth_success', { token, userId });
        });

        socket.on('editMessage', async ({ msgId, content, chatId }) => {
            try {
                const message = await Message.findById(msgId);
                if (!message) return;

                message.content = content;
                message.isEdited = true;
                await message.save();

                if (message.recipient) {
                    io.to(message.recipient.toString()).emit('messageEdited', { msgId, content });
                    io.to(message.sender.toString()).emit('messageEdited', { msgId, content });
                } else if (message.groupId) {
                    io.to(`group_${message.groupId}`).emit('messageEdited', { msgId, content });
                }
            } catch (err) {
                console.error("Edit Error:", err);
            }
        });

        socket.on('addReaction', async ({ msgId, emoji, userId }) => {
            try {
                const message = await Message.findById(msgId);
                if (!message) return;

                if (!message.reactions) message.reactions = [];
                const existing = message.reactions.findIndex(r => r.user.toString() === userId);
                if (existing !== -1) {
                    message.reactions[existing].emoji = emoji;
                } else {
                    message.reactions.push({ user: userId, emoji });
                }
                await message.save();

                const updated = await Message.findById(msgId).populate('reactions.user', 'name');

                if (message.recipient) {
                    io.to(message.recipient.toString()).emit('messageReaction', { msgId, reactions: updated.reactions });
                    io.to(message.sender.toString()).emit('messageReaction', { msgId, reactions: updated.reactions });
                } else if (message.groupId) {
                    io.to(`group_${message.groupId}`).emit('messageReaction', { msgId, reactions: updated.reactions });
                }
            } catch (err) {
                console.error("Reaction Error:", err);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected', socket.id);
            if (socket.userId && onlineUsers.has(socket.userId)) {
                const userSockets = onlineUsers.get(socket.userId);
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    onlineUsers.delete(socket.userId);
                    // Update DB to offline + lastSeen
                    User.findByIdAndUpdate(socket.userId, { status: 'offline', lastSeen: new Date() }).catch(e => console.error("Update Status Error:", e));
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
