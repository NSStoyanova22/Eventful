import User from "@/app/models/user";
import { NextRequest, NextResponse } from "next/server";
import { connect } from "@/app/config/dbConfig";

export async function POST(req: NextRequest) {
    await connect();
    
    try {
        const body = await req.json();

        // Now that images are URLs (not base64), always include them - they're lightweight!
        const user = await User.findOne({ email: body.email }).lean();

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ user }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
