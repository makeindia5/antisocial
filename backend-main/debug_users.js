const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/user');
const connectDB = require('./config/db');

const checkUsers = async () => {
    try {
        await connectDB();

        console.log("Checking for aayushmali224@gmail.com...");
        const user = await User.findOne({ email: "aayushmali224@gmail.com" });

        if (user) {
            console.log("FOUND: " + user.email);
            // Check password hash maybe? No, just existence.
        } else {
            console.log("NOT_FOUND: aayushmali224@gmail.com");
            // Find closet match
            const similar = await User.find({ email: { $regex: "aayush", $options: "i" } });
            console.log("Similar users found:", similar.length);
            similar.forEach(u => console.log("Did you mean: " + u.email));
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkUsers();
