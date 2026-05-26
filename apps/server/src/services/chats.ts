import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '../libs/db'
import * as schema from '../schemas/chats'
import { createConflictError, createForbiddenError } from '../utils/error'

type ChatType = 'private' | 'bot' | 'group' | 'channel'
type MessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'error'
type ChatMemberType = 'user' | 'character' | 'bot'

interface SyncChatMessagePayload {
  id: string
  role: MessageRole
  content: string
  createdAt?: number
}

interface SyncChatMemberPayload {
  type: ChatMemberType
  userId?: string
  characterId?: string
}

interface SyncChatPayload {
  chat: {
    id: string
    type?: ChatType
    title?: string
    createdAt?: number
    updatedAt?: number
  }
  members?: SyncChatMemberPayload[]
  messages: SyncChatMessagePayload[]
}

function resolveSenderId(role: MessageRole, userId: string, characterId?: string) {
  if (role === 'user') return userId
  return characterId ?? role
}

function pickCharacterId(members: SyncChatMemberPayload[] | undefined) {
  return members?.find((member) => member.type === 'character' && member.characterId)?.characterId
}

export function createChatService(db: Database) {
  return {
    async syncChat(userId: string, payload: SyncChatPayload) {
      return await db.transaction(async (tx) => {
        const now = new Date()
        const chatId = payload.chat.id
        const members = payload.members ?? []
        const characterId = pickCharacterId(members)

        const existingChat = await tx.query.chats.findFirst({
          where: eq(schema.chats.id, chatId),
        })

        if (existingChat) {
          const member = await tx.query.chatMembers.findFirst({
            where: and(
              eq(schema.chatMembers.chatId, chatId),
              eq(schema.chatMembers.memberType, 'user'),
              eq(schema.chatMembers.userId, userId),
            ),
          })

          if (!member) throw createForbiddenError()
        }

        if (!existingChat) {
          await tx.insert(schema.chats).values({
            createdAt: payload.chat.createdAt ? new Date(payload.chat.createdAt) : now,
            id: chatId,
            title: payload.chat.title,
            type: payload.chat.type ?? 'group',
            updatedAt: payload.chat.updatedAt ? new Date(payload.chat.updatedAt) : now,
          })
        } else {
          const updates: Partial<schema.NewChat> = {
            updatedAt: payload.chat.updatedAt ? new Date(payload.chat.updatedAt) : now,
          }

          if (payload.chat.type) updates.type = payload.chat.type
          if (payload.chat.title !== undefined) updates.title = payload.chat.title

          await tx.update(schema.chats).set(updates).where(eq(schema.chats.id, chatId))
        }

        const desiredMembers: SyncChatMemberPayload[] = [
          { type: 'user', userId },
          ...members.filter((member) => member.type !== 'user'),
        ]

        for (const member of desiredMembers) {
          if (member.type === 'user' && !member.userId) continue
          if (member.type === 'character' && !member.characterId) continue

          const existingMember = await tx.query.chatMembers.findFirst({
            where: and(
              eq(schema.chatMembers.chatId, chatId),
              eq(schema.chatMembers.memberType, member.type),
              member.type === 'user'
                ? eq(schema.chatMembers.userId, member.userId!)
                : eq(schema.chatMembers.characterId, member.characterId!),
            ),
          })

          if (!existingMember) {
            await tx.insert(schema.chatMembers).values({
              characterId: member.type === 'character' ? member.characterId : null,
              chatId,
              memberType: member.type,
              userId: member.type === 'user' ? member.userId : null,
            })
          }
        }

        if (payload.messages.length > 0) {
          const messageIds = payload.messages.map((m) => m.id)
          const existingMessages = await tx
            .select({ chatId: schema.messages.chatId, id: schema.messages.id })
            .from(schema.messages)
            .where(inArray(schema.messages.id, messageIds))

          const conflicting = existingMessages.find((m) => m.chatId !== chatId)
          if (conflicting) throw createConflictError('Message already belongs to another chat')

          await tx
            .insert(schema.messages)
            .values(
              payload.messages.map((message) => ({
                chatId,
                content: message.content,
                createdAt: message.createdAt ? new Date(message.createdAt) : now,
                id: message.id,
                mediaIds: [] as string[],
                role: message.role,
                senderId: resolveSenderId(message.role, userId, characterId),
                stickerIds: [] as string[],
                updatedAt: now,
              })),
            )
            .onConflictDoUpdate({
              set: {
                content: sql`excluded.content`,
                role: sql`excluded.role`,
                senderId: sql`excluded.sender_id`,
                updatedAt: sql`excluded.updated_at`,
              },
              target: schema.messages.id,
            })
        }

        return { chatId }
      })
    },
  }
}

export type ChatService = ReturnType<typeof createChatService>
