import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config(); // Load .env variables

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/CampusKart';

/**
 * Connect to MongoDB using Mongoose.
 * Supports both local MongoDB and Atlas cloud.
 */
export const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ MongoDB connected successfully');
    if (MONGODB_URI.includes('mongodb+srv')) {
      console.log('📍 Connected to MongoDB Atlas cluster');
    } else {
      console.log('📍 Connected to local MongoDB');
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);

    console.log('\n🔧 To fix this:');
    console.log('1. Ensure MongoDB is running locally, OR');
    console.log('2. Set up MongoDB Atlas (cloud) and set MONGODB_URI environment variable');
    console.log('3. Example:');
    console.log('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/CampusKart');
    
    // Stop server if DB connection fails in production
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️  Exiting process because MongoDB is required in production');
      process.exit(1);
    }
  }
};

export default mongoose;
