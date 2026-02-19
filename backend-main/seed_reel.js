require('dotenv').config();
const mongoose = require('mongoose');
const Reel = require('./models/Reel');
const User = require('./models/user');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    });

const createSampleReels = async () => {
    try {
        // Find a user to assign the reel to
        const user = await User.findOne();
        if (!user) {
            console.error('❌ No user found! Please run the app and register a user first.');
            process.exit(1);
        }

        const sampleVideos = [
            {
                url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                caption: 'Big Buck Bunny - A classic! 🐰',
                thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/800px-Big_buck_bunny_poster_big.jpg'
            },
            {
                url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                caption: 'Elephants Dream - Sci-fi animation 🐘',
                thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Elephants_Dream_poster_big.jpg/800px-Elephants_Dream_poster_big.jpg'
            },
            {
                url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                caption: 'For Bigger Blazes - Action packed! 🔥',
                thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg'
            },
            {
                url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
                caption: 'For Bigger Escapes - Adventure time 🏃',
                thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg'
            },
            {
                url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
                caption: 'For Bigger Fun - Just having fun! 🎈',
                thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg'
            }
        ];

        console.log(`Creating ${sampleVideos.length} sample reels for user: ${user.name}...`);

        for (const video of sampleVideos) {
            const newReel = new Reel({
                user: user._id,
                url: video.url,
                caption: video.caption,
                thumbnail: video.thumbnail,
                likes: [],
                comments: []
            });
            await newReel.save();
            console.log(`✅ Created reel: ${video.caption}`);
        }

        console.log('🎉 All sample reels created successfully!');
    } catch (e) {
        console.error('❌ Error creating reels:', e);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed.');
    }
};

createSampleReels();
