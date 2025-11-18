import { connect } from "@/app/config/dbConfig";
import User from "@/app/models/user";
import bcryptjs from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    console.log("Register API hit");
    await connect();
    try {
        const { name, lastName, email, username, password, image } = await req.json();
        console.log("Request body:", { name, lastName, email, username, password, image });

        const ifUserExists = await User.findOne({ email });
        if (ifUserExists) {
            console.log("User already exists");
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        const salt = await bcryptjs.genSaltSync(10);
        const hashedPassword = await bcryptjs.hash(password, salt);

        const savedUser = await new User({
            name,
            lastName,
            email,
            username,
            password: hashedPassword,
            image
        }).save();

        console.log("User created successfully:", savedUser);
        return NextResponse.json({
            message: "User created successfully",
            success: true,
            savedUser
        });

    } catch (error: any) {
        console.error("Error in register API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
export async function GET(req: NextRequest) {
    await connect();
    
    try{
        
        const users = await User.find({});
        return NextResponse.json({users});
    } catch(error: any){
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

}


export async function PATCH(req: NextRequest) {
    console.log("Profile update API hit");
    await connect();

    try {
        const { email, image, name, lastName } = await req.json();
        console.log("Request body:", { email, hasImage: Boolean(image), hasName: Boolean(name), hasLastName: Boolean(lastName) });

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const updates: Record<string, string> = {};

        if (typeof image === "string" && image.trim() !== "") {
            updates.image = image.trim();
        }
        if (typeof name === "string" && name.trim() !== "") {
            updates.name = name.trim();
        }
        if (typeof lastName === "string" && lastName.trim() !== "") {
            updates.lastName = lastName.trim();
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
        }

        const updatedUser = await User.findOneAndUpdate(
            { email },
            { $set: updates },
            { new: true }
        );

        if (!updatedUser) {
            console.log("User not found");
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        console.log("Profile updated successfully:", updates);
        return NextResponse.json({
            message: "Profile updated successfully",
            success: true,
            user: updatedUser
        });

    } catch (error: any) {
        console.error("Error in profile update API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}