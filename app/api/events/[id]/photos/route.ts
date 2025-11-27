import { NextResponse } from "next/server";
import { connect } from "@/app/config/dbConfig";
import Event from "@/app/models/event";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const canAccessPhotos = (event: any, userId?: string | null) => {
  const creatorId = event?.createdBy?.toString?.();
  const attendeeIds = (event?.attendees || []).map((attendee: any) =>
    attendee?._id?.toString?.() ?? attendee?.toString?.()
  );
  const isHost = Boolean(userId && creatorId && creatorId === userId);
  const isAttendee = Boolean(userId && attendeeIds.includes(userId));

  return Boolean(event?.isPublic || isHost || isAttendee);
};

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

    const session = await getServerSession(authOptions);
    const requesterId = session?.user?.id?.toString();
    if (!requesterId) {
      return NextResponse.json({ message: "⚠️ Authentication required" }, { status: 401 });
    }

    if (!canAccessPhotos(event, requesterId)) {
      return NextResponse.json(
        { message: "⚠️ You need host approval to share photos for this event" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "⚠️ No file uploaded" }, { status: 400 });
    }

    const fileUrl = `https://your-storage.com/uploads/${file.name}`;

    if (!Array.isArray(event.photos)) {
      event.photos = [];
    }

    event.photos.push(fileUrl);
    await event.save();

    return NextResponse.json({ message: "✅ Photo uploaded successfully", photos: event.photos }, { status: 200 });
  } catch (error) {
    console.error("❌ Error uploading photo:", error);
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

    const session = await getServerSession(authOptions);
    const requesterId = session?.user?.id?.toString();
    if (!canAccessPhotos(event, requesterId)) {
      return NextResponse.json(
        { message: "⚠️ You need host approval to view photos for this event" },
        { status: 403 }
      );
    }

    const photos = event.photos?.map((photo: string) => {
      return photo.startsWith("http") ? photo : `/uploads/${photo}`;
    }) || [];

    return NextResponse.json({ photos }, { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching photos:", error);
    return NextResponse.json({ message: "❌ Internal server error" }, { status: 500 });
  }
}
