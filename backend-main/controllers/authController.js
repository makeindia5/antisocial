const bcrypt = require("bcryptjs");
const User = require("../models/user");
const jwt = require("jsonwebtoken");

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
  console.log("Login Attempt:", email);
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password mismatch for user:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

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
      ]
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
      code
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
    // Fetch upcoming meetings
    const meetings = await Meeting.find({
      scheduledTime: { $gt: new Date() }
    }).sort({ scheduledTime: 1 }).populate('hostId', 'name');

    res.json(meetings);
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

    res.json({ profilePic: profilePicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const users = await User.find({}, 'name email profilePic role').sort({ name: 1 });
    res.json(users);
  } catch (e) {
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
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ error: "User not found" });
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
      color
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

module.exports = {
  signup,
  login,
  getGDMessages,
  getPrivateMessages,
  getPrivateSummary,
  votePoll,
  getUnreadCounts,
  scheduleMeeting,
  getMeetings,
  uploadAvatar,
  uploadFile,
  getGDSummary,
  getCommunityUsers,
  verifyCompanyID,
  toggleNumberPrivacy,
  getUserDetails,
  createStatus,
  getStatuses,
  deleteStatus
};