import { connect } from "@/app/config/dbConfig";
import Event from "@/app/models/event";
import User from "@/app/models/user";
import { NextRequest, NextResponse } from "next/server";
import moderateText from "../../lib/moderate";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
  try {
    await connect();

    if (!req.headers.get("content-type")?.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Invalid content type" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const title = formData.get("title");
    const description = formData.get("description");
    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate");
    const isPublicRaw = formData.get("isPublic");
    const guestLimitRaw = formData.get("guestLimit");
    const attendingRaw = formData.get("attending");
    const userId = formData.get("userId");
    const location = formData.get("location");

    if (
      typeof title !== "string" ||
      typeof description !== "string" ||
      typeof startDate !== "string" ||
      typeof endDate !== "string" ||
      typeof userId !== "string" ||
      typeof location !== "string" ||
      !title.trim() ||
      !description.trim() ||
      !startDate.trim() ||
      !endDate.trim() ||
      !userId.trim() ||
      !location.trim()
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: "Invalid user identifier" },
        { status: 400 }
      );
    }

    const isPublic =
      typeof isPublicRaw === "string" ? JSON.parse(isPublicRaw) : false;
    const guestLimit = Number.parseInt(
      typeof guestLimitRaw === "string" ? guestLimitRaw : "0",
      10
    );
    const attending = Number.parseInt(
      typeof attendingRaw === "string" ? attendingRaw : "0",
      10
    );

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const moderationStatus = !moderateText(description).allowed
      ? "flagged"
      : !moderateText(title).allowed
      ? "flagged"
      : "approved";

    let imageUrl = "";
    const imageBase64 = formData.get("imageBase64");
    const file = formData.get("image");

    if (typeof imageBase64 === "string" && imageBase64.trim().length > 0) {
      imageUrl = imageBase64;
    } else if (typeof File !== "undefined" && file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = file.type || "image/jpeg";
      imageUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    }

    const newEvent = new Event({
      title,
      description,
      location: location.trim(),
      startDate,
      endDate,
      image: imageUrl,
      isPublic,
      guestLimit: Number.isFinite(guestLimit) ? guestLimit : 0,
      attending: Number.isFinite(attending) ? attending : 0,
      createdBy: userId,
      createdByName: user.username,
      status: moderationStatus,
    });

    await newEvent.save();

    return NextResponse.json({
      message: "Event created successfully",
      success: true,
      eventId: newEvent._id,
      imageUrl,
      status: moderationStatus,
    });
  } catch (error: any) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create event" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await connect();
    const session = await getServerSession(authOptions);
    const requesterId = session?.user?.id?.toString();

    // Optimized query - now that images are URLs, we can include them
    const events = await Event.find({})
      .select('-__v -comments') // Exclude heavy fields (comments can be large)
      .lean()
      .exec();

    const filteredEvents = events.filter((event: any) => {
      const creatorId =
        typeof event.createdBy?.toString === "function"
          ? event.createdBy.toString()
          : event.createdBy;

      if (event.status === "approved") {
        return true;
      }

      return Boolean(requesterId && creatorId && creatorId === requesterId);
    });

    const userIds = Array.from(
      new Set(
        filteredEvents
          .map((e: any) =>
            typeof e.createdBy?.toString === "function"
              ? e.createdBy.toString()
              : e.createdBy
          )
          .filter(Boolean)
      )
    );

    // Now fetch username AND image - they're just URLs now, very lightweight!
    const users = await User.find({ _id: { $in: userIds } })
      .select('username image')
      .lean()
      .exec();

    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    // Map the data to the expected format
    const eventsWithUserDetails = filteredEvents.map((event: any) => {
      const user = userMap.get(event.createdBy?.toString());
      return {
        ...event,
        _id: event._id.toString(),
        createdByName: event.createdByName || user?.username || "Eventful Host",
        // Use user image URL (now lightweight) or default
        createdByImage: user?.image || "https://cdn.pfps.gg/pfps/2301-default-2.png",
      };
    });

    return NextResponse.json({ events: eventsWithUserDetails });
  } catch (error: any) {
    console.error("Error fetching events:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
