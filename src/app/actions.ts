
'use server'

import { auth } from "@/auth"
import { db } from "@/db"
import { chats, messages } from "@/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"

export async function getChats() {
    noStore();
    const session = await auth()
    if (!session?.user?.id) return []

    console.log(`[getChats] Fetching chats for user: ${session.user.id} (${session.user.email})`);

    const userChats = await db.select()
        .from(chats)
        .where(eq(chats.userId, session.user.id))
        .orderBy(desc(chats.updatedAt))

    // Sort pinned chats to top, then by timestamp
    const sorted = userChats.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    return sorted.map(c => ({
        id: c.id,
        preview: c.title,
        timestamp: c.updatedAt.getTime(),
        isPinned: c.isPinned
    }))
}

export async function getChat(chatId: string) {
    const session = await auth()
    if (!session?.user?.id) return null

    const chatsList = await db.select()
        .from(chats)
        .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))
        .limit(1)

    const chat = chatsList[0]

    if (!chat) return null

    // Fetch messages
    const chatMessages = await db.select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(messages.createdAt)

    // Parse data (events, itinerary)
    let extraData = {}
    try {
        if (chat.data) {
            extraData = JSON.parse(chat.data)
            console.log(`[getChat] Parsed extra data for ${chatId}:`, Object.keys(extraData));
        }
    } catch (e) {
        console.error(`[getChat] Failed to parse data for ${chatId}`, e);
    }

    return {
        ...chat,
        messages: chatMessages,
        ...extraData
    }
}

export async function saveChat(chatId: string, title: string, msgs: any[], data: any, isPinned?: boolean) {
    console.log(`[saveChat] Saving for ${chatId}, title: ${title}, keys: ${Object.keys(data)}`);
    const session = await auth()
    if (!session?.user?.id) return { error: "Not authenticated" }
    console.log(`[saveChat] Saving chat ${chatId} for user: ${session.user.id} (${session.user.email})`);

    // Upsert Chat
    // Check if exists
    const existing = await db.select({ id: chats.id }).from(chats).where(eq(chats.id, chatId)).limit(1)

    if (existing.length > 0) {
        await db.update(chats)
            .set({
                title,
                data: JSON.stringify(data),
                updatedAt: new Date(),
                // Only update isPinned if provided (undefined means distinct update action usually)
                ...(isPinned !== undefined ? { isPinned } : {})
            })
            .where(eq(chats.id, chatId))
    } else {
        await db.insert(chats).values({
            id: chatId,
            userId: session.user.id,
            title,
            data: JSON.stringify(data),
            isPinned: isPinned || false,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
    }

    // Replace messages (simple sync strategy: delete all for this chat and re-insert)
    // This is inefficient for huge chats but fine for hackathon.
    // Better: upsert or only insert new. For simplicity, we just save what client gives.
    // Actually, client might send partials? No, usually sends all.
    // Let's implement a smarter "append only" or just "delete all" for now to be safe.

    // Wait, if we delete all, we lose creation times if not careful.
    // Let's try to just insert new ones? 
    // Client has IDs. 
    // For simplicity: Delete all and re-insert is easiest to keep sync.

    await db.delete(messages).where(eq(messages.chatId, chatId))

    if (msgs.length > 0) {
        await db.insert(messages).values(msgs.map(m => ({
            id: crypto.randomUUID(), // Or usage client ID if persisted? Client messages logic in Chat.tsx doesn't have stable IDs usually unless we added them. NextAuth Chat usually has IDs.
            // Chat.tsx uses simple objects {role, content}.
            chatId: chatId,
            role: m.role,
            content: m.content,
            createdAt: new Date(), // We lose original timestamp of msg if we don't track it.
        })))
    }

    revalidatePath('/')
    return { success: true }
}

export async function deleteChat(chatId: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Not authenticated" }

    await db.delete(chats).where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))
    revalidatePath('/')
    return { success: true }
}

export async function renameChat(chatId: string, title: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Not authenticated" }

    await db.update(chats)
        .set({ title, updatedAt: new Date() })
        .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))

    revalidatePath('/')
    return { success: true }
}

export async function togglePinChat(chatId: string, isPinned: boolean) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Not authenticated" }

    await db.update(chats)
        .set({ isPinned, updatedAt: new Date() })
        .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))

    revalidatePath('/')
    return { success: true }
}
