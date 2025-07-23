const mongoose = require('mongoose');

const dbConfig = {
    url: process.env.MONGODB_URI ,
    options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    },
};

const connectDB = async () => {
    try {
        await mongoose.connect(dbConfig.url, dbConfig.options);
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
};

module.exports = {
    connectDB,
};