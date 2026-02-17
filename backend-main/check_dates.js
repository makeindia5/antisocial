const mongoose = require('mongoose');
const Message = require('./models/message');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function checkDates() {
    try {
        await mongoose.connect(MONGO_URI);
        const first = await Message.findOne().sort({ createdAt: 1 });
        const last = await Message.findOne().sort({ createdAt: -1 });
        const count = await Message.countDocuments();

        console.log("STATS_START");
        console.log(`TOTAL_MESSAGES: ${count}`);
        if (first) console.log(`FIRST_DATE: ${first.createdAt.toISOString()}`);
        if (last) console.log(`LAST_DATE: ${last.createdAt.toISOString()}`);
        console.log("STATS_END");

        mongoose.connection.close();
    } catch (err) { console.error(err); }
}

checkDates();
