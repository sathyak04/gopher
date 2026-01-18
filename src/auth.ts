
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "./db"
import { users } from "./db/schema"
import { eq } from "drizzle-orm"

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: DrizzleAdapter(db),
    session: { strategy: "jwt" }, // Required for Credentials provider integration with Adapter
    providers: [
        Google({
            authorization: {
                params: {
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            }
        }),
        Credentials({
            name: "Debug User",
            credentials: {},
            authorize: async (credentials) => {
                const debugUser = {
                    id: "debug-user-id",
                    name: "Debug User",
                    email: "debug@example.com",
                    image: "",
                }

                // Upsert Debug User to DB so foreign keys work
                try {
                    const existing = await db.select().from(users).where(eq(users.id, debugUser.id)).limit(1)
                    if (existing.length === 0) {
                        await db.insert(users).values(debugUser)
                    }

                    // SEED DATA: Check if any chats exist for debug user, if not, create one
                    const { chats, messages } = await import("./db/schema");
                    const existingChats = await db.select().from(chats).where(eq(chats.userId, debugUser.id)).limit(1);

                    if (existingChats.length === 0) {
                        const chatId = crypto.randomUUID();
                        await db.insert(chats).values({
                            id: chatId,
                            userId: debugUser.id,
                            title: "Welcome to Gopher (Debug)",
                            isPinned: true,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });

                        await db.insert(messages).values({
                            id: crypto.randomUUID(),
                            chatId: chatId,
                            role: 'assistant',
                            content: "Hello! This is a pre-seeded chat for the Debug User. You can test features here.",
                            createdAt: new Date(),
                        });
                    }
                } catch (e) {
                    console.error("Failed to upsert debug user or seed data", e)
                }

                return debugUser
            },
        }),
    ],
    callbacks: {
        session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub
            }
            return session
        }
    }
})
