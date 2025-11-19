import { connect } from "@/app/config/dbConfig";
import User from "@/app/models/user";
import Event from "@/app/models/event";
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
        const { email, image, name, lastName, username } = await req.json();
        console.log("Request body:", {
            email,
            hasImage: Boolean(image),
            hasName: Boolean(name),
            hasLastName: Boolean(lastName),
            hasUsername: Boolean(username)
        });

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const updates: Record<string, string> = {};
        let usernameChanged = false;
        const trimmedImage = typeof image === "string" ? image.trim() : "";
        const trimmedName = typeof name === "string" ? name.trim() : "";
        const trimmedLastName = typeof lastName === "string" ? lastName.trim() : "";
        const trimmedUsername = typeof username === "string" ? username.trim() : "";

        if (trimmedImage) {
            updates.image = trimmedImage;
        }
        if (trimmedName) {
            updates.name = trimmedName;
        }
        if (trimmedLastName) {
            updates.lastName = trimmedLastName;
        }
        if (trimmedUsername && trimmedUsername !== existingUser.username) {
            const usernameTaken = await User.findOne({
                username: trimmedUsername,
                _id: { $ne: existingUser._id }
            });

            if (usernameTaken) {
                return NextResponse.json({ error: "Username already taken" }, { status: 409 });
            }

            updates.username = trimmedUsername;
            usernameChanged = true;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
        }

        const updatedUser = await User.findByIdAndUpdate(
            existingUser._id,
            { $set: updates },
            { new: true }
        );

        if (!updatedUser) {
            console.log("User not found");
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (usernameChanged && updates.username) {
            const newUsername = updates.username;

            await Event.updateMany(
                { createdBy: existingUser._id },
                { $set: { createdByName: newUsername } }
            );

            await Event.updateMany(
                { "comments.userId": existingUser._id },
                {
                    $set: {
                        "comments.$[comment].userName": newUsername
                    }
                },
                {
                    arrayFilters: [{ "comment.userId": existingUser._id }]
                }
            );
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
