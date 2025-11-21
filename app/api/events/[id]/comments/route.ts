import { NextResponse } from "next/server";
import { connect } from "@/app/config/dbConfig";
import Event from "@/app/models/event"; 
import mongoose from "mongoose";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!params.id) {
    return NextResponse.json({ message: "⚠️ Event ID is required" }, { status: 400 });
  }

  try {
    await connect(); 
    const event = await Event.findById(params.id);

    if (!event) {
      return NextResponse.json({ message: "⚠️ Event not found" }, { status: 404 });
    }

    const { text, userId, userName, userImage } = await req.json();

    if (!text || !userId || !userName || !userImage) {
      return NextResponse.json({ message: "⚠️ Missing comment text, user ID, name, or image" }, { status: 400 });
    }
    
    if (!Array.isArray(event.comments)) {
      event.comments = [];
    }

    const newComment = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      userName,
      userImage,
      text,
      createdAt: new Date(),
    };

    event.comments.push(newComment);
    await event.save();
    
    return NextResponse.json({ message: "✅ Comment added successfully", comment: newComment }, { status: 200 });
  } catch (error) {
    console.error("❌ Error adding comment:", error);
    return NextResponse.json({ message: "❌ Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!params.id) {
    return NextResponse.json({ message: "⚠️ Event ID is required" }, { status: 400 });
  }

  try {
    await connect();
    const event = await Event.findById(params.id);

    if (!event) {
      return NextResponse.json({ message: "⚠️ Event not found" }, { status: 404 });
    }

    return NextResponse.json({ comments: event.comments || [] }, { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching comments:", error);
    return NextResponse.json({ message: "❌ Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!params.id) {
    return NextResponse.json({ message: "⚠️ Event ID is required" }, { status: 400 });
  }

  try {
    await connect();
    const { commentId, userId } = await req.json();

    if (!commentId || !userId) {
      return NextResponse.json({ message: "⚠️ Comment ID and User ID are required" }, { status: 400 });
    }

    const event = await Event.findById(params.id);

    if (!event) {
      return NextResponse.json({ message: "⚠️ Event not found" }, { status: 404 });
    }

    const commentIndex = event.comments.findIndex(
      (c: any) => c._id.toString() === commentId
    );

    if (commentIndex === -1) {
      return NextResponse.json({ message: "⚠️ Comment not found" }, { status: 404 });
    }

    if (event.comments[commentIndex].userId.toString() !== userId) {
      return NextResponse.json({ message: "⚠️ You can only delete your own comments" }, { status: 403 });
    }
    event.comments.splice(commentIndex, 1);
    await event.save();

    return NextResponse.json({ message: "✅ Comment deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("❌ Error deleting comment:", error);
    return NextResponse.json({ message: "❌ Internal server error" }, { status: 500 });
  }
}