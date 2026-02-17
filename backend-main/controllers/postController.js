const Post = require('../models/Post');
const User = require('../models/user');
const Notification = require('../models/Notification');

exports.createPost = async (req, res) => {
    try {
        const { userId, mediaUrl, type, caption } = req.body;
        const newPost = new Post({
            user: userId,
            mediaUrl,
            type,
            caption
        });
        await newPost.save();

        // Increment user's post count
        await User.findByIdAndUpdate(userId, { $inc: { postsCount: 1 } });

        await newPost.populate('user', 'name profilePic');
        res.status(201).json(newPost);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getFeed = async (req, res) => {
    try {
        const { userId } = req.query;
        let query = {};

        if (userId) {
            const user = await User.findById(userId);
            if (user && user.following.length > 0) {
                // Show posts from following + user's own posts
                query = { user: { $in: [...user.following, userId] } };
            }
        }

        let posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .populate('user', 'name profilePic')
            .populate('comments.user', 'name profilePic')
            .limit(20);

        // Discovery Fallback: If no posts from following, show global latest posts
        if (posts.length === 0) {
            posts = await Post.find({})
                .sort({ createdAt: -1 })
                .populate('user', 'name profilePic')
                .populate('comments.user', 'name profilePic')
                .limit(20);
        }

        res.json(posts);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.likePost = async (req, res) => {
    try {
        const { postId, userId } = req.body;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const index = post.likes.indexOf(userId);
        if (index === -1) {
            post.likes.push(userId);
            // Create notification
            if (post.user.toString() !== userId) {
                await Notification.create({
                    recipient: post.user,
                    sender: userId,
                    type: 'like',
                    postId: post._id
                });
            }
        } else {
            post.likes.splice(index, 1);
        }
        await post.save();
        res.json({ success: true, likes: post.likes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.commentPost = async (req, res) => {
    try {
        const { postId, userId, text } = req.body;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        post.comments.push({ user: userId, text });
        await post.save();

        // Create notification
        if (post.user.toString() !== userId) {
            await Notification.create({
                recipient: post.user,
                sender: userId,
                type: 'comment',
                postId: post._id,
                commentText: text
            });
        }

        await post.populate('comments.user', 'name profilePic');
        res.json({ success: true, comments: post.comments });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.deletePost = async (req, res) => {
    try {
        const { postId, userId } = req.body;
        const post = await Post.findById(postId);

        if (!post) return res.status(404).json({ error: 'Post not found' });
        if (post.user.toString() !== userId) return res.status(403).json({ error: 'Unauthorized' });

        await Post.findByIdAndDelete(postId);
        await User.findByIdAndUpdate(userId, { $inc: { postsCount: -1 } });

        res.json({ success: true, message: 'Post deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getUserPosts = async (req, res) => {
    try {
        const { userId } = req.params;
        const posts = await Post.find({ user: userId }).sort({ createdAt: -1 }).populate('user', 'name profilePic');
        res.json(posts);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getExploreFeed = async (req, res) => {
    try {
        // Simple exploration: Latest posts from everyone, shuffled or sorted by popularity
        // In a real app, this would be an interest-based algorithm
        const posts = await Post.find({})
            .sort({ createdAt: -1 }) // Or by popularity (likes)
            .populate('user', 'name profilePic')
            .limit(50);

        // Shuffle for variety (optional)
        const shuffled = posts.sort(() => 0.5 - Math.random());
        res.json(shuffled);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
