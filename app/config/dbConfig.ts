import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error("⚠️ MongoDB connection string is missing from environment variables!");
}

// Connection pool settings for better performance
const connectionOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

export async function connect() {
  try {
    if (mongoose.connection.readyState >= 1) {
      return mongoose.connection;
    }

    if (mongoose.connection.readyState === 2) {
      // Already connecting, wait for it
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve);
      });
      return mongoose.connection;
    }

    await mongoose.connect(MONGO_URI!, connectionOptions);

    mongoose.connection.on("error", (err) => console.error("❌ MongoDB connection error:", err));

    return mongoose.connection;
  } catch (error: any) {
    console.error("❌ MongoDB connection failed:", error);
    throw new Error("Database connection failed");
  }
}