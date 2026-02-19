const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/FinanceChat')
    .then(() => {
        console.log('Connected!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
