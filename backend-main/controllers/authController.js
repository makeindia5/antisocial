const bcrypt = require("bcryptjs");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const Notification = require("../models/Notification");

const signup = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ name, email, password: hashedPassword, phoneNumber: req.body.phoneNumber || '' });
    await user.save();
    res.json({ success: true, userId: user._id });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ message: "Error", error: err.message });
  }
};

const getGDMessages = async (req, res) => {
  try {
    const Message = require('../models/message');
    const messages = await Message.find({ groupId: 'finance-gd' })
      .sort({ createdAt: 1 })
      .populate('sender', 'name profilePic role');
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  console.log("Login Attempt for:", email);
  try {
    // Allow login with Email OR Phone
    const user = await User.findOne({
      $or: [
        { email: email },
        { phoneNumber: email } // We reuse 'email' variable as identifier
      ]
    });
    if (!user) {
      console.log("User not found for identifier:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }
    console.log("User found:", user.email);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password mismatch for user:", user.email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log("Login successful regarding password match");

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "supersecretjwtkey", { expiresIn: "1h" });

    res.json({ token, userId: user._id, role: user.role, name: user.name, email: user.email, profilePic: user.profilePic, hasCompanyAccess: user.hasCompanyAccess, phoneNumber: user.phoneNumber, isNumberHidden: user.isNumberHidden });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Error" });
  }
};

const getPrivateMessages = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const Message = require('../models/message');
    const messages = await Message.find({
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 }
      ]
    }).sort({ createdAt: 1 });

    // Mark all messages sent TO user1 FROM user2 as read if user1 is the one fetching
    // Heuristic: If we are fetching history, we usually mark incoming as read.
    // However, to be precise, we'd need 'req.query.myId'.
    // Let's use simple updateMany for messages where recipient is the one calling.
    const myId = req.query.myId;
    if (myId) {
      await Message.updateMany(
        { sender: (myId === user1 ? user2 : user1), recipient: myId, read: false },
        { $set: { read: true, status: 'read' } }
      );
    }

    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getPrivateSummary = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const Message = require('../models/message');
    const messages = await Message.find({
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 }
      $or: [
          { sender: user1, recipient: user2 },
          { sender: user2, recipient: user1 }
        ],
        deletedFor: { $ne: req.query.myId } // Exclude messages deleted for this user
    }).sort({ createdAt: -1 }).limit(50).populate('sender', 'name');

    if (messages.length === 0) return res.json({ summary: "No conversation history." });

    const chronological = messages.reverse();
    let summaryText = "Summary of conversation:\n\n";
    chronological.forEach(m => {
      summaryText += `[${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${m.sender?.name}: ${m.content}\n`;
    });

    res.json({ summary: summaryText });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const votePoll = async (req, res) => {
  const { announcementId, userId } = req.body;
  const optionIndex = Number(req.body.optionIndex);
  try {
    const Announcement = require('../models/announcement');
    const announcement = await Announcement.findById(announcementId);

    if (!announcement || !announcement.poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Default userVotes to empty array if undefined
    if (!announcement.poll.userVotes) announcement.poll.userVotes = [];

    const existingVoteIndex = announcement.poll.userVotes.findIndex(v => v.userId.toString() === userId);

    if (existingVoteIndex !== -1) {
      // User has already voted
      const existingVote = announcement.poll.userVotes[existingVoteIndex];

      if (existingVote.optionIndex === optionIndex) {
        // Deselect logic: Remove vote
        announcement.poll.options[optionIndex].votes = Math.max(0, announcement.poll.options[optionIndex].votes - 1);
        announcement.poll.userVotes.splice(existingVoteIndex, 1); // Remove user record
      } else {
        // Change vote: Decrement old, Increment new
        const oldIndex = existingVote.optionIndex;
        if (announcement.poll.options[oldIndex]) {
          announcement.poll.options[oldIndex].votes = Math.max(0, announcement.poll.options[oldIndex].votes - 1);
        }
        announcement.poll.options[optionIndex].votes += 1;

        // Update user's unique vote record
        announcement.poll.userVotes[existingVoteIndex].optionIndex = optionIndex;
      }

    } else {
      // New Vote
      announcement.poll.options[optionIndex].votes += 1;
      announcement.poll.userVotes.push({ userId, optionIndex });
    }

    await announcement.save();

    // Real-time update
    try {
      const io = require('../controllers/socketController').getIo();
      io.emit('pollUpdated', { announcementId: announcement._id, poll: announcement.poll });
    } catch (err) {
      console.error("Socket emit error:", err);
    }

    res.json({ success: true, poll: announcement.poll });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getUnreadCounts = async (req, res) => {
  try {
    const { userId, lastReadGD, lastReadAnnounce } = req.query;
    const Message = require('../models/message');
    const Announcement = require('../models/announcement');

    // 1. Private Chat Unread
    const chatCount = await Message.countDocuments({
      recipient: userId,
      read: false
    });

    // 2. GD Unread (created after last read time)
    let gdCount = 0;
    if (lastReadGD && lastReadGD !== 'null' && lastReadGD !== 'undefined') {
      gdCount = await Message.countDocuments({
        groupId: 'finance-gd',
        createdAt: { $gt: new Date(lastReadGD) }
      });
    } else {
      // If never read, show all (or limit to e.g. 50 recent to avoid huge number)
      gdCount = await Message.countDocuments({ groupId: 'finance-gd' });
    }

    // 3. Announcement Unread
    let announceCount = 0;
    if (lastReadAnnounce && lastReadAnnounce !== 'null' && lastReadAnnounce !== 'undefined') {
      announceCount = await Announcement.countDocuments({
        createdAt: { $gt: new Date(lastReadAnnounce) }
      });
    } else {
      announceCount = await Announcement.countDocuments({});
    }

    res.json({ chat: chatCount, gd: gdCount, announcement: announceCount });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
const scheduleMeeting = async (req, res) => {
  try {
    const { title, scheduledTime, hostId } = req.body;
    const Meeting = require('../models/meeting');

    // Simple code generation (6 chars upper)
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const meeting = new Meeting({
      title,
      scheduledTime,
      hostId,
      code,
      meetingType: 'scheduled'
    });

    await meeting.save();
    res.json({ success: true, meeting });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getMeetings = async (req, res) => {
  try {
    const Meeting = require('../models/meeting');
    // Fetch upcoming scheduled meetings that are either live or in the future
    const meetings = await Meeting.find({
      meetingType: 'scheduled',
      isEnded: false,
      $or: [
        { isStarted: true },
        { scheduledTime: { $gt: new Date() } }
      ]
    }).sort({ scheduledTime: 1 }).populate('hostId', 'name');

    res.json(meetings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const startMeeting = async (req, res) => {
  try {
    const { code } = req.body;
    const Meeting = require('../models/meeting');
    const meeting = await Meeting.findOneAndUpdate(
      { code },
      { isStarted: true },
      { new: true }
    );

    if (meeting) {
      res.json({ success: true, meeting });
    } else {
      res.status(404).json({ error: "Meeting not found" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const endMeeting = async (req, res) => {
  try {
    const { code } = req.body;
    const Meeting = require('../models/meeting');
    const meeting = await Meeting.findOneAndUpdate(
      { code },
      { isEnded: true },
      { new: true }
    );

    if (meeting) {
      res.json({ success: true, meeting });
    } else {
      res.status(404).json({ error: "Meeting not found" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { userId } = req.body;
    const profilePicUrl = `/uploads/${req.file.filename}`;

    await User.findByIdAndUpdate(userId, { profilePic: profilePicUrl });

    // Real-time update
    try {
      const io = require('../controllers/socketController').getIo();
      io.emit('userUpdated', { userId, profilePic: profilePicUrl });
    } catch (e) {
      console.error("Socket emit userUpdated error:", e);
    }

    res.json({ profilePic: profilePicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { userId, name, about } = req.body;
    // Map 'about' from frontend to 'bio' in DB
    const updateData = { name };
    if (about !== undefined) updateData.bio = about;

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      success: true,
      user: {
        name: user.name,
        about: user.bio,
        bio: user.bio
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Basic heuristic summary
const getGDSummary = async (req, res) => {
  try {
    const Message = require('../models/message');
    // Fetch last 50 messages
    const messages = await Message.find({ groupId: 'finance-gd' })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('sender', 'name');

    if (messages.length === 0) return res.json({ summary: "No discussion history available to summarize." });

    // Simple heuristic: Join last 10 messages for context, or filter by length
    // Reversing to show chronological order
    const chronological = messages.reverse();

    let summaryText = "Here is a quick summary of the recent discussion:\n\n";

    // 1. Highlight participants
    const participants = [...new Set(chronological.map(m => m.sender?.name || 'Unknown'))];
    if (participants.length > 0) {
      summaryText += `**Participants:** ${participants.join(', ')}\n\n`;
    }

    // 2. "Key Points" (heuristic: messages with '?' or > 50 chars)
    const keyPoints = chronological.filter(m => m.content.includes('?') || m.content.length > 40);

    if (keyPoints.length > 0) {
      summaryText += "**Key Points/Questions:**\n";
      keyPoints.forEach(m => {
        summaryText += `- ${m.sender?.name}: ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}\n`;
      });
      summaryText += "\n";
    }

    // 3. Last few messages verbatim for context
    summaryText += "**Recent Context:**\n";
    chronological.slice(-5).forEach(m => {
      summaryText += `[${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${m.sender?.name}: ${m.content}\n`;
    });

    res.json({ summary: summaryText });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
const getCommunityUsers = async (req, res) => {
  try {
    const { currentUserId } = req.query;
    const Message = require('../models/message');

    // Fetch all users with basic info plus status and lastSeen
    const users = await User.find({}, 'name email profilePic role status lastSeen bio phoneNumber isNumberHidden').lean();

    if (!currentUserId) return res.json(users);

    // Enrich with unread counts and last message dates
    const enrichedUsers = await Promise.all(users.map(async (u) => {
      const uIdStr = u._id.toString();
      if (uIdStr === String(currentUserId)) return u;

      const unreadCount = await Message.countDocuments({
        sender: uIdStr,
        recipient: String(currentUserId),
        read: false
      });

      const lastMsg = await Message.findOne({
        $or: [
          { sender: String(currentUserId), recipient: uIdStr },
          { sender: uIdStr, recipient: String(currentUserId) }
        ]
      }).sort({ createdAt: -1 });

      return {
        ...u,
        _id: uIdStr, // Keep it string
        unreadCount,
        lastMessageDate: lastMsg ? lastMsg.createdAt : new Date(0),
        lastMessageText: lastMsg ? lastMsg.content : ''
      };
    }));

    // Filter out current user
    const filtered = enrichedUsers
      .filter(u => u._id && u._id.toString() !== String(currentUserId))
      .sort((a, b) => new Date(b.lastMessageDate) - new Date(a.lastMessageDate));

    console.log(`Enriched ${filtered.length} users for ${currentUserId}`);
    res.json(filtered);
  } catch (e) {
    console.error("getCommunityUsers Error:", e);
    res.status(500).json({ error: e.message });
  }
};

const verifyCompanyID = async (req, res) => {
  try {
    const { userId, companyId } = req.body;
    const Company = require('../models/Company');

    const company = await Company.findOne({ companyId });
    if (!company) {
      return res.status(404).json({ error: "Invalid Company ID" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.hasCompanyAccess = true;
    await user.save();

    res.json({ success: true, message: "Company Access Granted" });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const toggleNumberPrivacy = async (req, res) => {
  const { userId, isHidden } = req.body;
  try {
    const user = await User.findByIdAndUpdate(userId, { isNumberHidden: isHidden }, { new: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, isNumberHidden: user.isNumberHidden });
  } catch (error) {
    res.status(500).json({ error: "Failed to update privacy" });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password').lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // Compatibility: Map bio to about
    user.about = user.bio || '';

    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};



const uploadFile = async (req, res) => {
  try {
    console.log("Upload File Request Received:", req.file ? req.file.filename : "No File");
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/${req.file.filename}`, type: req.file.mimetype });
  } catch (e) {
    console.error("Upload File Error:", e);
    res.status(500).json({ error: 'Upload failed' });
  }
};

const createStatus = async (req, res) => {
  try {
    const { userId, type, content, caption, color } = req.body;
    const Status = require('../models/Status');

    const newStatus = new Status({
      user: userId,
      type,
      content,
      caption,
      caption,
      color,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    await newStatus.save();
    await newStatus.populate('user', 'name profilePic');

    try {
      const io = require('../controllers/socketController').getIo();
      io.emit('newStatus', newStatus);
    } catch (e) { console.error("Socket emit error:", e.message); }

    res.status(201).json(newStatus);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getStatuses = async (req, res) => {
  try {
    const Status = require('../models/Status');
    const statuses = await Status.find({ expiresAt: { $gt: new Date() } })
      .populate('user', 'name profilePic')
      .populate('viewers.user', 'name profilePic')
      .sort({ createdAt: -1 });
    res.json(statuses);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const deleteStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const Status = require('../models/Status');
    await Status.findByIdAndDelete(statusId);
    res.json({ message: 'Status deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getLinkedDevices = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user.linkedDevices || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const removeLinkedDevice = async (req, res) => {
  try {
    const { userId, deviceId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.linkedDevices) {
      user.linkedDevices = user.linkedDevices.filter(d => d.deviceId !== deviceId);
      await user.save();
    }
    res.json({ success: true, linkedDevices: user.linkedDevices });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const viewStatus = async (req, res) => {
  try {
    const { statusId, userId } = req.body;
    const Status = require('../models/Status');
    const status = await Status.findById(statusId);

    if (status) {
      // Check if already viewed
      const alreadyViewed = status.viewers.some(v => v.user.toString() === userId);
      if (!alreadyViewed) {
        status.viewers.push({ user: userId });
        await status.save();
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Status not found" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const clearChatHistory = async (req, res) => {
  try {
    const { user1, user2 } = req.body;
    console.log("Clearing Chat for:", user1, "and", user2);
    const Message = require('../models/message');
    const result = await Message.deleteMany({
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 }
      ]
    });
    console.log("Delete Result:", result);
    res.json({ success: true, message: "Chat cleared permanently" });
  } catch (e) {
    console.error("Clear Chat Error:", e);
    res.status(500).json({ error: e.message });
  }
};

const followUser = async (req, res) => {
  try {
    const { userId, targetId } = req.body;
    if (userId === targetId) return res.status(400).json({ error: "Cannot follow yourself" });

    await User.findByIdAndUpdate(userId, { $addToSet: { following: targetId } });
    await User.findByIdAndUpdate(targetId, { $addToSet: { followers: userId } });

    // Create notification
    await Notification.create({
      recipient: targetId,
      sender: userId,
      type: 'follow'
    });

    res.json({ success: true, message: "Followed successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const unfollowUser = async (req, res) => {
  try {
    const { userId, targetId } = req.body;
    await User.findByIdAndUpdate(userId, { $pull: { following: targetId } });
    await User.findByIdAndUpdate(targetId, { $pull: { followers: userId } });

    res.json({ success: true, message: "Unfollowed successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getSuggestedUsers = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    // Suggest users NOT followed yet, excluding self
    const suggestions = await User.find({
      _id: { $nin: [...(user.following || []), userId] }
    }).limit(10).select('name profilePic followers bio');

    res.json(suggestions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .populate('sender', 'name profilePic')
      .populate('postId', 'mediaUrl type')
      .populate('reelId', 'url thumbnail')
      .limit(50);
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const markNotificationsRead = async (req, res) => {
  try {
    const { userId } = req.body;
    await Notification.updateMany({ recipient: userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const verifyMeeting = async (req, res) => {
  try {
    const { code } = req.body;
    const Meeting = require('../models/meeting');
    const meeting = await Meeting.findOne({ code });

    if (meeting) {
      res.json({ success: true, meeting });
    } else {
      res.status(404).json({ error: "Invalid Meeting Code" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const toggleArchiveChat = async (req, res) => {
  try {
    const { userId, chatId } = req.body;
    console.log("Archive Request:", { userId, chatId });
    if (!userId || !chatId) return res.status(400).json({ error: "Missing userId or chatId" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.archivedChats) user.archivedChats = [];

    const index = user.archivedChats.indexOf(chatId);
    if (index !== -1) {
      user.archivedChats.splice(index, 1);
    } else {
      user.archivedChats.push(chatId);
    }
    await user.save();
    console.log("Archive Success:", user.archivedChats);
    res.json({ success: true, archivedChats: user.archivedChats });
  } catch (e) {
    console.error("Archive Error:", e);
    res.status(500).json({ error: e.message });
  }
};

const getArchivedChats = async (req, res) => {
  try {
    const { userId } = req.params;
    const User = require("../models/user");
    const user = await User.findById(userId).populate('archivedChats', 'name profilePic email');
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user.archivedChats || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getDeletedChats = async (req, res) => {
  try {
    const { userId } = req.params;
    const User = require("../models/user");
    const user = await User.findById(userId);
    res.json(user.deletedChats || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const getBlockedUsers = async (req, res) => {
  try {
    const { userId } = req.params;
    const User = require("../models/user");
    const user = await User.findById(userId).populate('blockedUsers', 'name profilePic email');
    res.json(user.blockedUsers || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const deleteChat = async (req, res) => {
  try {
    const { userId, chatId } = req.body;
    console.log("Delete Request:", { userId, chatId });
    if (!userId || !chatId) return res.status(400).json({ error: "Missing parameters" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.deletedChats) user.deletedChats = [];
    if (!user.deletedChats.includes(chatId)) {
      user.deletedChats.push(chatId);
    }
    await user.save();
    console.log("Delete Success");
    res.json({ success: true });
  } catch (e) {
    console.error("Delete Error:", e);
    res.status(500).json({ error: e.message });
  }
};

const toggleBlockUser = async (req, res) => {
  try {
    const { userId, targetId } = req.body;
    console.log("Block Request:", { userId, targetId });
    if (!userId || !targetId) return res.status(400).json({ error: "Missing parameters" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.blockedUsers) user.blockedUsers = [];
    const index = user.blockedUsers.findIndex(id => id.toString() === targetId);

    if (index !== -1) {
      user.blockedUsers.splice(index, 1);
    } else {
      user.blockedUsers.push(targetId);
    }
    await user.save();
    console.log("Block Success, isBlocked:", index === -1);
    res.json({ success: true, isBlocked: index === -1 });
  } catch (e) {
    console.error("Block Error:", e);
    res.status(500).json({ error: e.message });
  }
};

const toggleStarMessage = async (req, res) => {
  try {
    const { userId, messageId } = req.body;
    const Message = require('../models/message');
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    // Ensure starredBy is initialized
    if (!message.starredBy) message.starredBy = [];

    // Check if userId is present (need to handle ObjectId vs String comparison carefully)
    const index = message.starredBy.findIndex(id => id.toString() === userId);

    if (index !== -1) {
      message.starredBy.splice(index, 1);
    } else {
      message.starredBy.push(userId);
    }
    await message.save();
    res.json({ success: true, isStarred: index === -1 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getStarredMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const Message = require('../models/message');
    const messages = await Message.find({ starredBy: userId })
      .populate('sender', 'name profilePic')
      .sort({ createdAt: -1 });
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const updateStatusPrivacy = async (req, res) => {
  try {
    const { userId, privacy, excluded, included } = req.body;
    const User = require('../models/user'); // Ensure User model is required if not globally available or top-level
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (privacy) user.statusPrivacy = privacy;
    // Handle arrays carefully - if sent as undefined, don't overwrite. If sent as empty array, overwrite.
    if (excluded !== undefined) user.statusPrivacyExcluded = excluded;
    if (included !== undefined) user.statusPrivacyIncluded = included;

    await user.save();
    res.json({ success: true, user: { statusPrivacy: user.statusPrivacy, statusPrivacyExcluded: user.statusPrivacyExcluded, statusPrivacyIncluded: user.statusPrivacyIncluded } });
  } catch (e) {
    console.error("Update Status Privacy Error:", e);
    res.status(500).json({ error: e.message });
  }
};

module.exports = {
  toggleArchiveChat,
  getArchivedChats,
  getDeletedChats,
  getBlockedUsers,
  deleteChat,
  toggleBlockUser,
  toggleStarMessage,
  getStarredMessages,
  signup,
  login,
  getGDMessages,
  getPrivateMessages,
  getPrivateSummary,
  votePoll,
  getUnreadCounts,
  scheduleMeeting,
  verifyMeeting,
  getMeetings,
  startMeeting,
  endMeeting,
  uploadAvatar,
  uploadFile,
  getGDSummary,
  getCommunityUsers,
  verifyCompanyID,
  toggleNumberPrivacy,
  getUserDetails,
  createStatus,
  getStatuses,
  deleteStatus,
  getLinkedDevices,
  removeLinkedDevice,
  viewStatus,
  clearChatHistory,
  followUser,
  unfollowUser,
  getSuggestedUsers,
  getNotifications,
  markNotificationsRead,
  updateProfile,
  updateStatusPrivacy
};
