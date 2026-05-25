import { array, literal, number, object, optional, string, union } from 'valibot'

const ChatTypeSchema = union([literal('private'), literal('bot'), literal('group'), literal('channel')])

const ChatMemberTypeSchema = union([literal('user'), literal('character'), literal('bot')])

const ChatMessageRoleSchema = union([
  literal('system'),
  literal('user'),
  literal('assistant'),
  literal('tool'),
  literal('error'),
])

export const ChatSyncMessageSchema = object({
  content: string(),
  createdAt: optional(number()),
  id: string(),
  role: ChatMessageRoleSchema,
})

export const ChatSyncSchema = object({
  chat: object({
    createdAt: optional(number()),
    id: string(),
    title: optional(string()),
    type: optional(ChatTypeSchema),
    updatedAt: optional(number()),
  }),
  members: optional(
    array(
      object({
        characterId: optional(string()),
        type: ChatMemberTypeSchema,
        userId: optional(string()),
      }),
    ),
  ),
  messages: array(ChatSyncMessageSchema),
})
