const mongoose = require('mongoose');
const Message = require('./models/message');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function check() {
    try {
        await mongoose.connect(MONGO_URI);
        const count = await Message.countDocuments({
            createdAt: {
                $gte: new Date('2024-01-01'),
                $lte: new Date('2025-12-31')
            }
        });
        console.log(`Messages in 2024-2025: ${count}`);
        mongoose.connection.close();
    } catch (err) { console.error(err); }
}

check();
