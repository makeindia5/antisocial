require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const User = require('./models/user');

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}, 'name email role phoneNumber').lean();
    fs.writeFileSync('users_debug.json', JSON.stringify(users, null, 2));
    console.log("Done");
    process.exit(0);
}
check();
