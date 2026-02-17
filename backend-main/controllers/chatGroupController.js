const ChatGroup = require('../models/ChatGroup');
const Message = require('../models/message');
const User = require('../models/user');

// Create a new Chat Group (or Announcement Group)
exports.createChatGroup = async (req, res) => {
    try {
        const { name, members, createdBy, type } = req.body;
        // Ensure creator is in members
        const allMembers = [...new Set([...members, createdBy])];

        const newGroup = new ChatGroup({
            name,
            members: allMembers,
            createdBy,
            admins: [createdBy],
            type: type || 'group'
        });

        await newGroup.save();
        res.status(201).json(newGroup);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Get Groups for a User
exports.getUserChatGroups = async (req, res) => {
    try {
        const { userId } = req.params;
        const groups = await ChatGroup.find({ members: userId })
            .populate('lastMessage')
            .sort({ updatedAt: -1 });
        res.json(groups);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Get Single Group Details
exports.getChatGroup = async (req, res) => {
    try {
        const group = await ChatGroup.findById(req.params.groupId)
            .populate('members', 'name profilePic')
            .populate('admins', 'name');
        if (!group) return res.status(404).json({ error: "Group not found" });
        res.json(group);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Get Group Messages
exports.getChatGroupMessages = async (req, res) => {
    try {
        const query = { groupId: req.params.groupId };
        if (req.query.userId) {
            query.deletedFor = { $ne: req.query.userId };
        }

        const messages = await Message.find(query)
            .populate('sender', 'name profilePic')
            .sort({ createdAt: 1 });
        res.json(messages);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Pin/Unpin Group
exports.toggleChatGroupPin = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;
        const group = await ChatGroup.findById(groupId);
        if (!group) return res.status(404).json({ error: "Group not found" });

        const index = group.pinnedBy.indexOf(userId);
        if (index === -1) {
            group.pinnedBy.push(userId);
        } else {
            group.pinnedBy.splice(index, 1);
        }
        await group.save();
        res.json({ success: true, pinnedBy: group.pinnedBy });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Add Member
exports.addMemberToGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;
        const group = await ChatGroup.findById(groupId);
        if (!group) return res.status(404).json({ error: "Group not found" });

        if (!group.members.includes(userId)) {
            group.members.push(userId);
            await group.save();
        }
        res.json({ success: true, members: group.members });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Remove Member
exports.removeFromGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;
        const group = await ChatGroup.findById(groupId);
        if (!group) return res.status(404).json({ error: "Group not found" });

        group.members = group.members.filter(m => m.toString() !== userId);
        group.admins = group.admins.filter(a => a.toString() !== userId);

        await group.save();
        res.json({ success: true, members: group.members });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Promote to Admin
exports.promoteToAdmin = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;
        const group = await ChatGroup.findById(groupId);
        if (!group) return res.status(404).json({ error: "Group not found" });

        if (!group.admins.includes(userId)) {
            group.admins.push(userId);
            await group.save();
        }
        res.json({ success: true, admins: group.admins });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Update Group Settings
exports.updateGroupSettings = async (req, res) => {
    try {
        const { groupId } = req.params;
        const updates = req.body; // Expect { description, onlyAdminsCanPost, etc. }
        const group = await ChatGroup.findByIdAndUpdate(groupId, updates, { new: true });
        res.json({ success: true, group });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Update Group Icon
exports.updateGroupIcon = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { icon } = req.body;
        const group = await ChatGroup.findByIdAndUpdate(groupId, { icon }, { new: true });
        res.json({ success: true, group });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Create GD Group (Placeholder or specific logic)
exports.createGDGroup = async (req, res) => {
    // If you have specific logic for GD groups, add it here.
    // For now, reuse createChatGroup or return mock
    return exports.createChatGroup(req, res);
};

// Get GD Groups (Placeholder)
exports.getGDGroups = async (req, res) => {
    // Assuming GD groups are just groups with type 'gd' or similar, 
    // or if it refers to the main 'finance-gd'
    res.json([]);
};
// Toggle Mute Group
exports.toggleMuteGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId, duration } = req.body; // duration in minutes, or 'always'

        const group = await ChatGroup.findById(groupId);
        if (!group) return res.status(404).json({ error: "Group not found" });

        // Remove existing mute for this user
        group.mutedBy = group.mutedBy.filter(m => m.user.toString() !== userId);

        if (duration) {
            let until = null;
            if (duration !== 'always') {
                until = new Date(Date.now() + duration * 60000); // minutes to ms
            }
            group.mutedBy.push({ user: userId, until });
        }
        // If duration is null/undefined (unmute), we just left it removed above.

        await group.save();
        res.json({ success: true, mutedBy: group.mutedBy });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Delete Group
exports.deleteChatGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;
        // Check if admin? Logic might be in frontend or middleware
        await ChatGroup.findByIdAndDelete(groupId);
        await Message.deleteMany({ groupId: groupId });
        res.json({ success: true, message: "Group deleted" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Remove Member (Admin Kick)
exports.removeFromGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body; // User to be removed
        console.log(`[removeFromGroup] Removing ${userId} from ${groupId}`);

        const group = await ChatGroup.findById(groupId);
        if (!group) return res.status(404).json({ error: "Group not found" });

        // Filter out the user
        group.members = group.members.filter(m => String(m) !== String(userId));
        group.admins = group.admins.filter(a => String(a) !== String(userId));

        // Also remove specific mute/pin records
        group.mutedBy = group.mutedBy.filter(m => String(m.user) !== String(userId));
        group.pinnedBy = group.pinnedBy.filter(p => String(p) !== String(userId));

        await group.save();
        res.json({ success: true, members: group.members });
    } catch (e) {
        console.error("Remove Member Error:", e);
        res.status(500).json({ error: e.message });
    }
};
