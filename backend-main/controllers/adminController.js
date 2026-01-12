const Announcement = require('../models/announcement');
const User = require('../models/user');
const GDStatus = require('../models/gdStatus');
const AnnouncementGroup = require('../models/AnnouncementGroup');
const crypto = require('crypto');

exports.createAnnouncement = async (req, res) => {
    try {
        console.log("Creating announcement with body:", req.body);
        const { title, content, groupId } = req.body; // Extract groupId
        const linkCode = crypto.randomBytes(4).toString('hex');

        let fileUrl = null;
        let fileType = null;
        let fileName = null;

        if (req.file) {
            // Construct accessible URL (assuming server runs on same host)
            // Ideally use env var for base URL, but relative path works if proxy/static used correctly
            fileUrl = `/uploads/${req.file.filename}`;
            fileType = req.file.mimetype.startsWith('image') ? 'image' : 'document';
            fileName = req.file.originalname;
        }

        let pollData = null;
        if (req.body.poll) {
            try {
                pollData = JSON.parse(req.body.poll);
            } catch (e) {
                console.error("Poll parse error", e);
            }
        }

        const announcement = new Announcement({
            title,
            content,
            linkCode,
            fileUrl,
            fileType,
            fileName,
            poll: pollData,
            group: groupId || null // Save groupId if present
        });

        await announcement.save();
        console.log("Announcement saved:", announcement._id, "Group:", groupId);

        // Broadcast via Socket.io
        try {
            const io = require('../controllers/socketController').getIo();
            io.emit('newAnnouncement', announcement);
        } catch (socketError) {
            console.error("Socket broadcast failed:", socketError.message);
        }

        res.status(201).json(announcement);
    } catch (error) {
        console.error("Create Announcement Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.createMeet = async (req, res) => {
    try {
        const roomCode = crypto.randomBytes(3).toString('hex').toUpperCase();
        // Determine backend URL (handled by client, client just needs code)
        res.json({ roomCode, url: `/meet.html?room=${roomCode}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        console.log("Fetching all users with chat stats...");
        const users = await User.find({}).select('-password').lean();

        // Find the admin ID (assuming single admin for now, or use req.user if auth middleware existed)
        const admin = await User.findOne({ role: 'admin' });
        const adminId = admin ? admin._id : null;
        console.log("Admin ID for stats:", adminId);

        if (adminId) {
            const Message = require('../models/message');

            // Enrich users with chat stats
            for (let user of users) {
                if (user._id.toString() === adminId.toString()) continue;

                // unread count (User -> Admin)
                const unreadCount = await Message.countDocuments({
                    sender: user._id,
                    recipient: adminId,
                    read: false
                });
                console.log(`User ${user.name} (${user._id}) -> Admin: ${unreadCount} unread`);

                // last message
                const lastMsg = await Message.findOne({
                    $or: [
                        { sender: user._id, recipient: adminId },
                        { sender: adminId, recipient: user._id }
                    ]
                }).sort({ createdAt: -1 });

                user.unreadCount = unreadCount;
                user.lastMessage = lastMsg ? {
                    content: lastMsg.content,
                    createdAt: lastMsg.createdAt
                } : null;
            }

            // SORTING LOGIC: Unread > Latest Message > Name
            users.sort((a, b) => {
                // 1. Unread Count (High to Low)
                if ((a.unreadCount || 0) > (b.unreadCount || 0)) return -1;
                if ((a.unreadCount || 0) < (b.unreadCount || 0)) return 1;

                // 2. Last Message Time (Recent to Old)
                const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
                const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
                if (timeA > timeB) return -1;
                if (timeA < timeB) return 1;

                // 3. Name (A to Z)
                return a.name.localeCompare(b.name);
            });

            console.log("Sorted Order:", users.map(u => `${u.name} (${u.unreadCount})`).join(', '));
        } else {
            console.log("Warning: No Admin found, skipping sort/stats.");
        }

        console.log("Users found:", users.length);
        res.json(users);
    } catch (error) {
        console.error("fetch users error:", error);
        res.status(500).json({ error: error.message });
    }
};

// ... (existing functions)

exports.deleteGroup = async (req, res) => {
    try {
        console.log("Delete Group Request:", req.params.id);
        const { id } = req.params;
        await AnnouncementGroup.findByIdAndDelete(id);
        await require('../models/announcement').deleteMany({ group: id });
        console.log("Group deleted successfully");
        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error("Delete Group Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateGDStatus = async (req, res) => {
    try {
        const { isActive, durationMinutes } = req.body;
        let status = await GDStatus.findOne();
        if (!status) {
            status = new GDStatus();
        }

        status.isActive = isActive;
        // User requested removal of timer, so we clear endTime and duration
        status.endTime = null;
        status.durationMinutes = 0;

        await status.save();

        // Broadcast
        try {
            const io = require('../controllers/socketController').getIo();
            io.emit('gdStatusUpdate', status);
        } catch (e) {
            console.log("Socket emit error:", e.message);
        }

        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        await Announcement.findByIdAndDelete(id);

        // Broadcast deletion
        try {
            const io = require('../controllers/socketController').getIo();
            io.emit('deleteAnnouncement', id);
        } catch (e) {
            console.log("Socket emit error:", e.message);
        }

        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        await require('../models/message').findByIdAndDelete(id);

        // Broadcast deletion
        try {
            const io = require('../controllers/socketController').getIo();
            io.emit('deleteAnnouncement', id); // Re-use event since frontend just filters by ID
        } catch (e) {
            console.log("Socket emit error:", e.message);
        }

        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Group Controllers
exports.createGroup = async (req, res) => {
    try {
        console.log("createGroup called with:", req.body);
        const { name, description } = req.body;
        const group = new AnnouncementGroup({
            name,
            description,
            members: [], // Initially empty or passed in body?
            createdBy: req.user ? req.user.userId : null
        });
        await group.save();
        res.status(201).json(group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        let updateData = {};
        if (name) updateData.name = name;
        if (req.file) {
            updateData.icon = `/uploads/${req.file.filename}`;
        }

        console.log("Updating group:", id, updateData);
        const group = await AnnouncementGroup.findByIdAndUpdate(id, updateData, { new: true });
        res.json(group);
    } catch (error) {
        console.error("Update group error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getGroups = async (req, res) => {
    try {
        const groups = await AnnouncementGroup.find().populate('members', 'name email profilePic');
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getGroup = async (req, res) => {
    try {
        const group = await AnnouncementGroup.findById(req.params.id).populate('members', 'name email profilePic');
        res.json(group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateGroupMembers = async (req, res) => {
    try {
        const { id } = req.params;
        const { members } = req.body; // Array of User IDs
        const group = await AnnouncementGroup.findByIdAndUpdate(id, { members }, { new: true }).populate('members', 'name');
        res.json(group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getGroupAnnouncements = async (req, res) => {
    try {
        const list = await require('../models/announcement').find({ group: req.params.id }).sort({ createdAt: -1 });
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        await AnnouncementGroup.findByIdAndDelete(id);
        await require('../models/announcement').deleteMany({ group: id }); // Cascade delete
        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getGroupMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const messages = await require('../models/message')
            .find({ groupId: id }) // Note: Ensure frontend sends plain ID, not 'group_ID'
            .populate('sender', 'name profilePic role')
            .sort({ createdAt: 1 }); // Oldest first for chat history
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.voteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, optionIndex } = req.body;

        const announcement = await Announcement.findById(id);
        if (!announcement || !announcement.poll) {
            return res.status(404).json({ error: "Poll not found" });
        }

        // Check if user already voted
        const existingVoteIndex = announcement.poll.userVotes.findIndex(v => v.userId.toString() === userId);

        if (existingVoteIndex > -1) {
            const oldOptionIndex = announcement.poll.userVotes[existingVoteIndex].optionIndex;

            // Switch vote if different
            if (oldOptionIndex !== optionIndex) {
                announcement.poll.options[oldOptionIndex].votes = Math.max(0, announcement.poll.options[oldOptionIndex].votes - 1);
                announcement.poll.options[optionIndex].votes += 1;
                announcement.poll.userVotes[existingVoteIndex].optionIndex = optionIndex;
            } else {
                // Same vote, maybe toggle off? Or just ignore. Let's ignore.
                return res.json(announcement);
            }
        } else {
            // New Vote
            announcement.poll.options[optionIndex].votes += 1;
            announcement.poll.userVotes.push({ userId, optionIndex });
        }

        await announcement.save();

        // Broadcast Update
        try {
            const io = require('../controllers/socketController').getIo();
            // Emit to the specific group room
            if (announcement.group) {
                io.to(`group_${announcement.group.toString()}`).emit('updateAnnouncement', announcement);
            } else {
                io.emit('updateAnnouncement', announcement); // Global fallback
            }
        } catch (e) {
            console.log("Socket emit error:", e.message);
        }

        res.json(announcement);
    } catch (error) {
        console.error("Vote Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.createCompanyID = async (req, res) => {
    try {
        const { companyName } = req.body;
        if (!companyName || companyName.length < 2) {
            return res.status(400).json({ error: "Company name must be at least 2 characters" });
        }

        const Company = require('../models/Company');

        // Generate ID
        const prefix = companyName.substring(0, 2).toUpperCase();
        const random = Math.floor(1000 + Math.random() * 9000); // 4 digits
        const companyId = `${prefix}${random}`;

        // Save
        const newCompany = new Company({
            companyName,
            companyId
        });
        await newCompany.save();

        res.json({ companyId });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to create Company ID" });
    }
};
