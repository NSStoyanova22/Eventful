import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { connect } from "@/app/config/dbConfig";
import User from "@/app/models/user";
import Event from "@/app/models/event";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "No user ID provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get file extension
    const extension = file.type.split("/")[1];
    const fileName = `user-${userId}.${extension}`;
    
    // Save to public/uploads/users
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "users");
    const filePath = path.join(uploadsDir, fileName);
    
    await writeFile(filePath, buffer as any);

    // Generate URL path
    const imageUrl = `/uploads/users/${fileName}`;

    // Update user in database
    await connect();
    await User.findByIdAndUpdate(userId, { image: imageUrl });

    // Update all comments by this user with the new profile image
    await Event.updateMany(
      { "comments.userId": userId },
      {
        $set: {
          "comments.$[comment].userImage": imageUrl
        }
      },
      {
        arrayFilters: [{ "comment.userId": userId }]
      }
    );

    return NextResponse.json({ 
      success: true, 
      imageUrl,
      message: "Profile image uploaded successfully"
    });

  } catch (error: any) {
    console.error("Error uploading profile image:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to upload image" 
    }, { status: 500 });
  }
}
