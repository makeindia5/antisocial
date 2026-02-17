const mongoose = require('mongoose');
require('dotenv').config();
const Reel = require('./models/Reel');
const User = require('./models/user');
const connectDB = require('./config/db');

const MOCK_REELS = [
    {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        caption: 'Big Buck Bunny 🐰 #classic',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/800px-Big_buck_bunny_poster_big.jpg'
    },
    {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        caption: 'Elephants Dream 🐘 #surreal',
        thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Elephants_Dream.jpg/800px-Elephants_Dream.jpg'
    },
    {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        caption: 'For Bigger Blazes 🔥',
        thumbnail: ''
    },
    {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        caption: 'Escape the Ordinary 🏃‍♂️',
        thumbnail: ''
    },
    {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        caption: 'Having some fun! 🥳',
        thumbnail: ''
    },
    {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        caption: 'Joyride time 🚗',
        thumbnail: ''
    },
    {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        caption: 'Meltdown! ⚠️',
        thumbnail: ''
    }
];

const seedReels = async () => {
    try {
        await connectDB();

        // 1. Find or Create "HikeBot" user
        let botUser = await User.findOne({ email: 'bot@hikefinance.com' });
        if (!botUser) {
            console.log("Creating Bot User...");
            botUser = new User({
                name: 'Hike Official',
                email: 'bot@hikefinance.com',
                password: 'botpassword123', // Dummy
                role: 'admin',
                profilePic: 'https://cdn-icons-png.flaticon.com/512/4712/4712109.png'
            });
            await botUser.save();
        }

        console.log(`Seeding Reels for User: ${botUser.name}`);

        // 2. Clear existing bot reels (optional, decided effectively idempotent)
        await Reel.deleteMany({ user: botUser._id });

        // 3. Insert Reels
        const reelsToInsert = MOCK_REELS.map(r => ({
            user: botUser._id,
            url: r.url,
            caption: r.caption,
            thumbnail: r.thumbnail,
            likes: [],
            comments: []
        }));

        await Reel.insertMany(reelsToInsert);
        console.log(`Successfully seeded ${reelsToInsert.length} reels!`);

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedReels();
