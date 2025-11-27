import { NextResponse } from "next/server";
import { connect } from "@/app/config/dbConfig";
import { ObjectId } from "mongodb";
import Event from "@/app/models/event";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!params.id) {
    return NextResponse.json({ message: "⚠️ Event ID is required" }, { status: 400 });
  }

  try {
    await connect();
    const eventId = new ObjectId(params.id);

    const event = await Event.findById(eventId);
    if (!event) {
      return NextResponse.json({ message: "⚠️ Event not found" }, { status: 404 });
    }

    const { userId }: { userId: string } = await req.json();
    if (!userId) {
      return NextResponse.json({ message: "⚠️ User ID is required" }, { status: 400 });
    }

    if (!Array.isArray(event.attendees)) {
      event.attendees = [];
    }

    if (!Array.isArray(event.joinRequests)) {
      (event as any).joinRequests = [];
    }

    const alreadyJoined = event.attendees.some((uid: string | ObjectId) => uid.toString() === userId);

    if (alreadyJoined) {
      return NextResponse.json(
        { message: "⚠️ Already joined", requestStatus: "approved" },
        { status: 200 }
      );
    }

    const existingRequest = (event as any).joinRequests.find(
      (req: any) => req?.user?.toString?.() === userId
    );

    if (event.isPublic) {
      event.attendees.push(new ObjectId(userId));
      event.attending = (event.attending ?? 0) + 1;

      await event.save();

      return NextResponse.json(
        { message: "✅ Joined event successfully", attending: event.attending, requestStatus: "approved" },
        { status: 200 }
      );
    }

    if (existingRequest?.status === "pending") {
      return NextResponse.json(
        { message: "⏳ Join request already pending", requestStatus: "pending" },
        { status: 200 }
      );
    }

    if (existingRequest?.status === "approved") {
      // Ensure the attendee list stays in sync if it was approved previously
      event.attendees.push(new ObjectId(userId));
      event.attending = (event.attending ?? 0) + 1;

      await event.save();

      return NextResponse.json(
        { message: "✅ Already approved for this event", attending: event.attending, requestStatus: "approved" },
        { status: 200 }
      );
    }

    if (existingRequest?.status === "declined") {
      existingRequest.status = "pending";
      existingRequest.createdAt = new Date();
    } else {
      (event as any).joinRequests.push({
        user: new ObjectId(userId),
        status: "pending",
        createdAt: new Date(),
      });
    }

    await event.save();

    return NextResponse.json(
      {
        message: "✅ Join request sent to host",
        requestStatus: "pending",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("❌ Error joining event:", error);
    return NextResponse.json({ message: "❌ Internal server error" }, { status: 500 });
  }
}
