import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  userImage: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const eventSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    location: {
      type: String,
      default: "",
      trim: true,
    },
    startDate: Date,
    endDate: Date,
    image: String,
    isPublic: Boolean,
    guestLimit: Number,
    attending: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      default: "",
    },
    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: {
      type: [commentSchema],
      default: [],
    },
    photos: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["approved", "flagged", "pending"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for frequently queried fields to improve performance
eventSchema.index({ createdBy: 1 });
eventSchema.index({ status: 1, isPublic: 1, endDate: 1 });
eventSchema.index({ attendees: 1 });
eventSchema.index({ endDate: 1 });

const Event = mongoose.models.Event || mongoose.model("Event", eventSchema);
export default Event;
