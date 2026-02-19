const mongoose = require('mongoose');
const User = require('./models/user');

mongoose.connect('mongodb://127.0.0.1:27017/FinanceChat', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        try {
            const count = await User.countDocuments();
            console.log(`Found ${count} users.`);
            if (count > 0) {
                const user = await User.findOne();
                console.log('First user:', user._id, user.name);
            }
        } catch (e) {
            console.error('❌ Error querying users:', e);
        } finally {
            mongoose.connection.close();
        }
    })
    .catch(err => {
        console.error('❌ Connection error:', err);
    });
