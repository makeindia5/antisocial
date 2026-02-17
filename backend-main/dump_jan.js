const mongoose = require('mongoose');
const Message = require('./models/message');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function dump() {
    try {
        await mongoose.connect(MONGO_URI);
        const messages = await Message.find({
            createdAt: {
                $gte: new Date('2026-01-01'),
                $lte: new Date('2026-01-08')
            }
        }).populate('sender', 'name').sort({ createdAt: 1 });

        console.log(`Found ${messages.length} messages in Jan 1-8 2026.`);
        messages.forEach(m => {
            console.log(`[${m.createdAt.toISOString()}] ${m.sender?.name || 'Unknown'}: ${m.content}`);
        });

        mongoose.connection.close();
    } catch (err) { console.error(err); }
}

dump();
