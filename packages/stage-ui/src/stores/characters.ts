import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { parse } from 'valibot'
import { ref } from 'vue'
import { client } from '../composables/api'
import { useLocalFirstRequest } from '../composables/use-local-first'
import { charactersRepo } from '../database/repos/characters.repo'
import type { Character, CreateCharacterPayload, UpdateCharacterPayload } from '../types/character'
import { CharacterWithRelationsSchema } from '../types/character'
import { useAuthStore } from './auth'

function buildLocalCharacter(userId: string, payload: CreateCharacterPayload) {
  const id = payload.character.id ?? nanoid()
  const now = new Date()

  return parse(CharacterWithRelationsSchema, {
    avatarModels: payload.avatarModels?.map((model) => ({
      characterId: id,
      config: model.config,
      createdAt: now,
      description: model.description,
      id: nanoid(),
      name: model.name,
      type: model.type,
      updatedAt: now,
    })),
    avatarUrl: undefined,
    bookmarks: [],
    bookmarksCount: 0,
    capabilities: payload.capabilities?.map((capability) => ({
      characterId: id,
      config: capability.config,
      id: nanoid(),
      type: capability.type,
    })),
    characterAvatarUrl: undefined,
    characterId: payload.character.characterId,
    coverBackgroundUrl: undefined,
    coverUrl: payload.character.coverUrl,
    createdAt: now,
    creatorId: userId,
    creatorRole: undefined,
    deletedAt: undefined,
    forksCount: 0,
    i18n: payload.i18n?.map((item) => ({
      characterId: id,
      createdAt: now,
      description: item.description,
      id: nanoid(),
      language: item.language,
      name: item.name,
      tags: item.tags,
      updatedAt: now,
    })),
    id,
    interactionsCount: 0,
    likes: [],
    likesCount: 0,
    ownerId: userId,
    priceCredit: '0',
    prompts: payload.prompts?.map((prompt) => ({
      characterId: id,
      content: prompt.content,
      id: nanoid(),
      language: prompt.language,
      type: prompt.type,
    })),
    updatedAt: now,
    version: payload.character.version,
  })
}

export const useCharacterStore = defineStore('characters', () => {
  const characters = ref<Map<string, Character>>(new Map())
  const auth = useAuthStore()

  async function fetchList(all: boolean = false) {
    return useLocalFirstRequest({
      local: async () => {
        const cached = await charactersRepo.getAll()
        if (cached.length > 0) {
          characters.value.clear()
          for (const char of cached) {
            characters.value.set(char.id, char)
          }
        }
      },
      remote: async () => {
        const res = await client.api.characters.$get({
          query: { all: String(all) },
        })
        if (!res.ok) {
          throw new Error('Failed to fetch characters')
        }
        const data = await res.json()

        characters.value.clear()
        const parsedData: Character[] = []
        for (const char of data) {
          const parsed = parse(CharacterWithRelationsSchema, char)
          characters.value.set(char.id, parsed)
          parsedData.push(parsed)
        }
        await charactersRepo.saveAll(parsedData)
      },
    })
  }

  async function fetchById(id: string) {
    return useLocalFirstRequest({
      local: async () => {
        const cached = characters.value.get(id) ?? (await charactersRepo.getAll()).find((char) => char.id === id)
        if (cached) {
          characters.value.set(cached.id, cached)
        }
        return cached
      },
      remote: async () => {
        const res = await client.api.characters[':id'].$get({
          param: { id },
        })
        if (!res.ok) {
          throw new Error('Failed to fetch character')
        }
        const data = await res.json()
        const character = parse(CharacterWithRelationsSchema, data)

        characters.value.set(character.id, character)
        await charactersRepo.upsert(character)
        return character
      },
    })
  }

  async function create(payload: CreateCharacterPayload) {
    let localCharacter: Character
    return useLocalFirstRequest({
      local: async () => {
        localCharacter = buildLocalCharacter(auth.userId, payload)
        characters.value.set(localCharacter.id, localCharacter)
        await charactersRepo.upsert(localCharacter)
        return localCharacter
      },
      remote: async () => {
        const res = await client.api.characters.$post({
          json: payload,
        })
        if (!res.ok) {
          throw new Error('Failed to create character')
        }
        const data = await res.json()
        const character = parse(CharacterWithRelationsSchema, data)

        // Replace local temp character with remote data
        characters.value.delete(localCharacter.id)
        characters.value.set(character.id, character)
        await charactersRepo.remove(localCharacter.id)
        await charactersRepo.upsert(character)
        return character
      },
    })
  }

  async function update(id: string, payload: UpdateCharacterPayload) {
    return useLocalFirstRequest({
      local: async () => {
        const character = characters.value.get(id)
        if (!character) {
          return
        }
        if (payload.version !== undefined) character.version = payload.version
        if (payload.coverUrl !== undefined) character.coverUrl = payload.coverUrl
        if (payload.characterId !== undefined) character.characterId = payload.characterId
        character.updatedAt = new Date()
        characters.value.set(character.id, character)
        await charactersRepo.upsert(character)
        return character
      },
      remote: async () => {
        const res = await client.api.characters[':id'].$patch({
          // @ts-expect-error FIXME: hono client typing misses json option for this route
          json: payload,
          param: { id },
        })
        if (!res.ok) {
          throw new Error('Failed to update character')
        }
        const data = await res.json()
        const character = parse(CharacterWithRelationsSchema, data)

        characters.value.set(character.id, character)
        await charactersRepo.upsert(character)
        return character
      },
    })
  }

  async function remove(id: string) {
    return useLocalFirstRequest({
      local: async () => {
        characters.value.delete(id)
        await charactersRepo.remove(id)
      },
      remote: async () => {
        const res = await client.api.characters[':id'].$delete({
          param: { id },
        })
        if (!res.ok) {
          throw new Error('Failed to remove character')
        }
      },
    })
  }

  async function like(id: string) {
    return useLocalFirstRequest({
      local: async () => {
        const character = characters.value.get(id)
        if (!character) {
          return
        }
        const likes = character.likes ?? []
        if (!likes.some((item) => item.userId === auth.userId)) {
          likes.push({ characterId: id, userId: auth.userId })
          character.likes = likes
          character.likesCount += 1
          character.updatedAt = new Date()
          characters.value.set(character.id, character)
          await charactersRepo.upsert(character)
        }
      },
      remote: async () => {
        const res = await client.api.characters[':id'].like.$post({
          param: { id },
        })
        if (!res.ok) {
          throw new Error('Failed to like character')
        }

        const data = await res.json()
        const character = parse(CharacterWithRelationsSchema, data)
        characters.value.set(character.id, character)
        await charactersRepo.upsert(character)
      },
    })
  }

  async function bookmark(id: string) {
    return useLocalFirstRequest({
      local: async () => {
        const character = characters.value.get(id)
        if (!character) {
          return
        }
        const bookmarks = character.bookmarks ?? []
        if (!bookmarks.some((item) => item.userId === auth.userId)) {
          bookmarks.push({ characterId: id, userId: auth.userId })
          character.bookmarks = bookmarks
          character.bookmarksCount += 1
          character.updatedAt = new Date()
          characters.value.set(character.id, character)
          await charactersRepo.upsert(character)
        }
      },
      remote: async () => {
        const res = await client.api.characters[':id'].bookmark.$post({
          param: { id },
        })
        if (!res.ok) {
          throw new Error('Failed to bookmark character')
        }

        const data = await res.json()
        const character = parse(CharacterWithRelationsSchema, data)
        characters.value.set(character.id, character)
        await charactersRepo.upsert(character)
      },
    })
  }

  function getCharacter(id: string) {
    return characters.value.get(id)
  }

  return {
    bookmark,
    characters,
    create,
    fetchById,

    fetchList,
    getCharacter,
    like,
    remove,
    update,
  }
})
