import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { connect } from "@/app/config/dbConfig";
import UserModel from "@/app/models/user";
import User from "@/app/models/user";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        const { email, password } = credentials;

        try {
          await connect();
          const dbUser = await User.findOne({ email });
          if (!dbUser) {
            return null;
          }

          const valid = await bcryptjs.compare(password, dbUser.password);
          if (!valid) {
            return null;
          }

          return {
            id: dbUser._id.toString(),
            email: dbUser.email || null,
            name: dbUser.name || null,
            image: dbUser.image ?? null,
            lastName: dbUser.lastName ?? null,
          };
        } catch (error) {
          console.error("Error authorizing credentials:", error);
          throw new Error("Unable to sign in. Please try again later.");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
   
    async jwt({ token, user }) {
      if (user) {
        await connect();
        const dbUser = await User.findOne({ email: user.email });
        token.id = user.id;
        token.email = user.email ?? undefined;
        token.name = user.name ?? undefined;
        token.picture = user.image ?? undefined;
        token.lastName = dbUser.lastName ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      const userSession: any = session;
      if (userSession.user) {
        userSession.user.id = token.id || "";
        userSession.user.email = token.email || null;
        userSession.user.name = token.name || null;
        userSession.user.image = token.picture || null;
        userSession.user.lastName = token.lastName || null;
      }
     
      userSession.accessToken = token;
      // console.log("userSession!!!!!!!!!!!!!!!!!!!!:", userSession);
      return userSession;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
