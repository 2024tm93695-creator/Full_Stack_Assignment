const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://localhost:27017/smart_traffic_parking'
    );
    console.log('✅ MongoDB connected (parking-service)');
  } catch (err) {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
