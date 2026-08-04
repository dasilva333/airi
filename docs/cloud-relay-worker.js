// File: worker.js
//
// Discord Global /chat command
// - Works in guild channels and Bot DMs
// - Supports text and one optional image, audio file, or video file
// - Uses Gemini 3 Flash Preview
// - Stores permanent memory by Discord User ID
// - Stores each new turn in an independent KV key first
// - Archives every 10 complete turns into one immutable archive key
// - Deletes source turn keys only after archive verification succeeds
// - Keeps media Base64 out of KV
// - Displays only the assistant reply in Discord
// - Splits long Discord replies into multiple messages
// - Separates the system owner, designated users, and general visitors
// - Summarizes every 20 owner turns into long-term memory
// - Does not automatically migrate or modify old history_<userId>_0001 data
//
// Required Cloudflare bindings:
//
// Secret:
//   GEMINI_API_KEY
//   DISCORD_TOKEN
//
// Plaintext variables:
//   DISCORD_PUBLIC_KEY
//   SYSTEM_PROMPT
//
// Optional plaintext variable:
//   GEMINI_MODEL = gemini-3-flash-preview
//
// KV binding:
//   MEMORY
//
// Discord /chat command options must include:
//   message : STRING     (optional)
//   image   : ATTACHMENT (optional)
//   audio   : ATTACHMENT (optional)
//   video   : ATTACHMENT (optional)
// The Worker accepts at most one attachment per request.

// ============================================================
// Discord signature verification
// ============================================================

function hexToUint8Array(hex) {
  if (!hex) {
    return new Uint8Array()
  }

  const matches = hex.match(/.{1,2}/g)

  if (!matches) {
    return new Uint8Array()
  }

  return new Uint8Array(
    matches.map(byte => Number.parseInt(byte, 16)),
  )
}

async function verifySignature(
  request,
  bodyText,
  publicKeyHex,
) {
  const signature
    = request.headers.get(
      'x-signature-ed25519',
    )

  const timestamp
    = request.headers.get(
      'x-signature-timestamp',
    )

  if (
    !signature
    || !timestamp
    || !publicKeyHex
  ) {
    return false
  }

  try {
    const encoder
      = new TextEncoder()

    const data
      = encoder.encode(
        timestamp + bodyText,
      )

    const keyData
      = hexToUint8Array(
        publicKeyHex,
      )

    const signatureData
      = hexToUint8Array(
        signature,
      )

    const key
      = await crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name:
            'NODE-ED25519',

          namedCurve:
            'NODE-ED25519',
        },
        false,
        ['verify'],
      )

    return await crypto.subtle.verify(
      'NODE-ED25519',
      key,
      signatureData,
      data,
    )
  }
  catch (error) {
    console.error(
      'Signature verification error:',
      error,
    )

    return false
  }
}

// ============================================================
// Basic helpers
// ============================================================

function jsonResponse(
  body,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
      },
    },
  )
}

function getCommandOption(
  interaction,
  optionName,
) {
  return (
    interaction.data?.options?.find(
      option =>
        option.name === optionName,
    ) ?? null
  )
}

function getAttachmentByOption(
  interaction,
  optionName,
) {
  const attachmentOption
    = getCommandOption(
      interaction,
      optionName,
    )

  if (!attachmentOption?.value) {
    return null
  }

  const attachmentId
    = attachmentOption.value

  return (
    interaction.data?.resolved
      ?.attachments?.[
        attachmentId
      ] ?? null
  )
}

function getMediaAttachment(
  interaction,
) {
  const candidates = [
    {
      kind: 'image',
      attachment:
        getAttachmentByOption(
          interaction,
          'image',
        ),
    },
    {
      kind: 'audio',
      attachment:
        getAttachmentByOption(
          interaction,
          'audio',
        ),
    },
    {
      kind: 'video',
      attachment:
        getAttachmentByOption(
          interaction,
          'video',
        ),
    },
  ].filter(
    item =>
      Boolean(item.attachment),
  )

  if (candidates.length > 1) {
    throw new Error(
      '圖片、語音和影片一次只能附上一個。',
    )
  }

  return candidates[0] ?? null
}

function getDiscordUserId(
  interaction,
) {
  return (
    interaction.member?.user?.id
    ?? interaction.user?.id
    ?? null
  )
}

// ============================================================
// KV keys
// ============================================================

/*
 * Long-term memory:
 * history:YOUR_OWNER_USER_ID
 */
function getLongTermMemoryKey(
  userId,
) {
  return `history:${userId}`
}

/*
 * Independent pending turn:
 * history_turn_<userId>_<Discord interaction ID>
 */
function getHistoryTurnPrefix(
  userId,
) {
  return `history_turn_${userId}_`
}

function getHistoryTurnKey(
  userId,
  interactionId,
) {
  const sortableInteractionId
    = String(interactionId)
      .padStart(20, '0')

  return (
    getHistoryTurnPrefix(userId)
    + sortableInteractionId
  )
}

/*
 * Immutable 10-turn archive:
 * history_archive_<userId>_<first ID>_<last ID>
 */
function getHistoryArchivePrefix(
  userId,
) {
  return `history_archive_${userId}_`
}

function getHistoryArchiveKey(
  userId,
  firstTurnKey,
  lastTurnKey,
) {
  const prefix
    = getHistoryTurnPrefix(userId)

  const firstId
    = firstTurnKey.startsWith(prefix)
      ? firstTurnKey.slice(prefix.length)
      : firstTurnKey

  const lastId
    = lastTurnKey.startsWith(prefix)
      ? lastTurnKey.slice(prefix.length)
      : lastTurnKey

  return (
    `${getHistoryArchivePrefix(userId)
    }${firstId}_${lastId}`
  )
}

/*
 * Independent summary backup:
 * memory_summary_<userId>_000000000020
 */
function getMemorySummaryPrefix(
  userId,
) {
  return `memory_summary_${userId}_`
}

function getMemorySummaryKey(
  userId,
  summarizedThroughTurn,
) {
  const paddedTurn
    = String(summarizedThroughTurn)
      .padStart(12, '0')

  return (
    getMemorySummaryPrefix(userId)
    + paddedTurn
  )
}

/*
 * Duplicate-interaction guard:
 * interaction_state_<Discord interaction ID>
 */
function getInteractionStateKey(
  interactionId,
) {
  return (
    `interaction_state_${
      String(interactionId)}`
  )
}

/*
 * Recent-history index:
 * history_recent_<Discord user ID>
 */
function getRecentHistoryKey(
  userId,
) {
  return (
    `history_recent_${
      String(userId)}`
  )
}

/*
 * Archive progress metadata:
 * history_archive_meta_<Discord user ID>
 */
function getArchiveMetaKey(
  userId,
) {
  return (
    `history_archive_meta_${
      String(userId)}`
  )
}

/*
 * Latest long-term-memory compaction backup.
 */
function getLongTermCompactionBackupKey(
  userId,
) {
  return (
    `history_compaction_backup:${
      String(userId)}`
  )
}

// ============================================================
// Deployment configuration
// ============================================================
// Replace the placeholder values below before deployment.
// Discord Snowflake IDs should remain strings to avoid precision loss.
// Keep authorization decisions server-side; never trust a displayed name.

// ============================================================
// Constants
// ============================================================

const OWNER_USER_ID
  = 'YOUR_OWNER_USER_ID'

/*
 * Pending turns are packed into an immutable archive
 * every 10 completed turns.
 */
const ARCHIVE_TURNS_PER_KEY
  = 10

/*
 * Only archive turns that have been visible long enough for
 * Cloudflare KV list/read propagation to settle.
 */
const ARCHIVE_SETTLE_DELAY_MS
  = 60 * 1000

/*
 * Gemini receives the most recent 10 turns.
 */
const HISTORY_CONTEXT_TURNS
  = 10

/*
 * Owner long-term memory is summarized every 20 turns.
 */
const SUMMARY_TURNS_INTERVAL
  = 20

/*
 * External request timeouts.
 */
const GEMINI_REQUEST_TIMEOUT_MS
  = 45000

const DISCORD_REQUEST_TIMEOUT_MS
  = 15000

const IMAGE_DOWNLOAD_TIMEOUT_MS
  = 15000

/*
 * Duplicate interaction state TTL.
 *
 * "processing" expires quickly so a crashed request
 * can be retried later.
 *
 * "completed" remains longer to prevent replay and
 * repeated Gemini charges.
 */
const INTERACTION_PROCESSING_TTL_SECONDS
  = 15 * 60

const INTERACTION_COMPLETED_TTL_SECONDS
  = 24 * 60 * 60

/*
 * Keep enough recent turns for normal context and maintenance.
 */
const RECENT_HISTORY_INDEX_TURNS
  = 40

/*
 * Compact long-term memory when it grows beyond this size.
 */
const LONG_TERM_MEMORY_MAX_CHARS
  = 8000

const LONG_TERM_MEMORY_TARGET_CHARS
  = 5000

// ============================================================
// Interaction state cache
// ============================================================

function parseInteractionState(
  raw,
) {
  if (
    typeof raw
    !== 'string'
    || !raw.trim()
  ) {
    return null
  }

  /*
   * Backward compatibility with the earlier plain-string state.
   */
  if (
    raw === 'processing'
    || raw === 'completed'
  ) {
    return {
      state:
        raw,

      replyText:
        '',

      finishReason:
        '',
    }
  }

  try {
    const parsed
      = JSON.parse(raw)

    if (
      !parsed
      || typeof parsed
      !== 'object'
      || ![
        'processing',
        'generated',
        'completed',
      ].includes(
        parsed.state,
      )
    ) {
      return null
    }

    return {
      state:
        parsed.state,

      replyText:
        typeof parsed.replyText
        === 'string'
          ? parsed.replyText
          : '',

      finishReason:
        typeof parsed.finishReason
        === 'string'
          ? parsed.finishReason
          : '',

      generatedAt:
        typeof parsed.generatedAt
        === 'string'
          ? parsed.generatedAt
          : '',
    }
  }
  catch {
    return null
  }
}

async function writeInteractionState(
  env,
  interactionStateKey,
  state,
  expirationTtl,
) {
  await env.MEMORY.put(
    interactionStateKey,
    JSON.stringify(
      state,
    ),
    {
      expirationTtl,
    },
  )
}

// ============================================================
// External fetch timeout helper
// ============================================================

async function fetchWithTimeout(
  input,
  init = {},
  timeoutMs =
    DISCORD_REQUEST_TIMEOUT_MS,
) {
  const controller
    = new AbortController()

  const timeoutId
    = setTimeout(
      () =>
        controller.abort(),
      timeoutMs,
    )

  try {
    return await fetch(
      input,
      {
        ...init,

        signal:
          controller.signal,
      },
    )
  }
  catch (error) {
    if (
      error?.name
      === 'AbortError'
    ) {
      throw new Error(
        `外部請求逾時（${timeoutMs} ms）。`,
      )
    }

    throw error
  }
  finally {
    clearTimeout(
      timeoutId,
    )
  }
}

// ============================================================
// Date and time
// ============================================================

function getTimestamp(
  date = new Date(),
) {
  return date.toISOString()
}

function getDate(
  date = new Date(),
) {
  return getTimestamp(
    date,
  ).slice(0, 10)
}

// ============================================================
// Media validation and conversion
// ============================================================

const MEDIA_LIMITS
  = Object.freeze({
    image: {
      maximumSize:
        5 * 1024 * 1024,

      allowedMimeTypes:
        new Set([
          'image/jpeg',
          'image/png',
          'image/webp',
        ]),
    },

    audio: {
      maximumSize:
        10 * 1024 * 1024,

      allowedMimeTypes:
        new Set([
          'audio/mpeg',
          'audio/mp4',
          'audio/aac',
          'audio/ogg',
          'audio/wav',
          'audio/x-wav',
          'audio/webm',
        ]),
    },

    video: {
      maximumSize:
        10 * 1024 * 1024,

      allowedMimeTypes:
        new Set([
          'video/mp4',
          'video/webm',
          'video/quicktime',
        ]),
    },
  })

function getMediaKindName(
  kind,
) {
  if (kind === 'image') {
    return '圖片'
  }

  if (kind === 'audio') {
    return '語音'
  }

  if (kind === 'video') {
    return '影片'
  }

  return '媒體'
}

function validateMediaAttachment(
  media,
) {
  if (!media) {
    return
  }

  const configuration
    = MEDIA_LIMITS[media.kind]

  if (!configuration) {
    throw new Error(
      '不支援的媒體類型。',
    )
  }

  const attachment
    = media.attachment

  if (
    !attachment?.content_type
    || !configuration
      .allowedMimeTypes
      .has(
        attachment.content_type,
      )
  ) {
    if (media.kind === 'image') {
      throw new Error(
        '圖片只支援 JPG、PNG 或 WebP。',
      )
    }

    if (media.kind === 'audio') {
      throw new Error(
        '語音只支援 MP3、M4A/AAC、OGG、WAV 或 WebM。',
      )
    }

    throw new Error(
      '影片只支援 MP4、WebM 或 MOV。',
    )
  }

  if (
    typeof attachment.size
    === 'number'
    && attachment.size
    > configuration.maximumSize
  ) {
    const maximumSizeMb
      = Math.floor(
        configuration.maximumSize
        / 1024
        / 1024,
      )

    throw new Error(
      `${getMediaKindName(media.kind)}太大，`
      + `請使用 ${maximumSizeMb} MB 以下的檔案。`,
    )
  }

  if (!attachment.url) {
    throw new Error(
      `Discord 沒有提供有效的`
      + `${getMediaKindName(media.kind)}網址。`,
    )
  }
}

async function downloadAttachmentAsBase64(
  attachment,
) {
  const response
    = await fetchWithTimeout(
      attachment.url,
      {
        method:
          'GET',

        headers: {
          'User-Agent':
            'ExampleDiscordBot/1.0',
        },
      },
      IMAGE_DOWNLOAD_TIMEOUT_MS,
    )

  if (!response.ok) {
    throw new Error(
      `無法下載附件，HTTP ${response.status}。`,
    )
  }

  const declaredLength
    = Number(
      response.headers.get(
        'Content-Length',
      ),
    )

  if (
    Number.isFinite(
      declaredLength,
    )
    && declaredLength
    > 10 * 1024 * 1024
  ) {
    throw new Error(
      '附件下載後超過 10 MB。',
    )
  }

  const arrayBuffer
    = await response.arrayBuffer()

  if (
    arrayBuffer.byteLength
    > 10 * 1024 * 1024
  ) {
    throw new Error(
      '附件下載後超過 10 MB。',
    )
  }

  const bytes
    = new Uint8Array(
      arrayBuffer,
    )

  let binaryString = ''

  const chunkSize
    = 0x8000

  for (
    let offset = 0;
    offset < bytes.length;
    offset += chunkSize
  ) {
    const chunk
      = bytes.subarray(
        offset,
        offset + chunkSize,
      )

    binaryString
      += String.fromCharCode(
        ...chunk,
      )
  }

  return btoa(
    binaryString,
  )
}

function buildDefaultMediaPrompt(
  mediaKind,
) {
  if (mediaKind === 'audio') {
    return (
      '請聆聽這段語音，整理內容並回答。'
    )
  }

  if (mediaKind === 'video') {
    return (
      '請查看這段影片，整理畫面與語音內容並回答。'
    )
  }

  return '請查看並分析這張圖片。'
}

// ============================================================
// Long-term memory
// ============================================================

function extractMemoryContent(
  content,
) {
  if (
    typeof content
    === 'string'
  ) {
    return content.trim()
  }

  if (
    Array.isArray(content)
  ) {
    return content
      .map((item) => {
        if (
          typeof item
          === 'string'
        ) {
          return item
        }

        if (
          item
          && typeof item.text
          === 'string'
        ) {
          return item.text
        }

        return ''
      })
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  if (
    content
    && typeof content.text
    === 'string'
  ) {
    return content.text.trim()
  }

  return ''
}

function parseLongTermMemoryValue(
  savedMemory,
) {
  if (
    typeof savedMemory
    !== 'string'
    || !savedMemory.trim()
  ) {
    return ''
  }

  try {
    const parsed
      = JSON.parse(
        savedMemory,
      )

    if (
      parsed
      && !Array.isArray(parsed)
      && typeof parsed.content
      === 'string'
    ) {
      return parsed.content.trim()
    }

    /*
     * 相容原 AIRI 陣列格式。
     */
    if (
      Array.isArray(parsed)
    ) {
      return parsed
        .map((entry) => {
          if (
            !entry
            || typeof entry
            !== 'object'
          ) {
            return ''
          }

          const text
            = extractMemoryContent(
              entry.content,
            )

          if (!text) {
            return ''
          }

          const role
            = String(
              entry.role || '',
            ).toLowerCase()

          if (
            role === 'system'
          ) {
            return (
              `【核心長期記憶】\n${
                text}`
            )
          }

          if (
            role
            === 'assistant'
            || role === 'model'
          ) {
            return (
              `【助理過往回應】\n${
                text}`
            )
          }

          if (
            role === 'user'
          ) {
            return (
              `【系統擁有者過往訊息】\n${
                text}`
            )
          }

          return text
        })
        .filter(Boolean)
        .join('\n\n')
        .trim()
    }

    if (
      typeof parsed
      === 'string'
    ) {
      return parsed.trim()
    }

    return ''
  }
  catch {
    return savedMemory.trim()
  }
}

function createDefaultLongTermDocument(
  userId,
) {
  return {
    version:
      1,

    type:
      'long_term_memory',

    character:
      'CloudAssistant',

    user:
      userId
      === OWNER_USER_ID
        ? 'Owner'
        : `Discord User ${userId}`,

    updated_at:
      getDate(),

    content:
      '',

    last_summarized_turns:
      0,

    /*
     * 保留舊欄位相容性。
     */
    last_summarized_entries:
      0,

    last_summary_at:
      '',
  }
}

function parseLongTermMemoryDocument(
  savedMemory,
  userId,
) {
  const defaultDocument
    = createDefaultLongTermDocument(
      userId,
    )

  if (
    typeof savedMemory
    !== 'string'
    || !savedMemory.trim()
  ) {
    return defaultDocument
  }

  const cleaned
    = savedMemory
      .replace(/^\uFEFF/, '')
      .trim()

  try {
    const parsed
      = JSON.parse(cleaned)

    if (
      parsed
      && !Array.isArray(parsed)
      && typeof parsed
      === 'object'
    ) {
      const oldEntryProgress
        = Math.max(
          0,
          Number(
            parsed
              .last_summarized_entries,
          ) || 0,
        )

      const summarizedTurns
        = Math.max(
          0,
          Number(
            parsed
              .last_summarized_turns,
          )
          || Math.floor(
            oldEntryProgress / 2,
          ),
        )

      return {
        ...parsed,

        version:
          Number(parsed.version) || 1,

        type:
          parsed.type
          || 'long_term_memory',

        character:
          parsed.character
          || '助理',

        user:
          parsed.user
          || defaultDocument.user,

        updated_at:
          parsed.updated_at
          || getDate(),

        content:
          typeof parsed.content
          === 'string'
            ? parsed.content.trim()
            : '',

        last_summarized_turns:
          summarizedTurns,

        last_summarized_entries:
          summarizedTurns * 2,

        last_summary_at:
          typeof parsed
            .last_summary_at
            === 'string'
            ? parsed.last_summary_at
            : '',
      }
    }

    if (
      typeof parsed
      === 'string'
    ) {
      return {
        ...defaultDocument,

        content:
          parsed.trim(),
      }
    }
  }
  catch {
    /*
     * 非 JSON 時保留為純文字。
     */
  }

  return {
    ...defaultDocument,

    content:
      cleaned,
  }
}

async function readLongTermMemoryDocument(
  env,
  userId,
) {
  const savedMemory
    = await env.MEMORY.get(
      getLongTermMemoryKey(
        userId,
      ),
    )

  return parseLongTermMemoryDocument(
    savedMemory,
    userId,
  )
}

async function writeLongTermMemoryDocument(
  env,
  userId,
  document,
) {
  await env.MEMORY.put(
    getLongTermMemoryKey(
      userId,
    ),
    JSON.stringify(
      document,
    ),
  )
}

async function loadLongTermMemory(
  env,
  userId,
) {
  if (!env.MEMORY) {
    return ''
  }

  const memoryKey
    = getLongTermMemoryKey(
      userId,
    )

  try {
    const savedMemory
      = await env.MEMORY.get(
        memoryKey,
      )

    if (!savedMemory) {
      console.warn(
        'Long-term memory not found:',
        memoryKey,
      )

      return ''
    }

    const longTermMemory
      = parseLongTermMemoryValue(
        savedMemory,
      )

    if (!longTermMemory) {
      console.warn(
        'Long-term memory is empty or invalid:',
        memoryKey,
      )

      return ''
    }

    console.log(
      'Long-term memory loaded:',
      memoryKey,
      'characters:',
      longTermMemory.length,
    )

    return longTermMemory
  }
  catch (error) {
    console.error(
      'Long-term memory read error:',
      error,
    )

    return ''
  }
}

// ============================================================
// Generic KV list helper
// ============================================================

async function listAllKvKeyNames(
  env,
  prefix,
) {
  const names = []
  let cursor

  do {
    const result
      = await env.MEMORY.list({
        prefix,

        limit:
          1000,

        ...(cursor
          ? { cursor }
          : {}),
      })

    for (
      const key of
      result.keys || []
    ) {
      if (
        key
        && typeof key.name
        === 'string'
      ) {
        names.push(
          key.name,
        )
      }
    }

    cursor
      = result.list_complete
        ? undefined
        : result.cursor
  } while (cursor)

  names.sort()

  return names
}

// ============================================================
// Turn records
// ============================================================

function isValidHistoryEntry(
  entry,
) {
  return Boolean(
    entry
    && typeof entry
    === 'object'
    && (
      entry.role === 'user'
      || entry.role === 'model'
    )
    && Array.isArray(entry.parts),
  )
}

function createTurnRecord(
  userId,
  interactionId,
  userEntry,
  modelEntry,
  createdAt =
    new Date().toISOString(),
  time =
    getTimestamp(),
) {
  return {
    version:
      1,

    type:
      'chat_turn',

    userId:
      String(userId),

    interactionId:
      String(interactionId),

    createdAt,

    time,

    user:
      userEntry,

    model:
      modelEntry,
  }
}

function parseTurnRecord(
  raw,
  expectedUserId,
) {
  if (
    typeof raw
    !== 'string'
    || !raw.trim()
  ) {
    return null
  }

  try {
    const parsed
      = JSON.parse(raw)

    if (
      !parsed
      || typeof parsed
      !== 'object'
      || parsed.type
      !== 'chat_turn'
      || String(parsed.userId)
      !== String(expectedUserId)
      || !isValidHistoryEntry(
        parsed.user,
      )
      || parsed.user.role
      !== 'user'
      || !isValidHistoryEntry(
        parsed.model,
      )
      || parsed.model.role
      !== 'model'
    ) {
      return null
    }

    return parsed
  }
  catch {
    return null
  }
}

async function saveIndependentChatTurn(
  env,
  userId,
  interactionId,
  userEntry,
  modelEntry,
) {
  if (!env.MEMORY) {
    throw new Error(
      'Cloudflare 尚未綁定 MEMORY KV。',
    )
  }

  const turnKey
    = getHistoryTurnKey(
      userId,
      interactionId,
    )

  const turnRecord
    = createTurnRecord(
      userId,
      interactionId,
      userEntry,
      modelEntry,
    )

  await env.MEMORY.put(
    turnKey,
    JSON.stringify(
      turnRecord,
    ),
  )

  /*
   * Update the small recent-history index so normal chat does
   * not need to read every archive.
   */
  await updateRecentHistoryIndexAfterTurn(
    env,
    userId,
    turnRecord,
  )

  console.log(
    'Independent chat turn saved:',
    turnKey,
  )

  return turnKey
}

async function loadTurnRecordByKey(
  env,
  userId,
  keyName,
) {
  const raw
    = await env.MEMORY.get(
      keyName,
    )

  if (!raw) {
    return null
  }

  return parseTurnRecord(
    raw,
    userId,
  )
}

async function loadTurnRecordsByKeys(
  env,
  userId,
  keyNames,
) {
  return Promise.all(
    keyNames.map(
      async keyName => ({
        keyName,

        turn:
          await loadTurnRecordByKey(
            env,
            userId,
            keyName,
          ),
      }),
    ),
  )
}

function compareTurnsChronologically(
  a,
  b,
) {
  const aCreatedAt
    = typeof a?.createdAt
      === 'string'
      ? a.createdAt.trim()
      : ''

  const bCreatedAt
    = typeof b?.createdAt
      === 'string'
      ? b.createdAt.trim()
      : ''

  const aTime
    = Date.parse(
      aCreatedAt,
    )

  const bTime
    = Date.parse(
      bCreatedAt,
    )

  const aHasValidTime
    = Number.isFinite(
      aTime,
    )

  const bHasValidTime
    = Number.isFinite(
      bTime,
    )

  /*
   * Legacy turns have no timestamp and are the oldest records.
   */
  if (
    !aHasValidTime
    && bHasValidTime
  ) {
    return -1
  }

  if (
    aHasValidTime
    && !bHasValidTime
  ) {
    return 1
  }

  if (
    aHasValidTime
    && bHasValidTime
    && aTime !== bTime
  ) {
    return aTime - bTime
  }

  return String(
    a?.interactionId || '',
  ).localeCompare(
    String(
      b?.interactionId || '',
    ),
  )
}

// ============================================================
// Recent-history index
// ============================================================

function parseRecentHistoryIndex(
  raw,
  expectedUserId,
) {
  if (
    typeof raw
    !== 'string'
    || !raw.trim()
  ) {
    return null
  }

  try {
    const parsed
      = JSON.parse(raw)

    if (
      !parsed
      || typeof parsed
      !== 'object'
      || parsed.type
      !== 'recent_history_index'
      || String(parsed.userId)
      !== String(expectedUserId)
      || !Array.isArray(
        parsed.turns,
      )
    ) {
      return null
    }

    const validTurns
      = parsed.turns.filter(
        turn =>
          turn
          && turn.type
          === 'chat_turn'
          && String(turn.userId)
          === String(expectedUserId)
          && isValidHistoryEntry(
            turn.user,
          )
          && isValidHistoryEntry(
            turn.model,
          ),
      )

    return {
      version:
        Number(parsed.version) || 1,

      type:
        'recent_history_index',

      userId:
        String(expectedUserId),

      totalTurns:
        Math.max(
          validTurns.length,
          Number(
            parsed.totalTurns,
          ) || 0,
        ),

      updatedAt:
        typeof parsed.updatedAt
        === 'string'
          ? parsed.updatedAt
          : '',

      turns:
        validTurns
          .sort(
            compareTurnsChronologically,
          )
          .slice(
            -RECENT_HISTORY_INDEX_TURNS,
          ),
    }
  }
  catch {
    return null
  }
}

async function readRecentHistoryIndex(
  env,
  userId,
) {
  if (!env.MEMORY) {
    return null
  }

  const raw
    = await env.MEMORY.get(
      getRecentHistoryKey(
        userId,
      ),
    )

  return parseRecentHistoryIndex(
    raw,
    userId,
  )
}

async function writeRecentHistoryIndex(
  env,
  userId,
  index,
) {
  await env.MEMORY.put(
    getRecentHistoryKey(
      userId,
    ),
    JSON.stringify({
      version:
        1,

      type:
        'recent_history_index',

      userId:
        String(userId),

      totalTurns:
        Math.max(
          0,
          Number(
            index.totalTurns,
          ) || 0,
        ),

      updatedAt:
        new Date().toISOString(),

      turns:
        [...index.turns]
          .sort(
            compareTurnsChronologically,
          )
          .slice(
            -RECENT_HISTORY_INDEX_TURNS,
          ),
    }),
  )
}

async function updateRecentHistoryIndexAfterTurn(
  env,
  userId,
  turnRecord,
) {
  if (!env.MEMORY) {
    return
  }

  const existing
    = await readRecentHistoryIndex(
      env,
      userId,
    )

  const existingTurns
    = existing?.turns || []

  const alreadyPresent
    = existingTurns.some(
      turn =>
        String(
          turn.interactionId,
        )
        === String(
          turnRecord.interactionId,
        ),
    )

  const mergedTurns
    = alreadyPresent
      ? existingTurns
      : [
          ...existingTurns,
          turnRecord,
        ]

  mergedTurns.sort(
    compareTurnsChronologically,
  )

  await writeRecentHistoryIndex(
    env,
    userId,
    {
      totalTurns:
        alreadyPresent
          ? (
              existing?.totalTurns
              || mergedTurns.length
            )
          : (
              existing
                ? existing.totalTurns + 1
                : mergedTurns.length
            ),

      turns:
        mergedTurns,
    },
  )
}

// ============================================================
// Archive progress metadata
// ============================================================

function parseArchiveMeta(
  raw,
  expectedUserId,
) {
  if (
    typeof raw
    !== 'string'
    || !raw.trim()
  ) {
    return null
  }

  try {
    const parsed
      = JSON.parse(raw)

    if (
      !parsed
      || typeof parsed
      !== 'object'
      || parsed.type
      !== 'archive_meta'
      || String(parsed.userId)
      !== String(expectedUserId)
    ) {
      return null
    }

    return {
      version:
        Number(parsed.version) || 1,

      type:
        'archive_meta',

      userId:
        String(expectedUserId),

      archivedTurns:
        Math.max(
          0,
          Number(
            parsed.archivedTurns,
          ) || 0,
        ),

      lastArchivedTurnKey:
        typeof parsed.lastArchivedTurnKey
        === 'string'
          ? parsed.lastArchivedTurnKey
          : '',

      lastArchiveKey:
        typeof parsed.lastArchiveKey
        === 'string'
          ? parsed.lastArchiveKey
          : '',

      updatedAt:
        typeof parsed.updatedAt
        === 'string'
          ? parsed.updatedAt
          : '',
    }
  }
  catch {
    return null
  }
}

async function readArchiveMeta(
  env,
  userId,
) {
  if (!env.MEMORY) {
    return null
  }

  const raw
    = await env.MEMORY.get(
      getArchiveMetaKey(
        userId,
      ),
    )

  return parseArchiveMeta(
    raw,
    userId,
  )
}

async function writeArchiveMeta(
  env,
  userId,
  meta,
) {
  await env.MEMORY.put(
    getArchiveMetaKey(
      userId,
    ),
    JSON.stringify({
      version:
        1,

      type:
        'archive_meta',

      userId:
        String(userId),

      archivedTurns:
        Math.max(
          0,
          Number(
            meta.archivedTurns,
          ) || 0,
        ),

      lastArchivedTurnKey:
        meta.lastArchivedTurnKey
        || '',

      lastArchiveKey:
        meta.lastArchiveKey
        || '',

      updatedAt:
        new Date().toISOString(),
    }),
  )
}

// ============================================================
// Immutable 10-turn archives
// ============================================================

function createArchiveRecord(
  userId,
  sourceTurnKeys,
  turns,
) {
  return {
    version:
      1,

    type:
      'chat_archive',

    userId:
      String(userId),

    turnCount:
      turns.length,

    sourceTurnKeys:
      [...sourceTurnKeys],

    firstTurnKey:
      sourceTurnKeys[0] || '',

    lastTurnKey:
      sourceTurnKeys[
        sourceTurnKeys.length - 1
      ] || '',

    createdAt:
      new Date().toISOString(),

    time:
      getTimestamp(),

    turns,
  }
}

function parseArchiveRecord(
  raw,
  expectedUserId,
) {
  if (
    typeof raw
    !== 'string'
    || !raw.trim()
  ) {
    return null
  }

  try {
    const parsed
      = JSON.parse(raw)

    if (
      !parsed
      || typeof parsed
      !== 'object'
      || parsed.type
      !== 'chat_archive'
      || String(parsed.userId)
      !== String(expectedUserId)
      || !Array.isArray(
        parsed.sourceTurnKeys,
      )
      || !Array.isArray(
        parsed.turns,
      )
      || parsed.sourceTurnKeys.length
      !== parsed.turns.length
      || parsed.turns.length
      !== ARCHIVE_TURNS_PER_KEY
    ) {
      return null
    }

    for (
      const turn of
      parsed.turns
    ) {
      if (
        !turn
        || turn.type
        !== 'chat_turn'
        || String(turn.userId)
        !== String(expectedUserId)
        || !isValidHistoryEntry(
          turn.user,
        )
        || !isValidHistoryEntry(
          turn.model,
        )
      ) {
        return null
      }
    }

    return parsed
  }
  catch {
    return null
  }
}

async function loadArchiveRecordByKey(
  env,
  userId,
  keyName,
) {
  const raw
    = await env.MEMORY.get(
      keyName,
    )

  if (!raw) {
    return null
  }

  return parseArchiveRecord(
    raw,
    userId,
  )
}

async function listHistoryTurnKeys(
  env,
  userId,
) {
  return listAllKvKeyNames(
    env,
    getHistoryTurnPrefix(
      userId,
    ),
  )
}

async function listHistoryArchiveKeys(
  env,
  userId,
) {
  return listAllKvKeyNames(
    env,
    getHistoryArchivePrefix(
      userId,
    ),
  )
}

async function loadArchiveRecords(
  env,
  userId,
  archiveKeys,
) {
  const records
    = await Promise.all(
      archiveKeys.map(
        keyName =>
          loadArchiveRecordByKey(
            env,
            userId,
            keyName,
          ),
      ),
    )

  return records.filter(Boolean)
}

function archiveMatchesSourceTurns(
  archive,
  sourceTurnKeys,
  sourceTurns,
) {
  if (
    !archive
    || archive.sourceTurnKeys.length
    !== sourceTurnKeys.length
    || archive.turns.length
    !== sourceTurns.length
  ) {
    return false
  }

  for (
    let index = 0;
    index
    < sourceTurnKeys.length;
    index += 1
  ) {
    if (
      archive.sourceTurnKeys[index]
      !== sourceTurnKeys[index]
    ) {
      return false
    }

    const archivedTurn
      = archive.turns[index]

    const sourceTurn
      = sourceTurns[index]

    if (
      !archivedTurn
      || !sourceTurn
      || archivedTurn.interactionId
      !== sourceTurn.interactionId
      || archivedTurn.createdAt
      !== sourceTurn.createdAt
      || JSON.stringify(
        archivedTurn.user,
      )
      !== JSON.stringify(
        sourceTurn.user,
      )
      || JSON.stringify(
        archivedTurn.model,
      )
      !== JSON.stringify(
          sourceTurn.model,
        )
    ) {
      return false
    }
  }

  return true
}

function sleep(
  milliseconds,
) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  )
}

async function loadArchiveWithRetry(
  env,
  userId,
  archiveKey,
  attempts = 4,
) {
  for (
    let attempt = 1;
    attempt <= attempts;
    attempt += 1
  ) {
    const archive
      = await loadArchiveRecordByKey(
        env,
        userId,
        archiveKey,
      )

    if (archive) {
      return archive
    }

    if (attempt < attempts) {
      await sleep(
        attempt * 250,
      )
    }
  }

  return null
}

async function deleteKvKeys(
  env,
  keyNames,
) {
  const failedKeys = []

  for (
    const keyName of keyNames
  ) {
    try {
      await env.MEMORY.delete(
        keyName,
      )
    }
    catch (error) {
      failedKeys.push(
        keyName,
      )

      console.error(
        'KV delete failed:',
        keyName,
        error,
      )
    }
  }

  return failedKeys
}

/*
 * Archive full groups of 10 independent turn keys.
 *
 * Safety order:
 * 1. Select only turns older than the settle delay.
 * 2. Load 10 source turns.
 * 3. Write immutable archive.
 * 4. Read archive back and validate it.
 * 5. Update archive metadata.
 * 6. Only then delete the 10 source turn keys.
 *
 * If read-back validation does not see the archive yet,
 * source keys remain untouched and the next chat retries.
 */
async function archivePendingTurns(
  env,
  userId,
) {
  if (!env.MEMORY) {
    return
  }

  let pendingTurnKeys
    = await listHistoryTurnKeys(
      env,
      userId,
    )

  let archiveMeta
    = await readArchiveMeta(
      env,
      userId,
    )

  /*
   * One-time migration for existing deployments.
   * Only the newest archive is read to establish progress.
   */
  if (!archiveMeta) {
    const archiveKeys
      = await listHistoryArchiveKeys(
        env,
        userId,
      )

    const newestArchiveKey
      = archiveKeys.length > 0
        ? archiveKeys[
          archiveKeys.length - 1
        ]
        : ''

    if (newestArchiveKey) {
      const newestArchive
        = await loadArchiveRecordByKey(
          env,
          userId,
          newestArchiveKey,
        )

      if (newestArchive) {
        archiveMeta = {
          version:
            1,

          type:
            'archive_meta',

          userId:
            String(userId),

          archivedTurns:
            archiveKeys.length
            * ARCHIVE_TURNS_PER_KEY,

          lastArchivedTurnKey:
            newestArchive.lastTurnKey,

          lastArchiveKey:
            newestArchiveKey,

          updatedAt:
            new Date().toISOString(),
        }

        await writeArchiveMeta(
          env,
          userId,
          archiveMeta,
        )
      }
    }

    if (!archiveMeta) {
      archiveMeta = {
        version:
          1,

        type:
          'archive_meta',

        userId:
          String(userId),

        archivedTurns:
          0,

        lastArchivedTurnKey:
          '',

        lastArchiveKey:
          '',

        updatedAt:
          new Date().toISOString(),
      }
    }
  }

  /*
   * Retry cleanup of source keys that were already archived
   * but remained visible because a previous delete failed or
   * had not propagated yet.
   */
  if (
    archiveMeta.lastArchivedTurnKey
  ) {
    const residualArchivedKeys
      = pendingTurnKeys.filter(
        keyName =>
          keyName.localeCompare(
            archiveMeta
              .lastArchivedTurnKey,
          ) <= 0,
      )

    if (
      residualArchivedKeys.length > 0
    ) {
      const failedResidualDeletes
        = await deleteKvKeys(
          env,
          residualArchivedKeys,
        )

      if (
        failedResidualDeletes.length > 0
      ) {
        console.warn(
          'Some residual archived source keys could not be deleted:',
          failedResidualDeletes,
        )
      }
    }

    pendingTurnKeys
      = pendingTurnKeys.filter(
        keyName =>
          keyName.localeCompare(
            archiveMeta
              .lastArchivedTurnKey,
          ) > 0,
      )
  }

  /*
   * KV list/read propagation is eventually consistent.
   * Only turns older than the settle delay are eligible for
   * archiving, reducing the risk that a temporarily invisible
   * earlier turn is skipped by the progress marker.
   */
  if (
    pendingTurnKeys.length > 0
  ) {
    const pendingItems
      = await loadTurnRecordsByKeys(
        env,
        userId,
        pendingTurnKeys,
      )

    const stableCutoffTime
      = Date.now()
        - ARCHIVE_SETTLE_DELAY_MS

    pendingTurnKeys
      = pendingItems
        .filter(
          (item) => {
            if (!item.turn) {
              return false
            }

            const createdTime
              = Date.parse(
                item.turn.createdAt,
              )

            return (
              Number.isFinite(
                createdTime,
              )
              && createdTime
              <= stableCutoffTime
            )
          },
        )
        .map(
          item =>
            item.keyName,
        )
  }

  let archiveChanged
    = false

  while (
    pendingTurnKeys.length
    >= ARCHIVE_TURNS_PER_KEY
  ) {
    const sourceTurnKeys
      = pendingTurnKeys.slice(
        0,
        ARCHIVE_TURNS_PER_KEY,
      )

    const archiveKey
      = getHistoryArchiveKey(
        userId,
        sourceTurnKeys[0],
        sourceTurnKeys[
          sourceTurnKeys.length - 1
        ],
      )

    const loadedItems
      = await loadTurnRecordsByKeys(
        env,
        userId,
        sourceTurnKeys,
      )

    if (
      loadedItems.length
      !== ARCHIVE_TURNS_PER_KEY
      || loadedItems.some(
        item => !item.turn,
      )
    ) {
      console.warn(
        'Archive source turns incomplete:',
        userId,
        'expected:',
        ARCHIVE_TURNS_PER_KEY,
        'loaded:',
        loadedItems.filter(
          item => Boolean(item.turn),
        ).length,
      )

      return
    }

    const turns
      = loadedItems.map(
        item => item.turn,
      )

    let archive
      = await loadArchiveRecordByKey(
        env,
        userId,
        archiveKey,
      )

    if (!archive) {
      const archiveRecord
        = createArchiveRecord(
          userId,
          sourceTurnKeys,
          turns,
        )

      await env.MEMORY.put(
        archiveKey,
        JSON.stringify(
          archiveRecord,
        ),
      )

      archive
        = await loadArchiveWithRetry(
          env,
          userId,
          archiveKey,
        )
    }

    if (
      !archiveMatchesSourceTurns(
        archive,
        sourceTurnKeys,
        turns,
      )
    ) {
      console.warn(
        'Archive verification failed; source turns kept:',
        archiveKey,
      )

      return
    }

    archiveMeta = {
      version:
        1,

      type:
        'archive_meta',

      userId:
        String(userId),

      archivedTurns:
        archiveMeta.archivedTurns
        + ARCHIVE_TURNS_PER_KEY,

      lastArchivedTurnKey:
        sourceTurnKeys[
          sourceTurnKeys.length - 1
        ],

      lastArchiveKey:
        archiveKey,

      updatedAt:
        new Date().toISOString(),
    }

    await writeArchiveMeta(
      env,
      userId,
      archiveMeta,
    )

    const failedDeleteKeys
      = await deleteKvKeys(
        env,
        sourceTurnKeys,
      )

    if (
      failedDeleteKeys.length > 0
    ) {
      console.warn(
        'Archive succeeded but some source keys could not be deleted:',
        archiveKey,
        failedDeleteKeys,
      )
    }
    else {
      console.log(
        'Ten turns archived and source keys deleted:',
        archiveKey,
      )
    }

    archiveChanged
      = true

    pendingTurnKeys
      = pendingTurnKeys.slice(
        ARCHIVE_TURNS_PER_KEY,
      )
  }

  if (archiveChanged) {
    await rebuildRecentHistoryIndex(
      env,
      userId,
    )
  }
}

// ============================================================
// Unified timeline loading
// ============================================================

/*
 * Returns all archived and pending turns once, in chronological order.
 * If an archive exists while its source turn keys are still visible,
 * those pending keys are skipped to prevent duplicate history.
 */
async function loadUnifiedTurnTimeline(
  env,
  userId,
) {
  const [
    archiveKeys,
    pendingTurnKeys,
  ] = await Promise.all([
    listHistoryArchiveKeys(
      env,
      userId,
    ),

    listHistoryTurnKeys(
      env,
      userId,
    ),
  ])

  const archiveRecords
    = await loadArchiveRecords(
      env,
      userId,
      archiveKeys,
    )

  const archivedSourceKeys
    = new Set()

  const timelineItems = []

  for (
    const archive of
    archiveRecords
  ) {
    for (
      let index = 0;
      index
      < archive.turns.length;
      index += 1
    ) {
      const sourceKey
        = archive.sourceTurnKeys[
          index
        ]

      archivedSourceKeys.add(
        sourceKey,
      )

      timelineItems.push({
        sortKey:
          sourceKey,

        turn:
          archive.turns[index],
      })
    }
  }

  const uniquePendingKeys
    = pendingTurnKeys.filter(
      keyName =>
        !archivedSourceKeys.has(
          keyName,
        ),
    )

  const pendingItems
    = await loadTurnRecordsByKeys(
      env,
      userId,
      uniquePendingKeys,
    )

  for (
    const item of pendingItems
  ) {
    if (!item.turn) {
      continue
    }

    timelineItems.push({
      sortKey:
        item.keyName,

      turn:
        item.turn,
    })
  }

  timelineItems.sort(
    (a, b) =>
      a.sortKey.localeCompare(
        b.sortKey,
      ),
  )

  return timelineItems.map(
    item => item.turn,
  )
}

async function loadRecentTurnsFromIndexAndPending(
  env,
  userId,
) {
  const [
    recentIndex,
    pendingTurnKeys,
  ] = await Promise.all([
    readRecentHistoryIndex(
      env,
      userId,
    ),

    listHistoryTurnKeys(
      env,
      userId,
    ),
  ])

  const indexedTurns
    = recentIndex?.turns || []

  const pendingItems
    = await loadTurnRecordsByKeys(
      env,
      userId,
      pendingTurnKeys,
    )

  const mergedByInteractionId
    = new Map()

  for (
    const turn of indexedTurns
  ) {
    mergedByInteractionId.set(
      String(
        turn.interactionId,
      ),
      turn,
    )
  }

  for (
    const item of pendingItems
  ) {
    if (!item.turn) {
      continue
    }

    mergedByInteractionId.set(
      String(
        item.turn.interactionId,
      ),
      item.turn,
    )
  }

  return Array.from(
    mergedByInteractionId.values(),
  )
    .sort(
      compareTurnsChronologically,
    )
    .slice(
      -RECENT_HISTORY_INDEX_TURNS,
    )
}

async function rebuildRecentHistoryIndex(
  env,
  userId,
  timeline = null,
) {
  const fullTimeline
    = timeline
      || await loadUnifiedTurnTimeline(
        env,
        userId,
      )

  await writeRecentHistoryIndex(
    env,
    userId,
    {
      totalTurns:
        fullTimeline.length,

      turns:
        fullTimeline.slice(
          -RECENT_HISTORY_INDEX_TURNS,
        ),
    },
  )

  return fullTimeline
}

async function loadRecentHistory(
  env,
  userId,
) {
  if (!env.MEMORY) {
    return []
  }

  const recentIndex
    = await readRecentHistoryIndex(
      env,
      userId,
    )

  if (!recentIndex) {
    await rebuildRecentHistoryIndex(
      env,
      userId,
    )
  }

  const mergedRecentTurns
    = await loadRecentTurnsFromIndexAndPending(
      env,
      userId,
    )

  const recentTurns
    = mergedRecentTurns.slice(
      -HISTORY_CONTEXT_TURNS,
    )

  const recentEntries = []

  for (
    const turn of recentTurns
  ) {
    recentEntries.push(
      turn.user,
      turn.model,
    )
  }

  return recentEntries
}

// ============================================================
// Discord long-message handling
// ============================================================

function splitDiscordMessage(
  text,
  maximumLength = 1900,
) {
  const chunks = []

  let remaining
    = String(text ?? '').trim()

  if (!remaining) {
    return [
      '（輕撫手中的茶杯，抿了一口後沉默地掃了你一眼，似乎沒有得到足夠回答的資訊。）',
    ]
  }

  while (
    remaining.length
    > maximumLength
  ) {
    let splitAt
      = remaining.lastIndexOf(
        '\n',
        maximumLength,
      )

    if (
      splitAt
      < maximumLength * 0.5
    ) {
      splitAt
        = remaining.lastIndexOf(
          ' ',
          maximumLength,
        )
    }

    if (
      splitAt
      < maximumLength * 0.5
    ) {
      splitAt
        = maximumLength
    }

    const chunk
      = remaining
        .slice(0, splitAt)
        .trim()

    if (chunk) {
      chunks.push(chunk)
    }

    remaining
      = remaining
        .slice(splitAt)
        .trim()
  }

  if (remaining) {
    chunks.push(remaining)
  }

  return chunks
}

async function updateDiscordOriginalReply(
  applicationId,
  interactionToken,
  content,
) {
  const webhookBaseUrl
    = 'https://discord.com/api/v10/webhooks/'
      + `${applicationId}/${interactionToken}`

  const chunks
    = splitDiscordMessage(
      content,
      1900,
    )

  const firstResponse
    = await fetchWithTimeout(
      `${webhookBaseUrl}/messages/@original`,
      {
        method:
          'PATCH',

        headers: {
          'Content-Type':
            'application/json; charset=utf-8',
        },

        body:
          JSON.stringify({
            content:
              chunks[0],
          }),
      },
      DISCORD_REQUEST_TIMEOUT_MS,
    )

  if (!firstResponse.ok) {
    const errorText
      = await firstResponse.text()

    throw new Error(
      `Discord 原始回覆失敗：HTTP `
      + `${firstResponse.status} `
      + `${errorText}`,
    )
  }

  for (
    let index = 1;
    index < chunks.length;
    index += 1
  ) {
    const followupResponse
      = await fetchWithTimeout(
        webhookBaseUrl,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json; charset=utf-8',
          },

          body:
            JSON.stringify({
              content:
                chunks[index],
            }),
        },
        DISCORD_REQUEST_TIMEOUT_MS,
      )

    if (!followupResponse.ok) {
      const errorText
        = await followupResponse.text()

      throw new Error(
        `Discord 後續回覆失敗：HTTP `
        + `${followupResponse.status} `
        + `${errorText}`,
      )
    }
  }
}

// ============================================================
// Gemini response parsing
// ============================================================

function extractGeminiReply(
  data,
) {
  const parts
    = data.candidates?.[0]
      ?.content
      ?.parts

  if (!Array.isArray(parts)) {
    return ''
  }

  return parts
    .map(part =>
      typeof part.text
      === 'string'
        ? part.text
        : '',
    )
    .join('')
    .trim()
}

// ============================================================
// Normal Gemini request
// ============================================================

async function callGemini(
  env,
  history,
  currentUserParts,
  longTermMemory,
  userIdentityInstruction,
) {
  if (!env.GEMINI_API_KEY) {
    throw new Error(
      'Cloudflare 尚未設定 GEMINI_API_KEY。',
    )
  }

  const systemPrompt
    = env.SYSTEM_PROMPT
      || ''

  const systemSections = [
    systemPrompt,
    userIdentityInstruction,
  ]

  if (longTermMemory) {
    systemSections.push(
      `================================\n`
      + `【目前使用者的已確認長期記憶】\n`
      + `================================\n`
      + `${longTermMemory}\n\n`
      + `【長期記憶使用規則】\n`
      + `- 請自然延續上述記憶，不要每次逐條複述。\n`
      + `- 不要把它稱為系統提示、資料庫、設定檔或外部資料。\n`
      + `- 只有當目前話題相關時，才自然引用其中細節。\n`
      + `- 不可捏造長期記憶中沒有的新事件。\n`
      + `- 若新訊息與長期記憶明顯衝突，先向目前使用者確認。\n`
      + `- 此記憶只屬於目前 Discord User ID，不得套用給其他使用者。`,
    )
  }

  const effectiveSystemPrompt
    = systemSections
      .filter(Boolean)
      .join('\n\n')

  const model
    = env.GEMINI_MODEL
      || 'gemini-3-flash-preview'

  const geminiUrl
    = 'https://generativelanguage.googleapis.com/'
      + `v1beta/models/${model}:generateContent`

  const requestBody = {
    system_instruction: {
      parts: [
        {
          text:
            effectiveSystemPrompt,
        },
      ],
    },

    contents: [
      ...history,

      {
        role:
          'user',

        parts:
          currentUserParts,
      },
    ],

    generationConfig: {
      temperature:
        0.9,

      topP:
        0.95,

      maxOutputTokens:
        1800,

      thinkingConfig: {
        thinkingLevel:
          'low',
      },
    },
  }

  const response
    = await fetchWithTimeout(
      geminiUrl,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json; charset=utf-8',

          'x-goog-api-key':
            env.GEMINI_API_KEY,
        },

        body:
          JSON.stringify(
            requestBody,
          ),
      },
      GEMINI_REQUEST_TIMEOUT_MS,
    )

  const responseText
    = await response.text()

  let data

  try {
    data
      = JSON.parse(responseText)
  }
  catch {
    data = null
  }

  if (!response.ok) {
    const apiMessage
      = data?.error?.message
        || responseText
        || 'Unknown Gemini API error'

    throw new Error(
      `Gemini API HTTP `
      + `${response.status}：${
        apiMessage}`,
    )
  }

  const replyText
    = extractGeminiReply(data)

  const finishReason
    = data?.candidates?.[0]
      ?.finishReason || ''

  if (!replyText) {
    if (finishReason) {
      throw new Error(
        `Gemini 沒有傳回文字，`
        + `finishReason=${finishReason}。`,
      )
    }

    throw new Error(
      'Gemini 沒有傳回可用的文字回答。',
    )
  }

  return {
    replyText,
    finishReason,
  }
}

// ============================================================
// Automatic long-term-memory summary
// ============================================================

function turnRecordsToTranscript(
  turnRecords,
) {
  return turnRecords
    .map((record) => {
      const userText
        = Array.isArray(
          record?.user?.parts,
        )
          ? record.user.parts
              .map(part =>
                typeof part?.text
                === 'string'
                  ? part.text
                  : '',
              )
              .filter(Boolean)
              .join('\n')
          : ''

      const modelText
        = Array.isArray(
          record?.model?.parts,
        )
          ? record.model.parts
              .map(part =>
                typeof part?.text
                === 'string'
                  ? part.text
                  : '',
              )
              .filter(Boolean)
              .join('\n')
          : ''

      if (
        !userText
        && !modelText
      ) {
        return ''
      }

      return (
        `使用者：${userText}\n\n`
        + `助理：${modelText}`
      )
    })
    .filter(Boolean)
    .join('\n\n')
}

async function createLongTermMemorySummary(
  env,
  turnRecords,
  timestamp,
) {
  if (!env.GEMINI_API_KEY) {
    throw new Error(
      'Cloudflare 尚未設定 GEMINI_API_KEY。',
    )
  }

  const model
    = env.GEMINI_MODEL
      || 'gemini-3-flash-preview'

  const geminiUrl
    = 'https://generativelanguage.googleapis.com/'
      + `v1beta/models/${model}:generateContent`

  const transcript
    = turnRecordsToTranscript(
      turnRecords,
    )

  const requestBody = {
    system_instruction: {
      parts: [
        {
          text:
            `你是長期記憶整理器。\n\n`
            + `請從對話中只挑選未來仍有價值、值得長期保存的內容，例如：\n`
            + `- 重要事件\n`
            + `- 明確且穩定的偏好或禁忌\n`
            + `- 新約定\n`
            + `- 關係定位或觀點變化\n`
            + `- 值得延續的共同經歷\n`
            + `- 對未來對話有幫助的穩定資訊\n\n`
            + `不要記錄：\n`
            + `- 一般問答或技術測試\n`
            + `- 重複資訊\n`
            + `- 短暫瑣事\n`
            + `- 無法確定的推測\n`
            + `- 模型自行補完的內容\n`
            + `- 系統提示、API、KV 或內部程式細節\n\n`
            + `使用繁體中文，以精簡條列輸出，不要加標題。\n`
            + `如果完全沒有值得保存的內容，只輸出：\n`
            + `NO_IMPORTANT_MEMORY`,
        },
      ],
    },

    contents: [
      {
        role:
          'user',

        parts: [
          {
            text:
              `整理時間：${timestamp}\n\n`
              + `以下是最近 20 輪對話：\n\n${
                transcript}`,
          },
        ],
      },
    ],

    generationConfig: {
      temperature:
        0.2,

      topP:
        0.8,

      maxOutputTokens:
        500,

      thinkingConfig: {
        thinkingLevel:
          'low',
      },
    },
  }

  const response
    = await fetchWithTimeout(
      geminiUrl,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json; charset=utf-8',

          'x-goog-api-key':
            env.GEMINI_API_KEY,
        },

        body:
          JSON.stringify(
            requestBody,
          ),
      },
      GEMINI_REQUEST_TIMEOUT_MS,
    )

  const responseText
    = await response.text()

  let data

  try {
    data
      = JSON.parse(responseText)
  }
  catch {
    data = null
  }

  if (!response.ok) {
    const apiMessage
      = data?.error?.message
        || responseText
        || 'Unknown Gemini API error'

    throw new Error(
      `Gemini summary API HTTP `
      + `${response.status}：${
        apiMessage}`,
    )
  }

  const summary
    = extractGeminiReply(data)

  if (!summary) {
    throw new Error(
      'Gemini 沒有傳回可用的記憶摘要。',
    )
  }

  return summary.trim()
}

// ============================================================
// Long-term-memory compaction
// ============================================================

async function createCompactedLongTermMemory(
  env,
  currentMemory,
) {
  if (!env.GEMINI_API_KEY) {
    throw new Error(
      'Cloudflare 尚未設定 GEMINI_API_KEY。',
    )
  }

  const model
    = env.GEMINI_MODEL
      || 'gemini-3-flash-preview'

  const geminiUrl
    = 'https://generativelanguage.googleapis.com/'
      + `v1beta/models/${model}:generateContent`

  const requestBody = {
    system_instruction: {
      parts: [
        {
          text:
            `你是長期記憶壓縮器。\n\n`
            + `請將多段歷史摘要重新整理成一份一致、精簡、可長期使用的記憶。\n`
            + `必須保留仍然有效的重要事件、穩定偏好、禁忌、關係定位、約定與共同經歷。\n`
            + `刪除重複、過時、互相矛盾、純技術測試、短暫瑣事及沒有未來價值的內容。\n`
            + `不要新增原文沒有的事實。\n`
            + `若資訊有衝突，保留較新且較明確的版本；無法判定時以保守措辭呈現。\n`
            + `使用繁體中文，以簡潔條列輸出，不要加入處理說明。\n`
            + `輸出應控制在約 ${LONG_TERM_MEMORY_TARGET_CHARS} 字以內。`,
        },
      ],
    },

    contents: [
      {
        role:
          'user',

        parts: [
          {
            text:
              `請壓縮以下長期記憶：\n\n${
                currentMemory}`,
          },
        ],
      },
    ],

    generationConfig: {
      temperature:
        0.2,

      topP:
        0.8,

      maxOutputTokens:
        2500,

      thinkingConfig: {
        thinkingLevel:
          'low',
      },
    },
  }

  const response
    = await fetchWithTimeout(
      geminiUrl,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json; charset=utf-8',

          'x-goog-api-key':
            env.GEMINI_API_KEY,
        },

        body:
          JSON.stringify(
            requestBody,
          ),
      },
      GEMINI_REQUEST_TIMEOUT_MS,
    )

  const responseText
    = await response.text()

  let data

  try {
    data
      = JSON.parse(
        responseText,
      )
  }
  catch {
    data = null
  }

  if (!response.ok) {
    const apiMessage
      = data?.error?.message
        || responseText
        || 'Unknown Gemini API error'

    throw new Error(
      `Gemini memory compaction HTTP `
      + `${response.status}：${
        apiMessage}`,
    )
  }

  const compacted
    = extractGeminiReply(
      data,
    )

  if (!compacted) {
    throw new Error(
      'Gemini 沒有傳回可用的壓縮記憶。',
    )
  }

  return compacted.trim()
}

async function compactLongTermMemoryIfNeeded(
  env,
  userId,
) {
  const document
    = await readLongTermMemoryDocument(
      env,
      userId,
    )

  if (
    !document.content
    || document.content.length
    <= LONG_TERM_MEMORY_MAX_CHARS
  ) {
    return
  }

  /*
   * Keep one recoverable copy of the document before replacing
   * it with the compacted version.
   */
  await env.MEMORY.put(
    getLongTermCompactionBackupKey(
      userId,
    ),
    JSON.stringify(
      document,
    ),
  )

  const compactedContent
    = await createCompactedLongTermMemory(
      env,
      document.content,
    )

  document.content
    = compactedContent

  document.updated_at
    = getDate()

  document.last_compaction_at
    = getTimestamp()

  await writeLongTermMemoryDocument(
    env,
    userId,
    document,
  )

  console.log(
    'Long-term memory compacted:',
    userId,
    'characters:',
    compactedContent.length,
  )
}

// ============================================================
// Stored summary backups
// ============================================================
function parseStoredSummary(
  raw,
) {
  if (
    typeof raw
    !== 'string'
    || !raw.trim()
  ) {
    return null
  }

  try {
    const parsed
      = JSON.parse(raw)

    if (
      !parsed
      || typeof parsed
      !== 'object'
      || typeof parsed.summary
      !== 'string'
      || !Number.isInteger(
        Number(
          parsed.throughTurn,
        ),
      )
    ) {
      return null
    }

    return {
      throughTurn:
        Number(
          parsed.throughTurn,
        ),

      timestamp:
        typeof parsed.timestamp
        === 'string'
          ? parsed.timestamp
          : '',

      summary:
        parsed.summary.trim(),

      hasImportantMemory:
        Boolean(
          parsed.hasImportantMemory,
        ),
    }
  }
  catch {
    return null
  }
}

async function listStoredSummaryKeys(
  env,
  userId,
) {
  return listAllKvKeyNames(
    env,
    getMemorySummaryPrefix(
      userId,
    ),
  )
}

async function loadStoredSummaryByKey(
  env,
  keyName,
) {
  const raw
    = await env.MEMORY.get(
      keyName,
    )

  return parseStoredSummary(
    raw,
  )
}

async function reconcileStoredSummariesIntoLongTermMemory(
  env,
  userId,
) {
  const summaryKeys
    = await listStoredSummaryKeys(
      env,
      userId,
    )

  if (
    summaryKeys.length === 0
  ) {
    return
  }

  const storedSummaries
    = (
      await Promise.all(
        summaryKeys.map(
          keyName =>
            loadStoredSummaryByKey(
              env,
              keyName,
            ),
        ),
      )
    )
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.throughTurn
          - b.throughTurn,
      )

  const document
    = await readLongTermMemoryDocument(
      env,
      userId,
    )

  let changed
    = false

  let highestThroughTurn
    = Math.max(
      0,
      Number(
        document
          .last_summarized_turns,
      ) || 0,
    )

  let latestTimestamp
    = document
      .last_summary_at
      || ''

  const previouslyMergedThroughTurn
    = highestThroughTurn

  for (
    const stored of
    storedSummaries
  ) {
    highestThroughTurn
      = Math.max(
        highestThroughTurn,
        stored.throughTurn,
      )

    if (
      stored.timestamp
    ) {
      latestTimestamp
        = stored.timestamp
    }

    /*
     * Progress is the authoritative merge marker.
     * This remains valid even after compaction removes old
     * per-block headings from document.content.
     */
    if (
      stored.throughTurn
      <= previouslyMergedThroughTurn
    ) {
      continue
    }

    if (
      !stored
        .hasImportantMemory
        || !stored.summary
    ) {
      continue
    }

    const blockMarker
      = `【自動對話摘要｜`
        + `${stored.timestamp}`
        + `｜截至第 `
        + `${stored.throughTurn} 輪】`

    const summaryBlock
      = `${blockMarker}\n${
        stored.summary}`

    document.content
      = document.content
        ? (
            `${document.content.trim()}\n\n${
              summaryBlock}`
          )
        : summaryBlock

    changed
      = true
  }

  if (
    document
      .last_summarized_turns
      !== highestThroughTurn
  ) {
    document
      .last_summarized_turns
        = highestThroughTurn

    document
      .last_summarized_entries
        = highestThroughTurn * 2

    changed
      = true
  }

  if (
    latestTimestamp
    && document
      .last_summary_at
      !== latestTimestamp
  ) {
    document
      .last_summary_at
        = latestTimestamp

    changed
      = true
  }

  if (
    changed
  ) {
    document.updated_at
      = getDate()

    await writeLongTermMemoryDocument(
      env,
      userId,
      document,
    )
  }
}

// ============================================================
// Automatic 20-turn summary
// ============================================================

async function summarizeAndMergeLongTermMemory(
  env,
  userId,
) {
  /*
   * Only the system owner's conversations are summarized into long-term memory.
   */
  if (
    !env.MEMORY
    || userId
    !== OWNER_USER_ID
  ) {
    return
  }

  const document
    = await readLongTermMemoryDocument(
      env,
      userId,
    )

  let recentIndex
    = await readRecentHistoryIndex(
      env,
      userId,
    )

  if (!recentIndex) {
    const rebuiltTimeline
      = await rebuildRecentHistoryIndex(
        env,
        userId,
      )

    recentIndex = {
      version:
        1,

      type:
        'recent_history_index',

      userId:
        String(userId),

      totalTurns:
        rebuiltTimeline.length,

      updatedAt:
        new Date().toISOString(),

      turns:
        rebuiltTimeline.slice(
          -RECENT_HISTORY_INDEX_TURNS,
        ),
    }
  }

  const mergedRecentTurns
    = await loadRecentTurnsFromIndexAndPending(
      env,
      userId,
    )

  const indexedInteractionIds
    = new Set(
      (
        recentIndex.turns
        || []
      ).map(
        turn =>
          String(
            turn.interactionId,
          ),
      ),
    )

  const missingPendingCount
    = mergedRecentTurns.filter(
      turn =>
        !indexedInteractionIds.has(
          String(
            turn.interactionId,
          ),
        ),
    ).length

  const indexedTotalTurns
    = recentIndex.totalTurns
      + missingPendingCount

  let lastSummarizedTurns
    = Math.max(
      0,
      Number(
        document
          .last_summarized_turns,
      ) || 0,
    )

  /*
   * Most turns do not need a full archive scan. The small index
   * tells us whether a new 20-turn summary window exists.
   */
  if (
    indexedTotalTurns
    - lastSummarizedTurns
    < SUMMARY_TURNS_INTERVAL
  ) {
    await compactLongTermMemoryIfNeeded(
      env,
      userId,
    )

    return
  }

  const timeline
    = await loadUnifiedTurnTimeline(
      env,
      userId,
    )

  const totalTurns
    = timeline.length

  /*
   * Rebuild the index from authoritative storage whenever a
   * summary window is processed.
   */
  await rebuildRecentHistoryIndex(
    env,
    userId,
    timeline,
  )

  /*
   * 若曾手動刪除聊天紀錄，
   * 造成摘要進度比實際輪數大，
   * 就重新從第 0 輪判斷。
   */
  if (
    lastSummarizedTurns
    > totalTurns
  ) {
    lastSummarizedTurns
      = 0
  }

  while (
    totalTurns
    - lastSummarizedTurns
    >= SUMMARY_TURNS_INTERVAL
  ) {
    const rangeStart
      = lastSummarizedTurns

    const rangeEnd
      = rangeStart
        + SUMMARY_TURNS_INTERVAL

    const summaryKey
      = getMemorySummaryKey(
        userId,
        rangeEnd,
      )

    /*
     * 若已存在摘要備份，
     * 不重複呼叫 Gemini。
     */
    let storedSummary
      = parseStoredSummary(
        await env.MEMORY.get(
          summaryKey,
        ),
      )

    if (
      !storedSummary
    ) {
      const turnRecords
        = timeline.slice(
          rangeStart,
          rangeEnd,
        )

      if (
        turnRecords.length
        !== SUMMARY_TURNS_INTERVAL
      ) {
        console.warn(
          'Automatic summary range incomplete:',
          'start:',
          rangeStart,
          'end:',
          rangeEnd,
          'loaded:',
          turnRecords.length,
        )

        return
      }

      const timestamp
        = getTimestamp()

      const summary
        = await createLongTermMemorySummary(
          env,
          turnRecords,
          timestamp,
        )

      const noImportantMemory
        = summary
          .trim()
          .toUpperCase()
          .startsWith(
            'NO_IMPORTANT_MEMORY',
          )

      storedSummary = {
        throughTurn:
          rangeEnd,

        timestamp,

        summary:
          noImportantMemory
            ? ''
            : summary,

        hasImportantMemory:
          !noImportantMemory,
      }

      /*
       * 先保存獨立摘要 Key，
       * 再合併至 history:<userId>。
       */
      await env.MEMORY.put(
        summaryKey,
        JSON.stringify(
          storedSummary,
        ),
      )

      console.log(
        'Independent memory summary saved:',
        summaryKey,
      )
    }

    lastSummarizedTurns
      = rangeEnd
  }

  await reconcileStoredSummariesIntoLongTermMemory(
    env,
    userId,
  )

  await compactLongTermMemoryIfNeeded(
    env,
    userId,
  )
}

// ============================================================
// Discord security audit (read-only v1)
// ============================================================

const SECURITY_LOOKBACK_HOURS
  = 24

/*
 * All security reports are published here.
 * Discord channel: 安全紀錄頻道
 */
const SECURITY_REPORT_CHANNEL_ID
  = 'SECURITY_REPORT_CHANNEL_ID_HERE'

/*
 * Automatic alert scope:
 * - New Bot additions are always announced, including additions by the creator.
 * - Important changes made by the creator are skipped automatically.
 * - Important changes made by any other account are announced.
 * - Manual /security still shows the complete 24-hour audit report.
 * - No security KV is used. Alerted Audit Log IDs are recorded in
 *   the recent messages of the locked guard-room channel.
 */
const AUTOMATIC_SECURITY_LOOKBACK_MINUTES
  = 45

const SECURITY_HISTORY_MESSAGE_LIMIT
  = 100

const DISCORD_AUDIT_ACTION_BOT_ADD
  = 28

const AUTOMATIC_SECURITY_ACTIONS
  = new Set([
    12, // CHANNEL_DELETE
    20, // MEMBER_KICK
    22, // MEMBER_BAN_ADD
    25, // MEMBER_ROLE_UPDATE
    30, // ROLE_CREATE
    31, // ROLE_UPDATE
    32, // ROLE_DELETE
    50, // WEBHOOK_CREATE
    51, // WEBHOOK_UPDATE
    52, // WEBHOOK_DELETE
    28, // BOT_ADD
  ])

const DISCORD_AUDIT_ACTIONS
  = Object.freeze({
    10: { name: '建立頻道', severity: 'notice' },
    11: { name: '修改頻道', severity: 'notice' },
    12: { name: '刪除頻道', severity: 'high' },
    20: { name: '踢出成員', severity: 'high' },
    22: { name: '封鎖成員', severity: 'high' },
    23: { name: '解除封鎖', severity: 'notice' },
    24: { name: '更新成員資料', severity: 'notice' },
    25: { name: '更新成員身分組', severity: 'warning' },
    30: { name: '建立身分組', severity: 'warning' },
    31: { name: '修改身分組', severity: 'warning' },
    32: { name: '刪除身分組', severity: 'high' },
    50: { name: '建立 Webhook', severity: 'high' },
    51: { name: '修改 Webhook', severity: 'high' },
    52: { name: '刪除 Webhook', severity: 'warning' },
    28: { name: '新增 Bot', severity: 'warning' },
  })

function discordSnowflakeToTimestamp(
  snowflake,
) {
  try {
    const discordEpoch
      = 1420070400000n

    return Number(
      (
        BigInt(
          String(snowflake),
        )
        >> 22n
      )
      + discordEpoch,
    )
  }
  catch {
    return 0
  }
}

function maskDiscordId(
  id,
) {
  const value
    = String(id || '')

  if (
    value.length
    <= 8
  ) {
    return value
      || '未知'
  }

  return (
    `${value.slice(0, 4)
    }…${
      value.slice(-4)}`
  )
}

async function fetchDiscordAuditLog(
  env,
  guildId,
  limit = 100,
) {
  if (!env.DISCORD_TOKEN) {
    throw new Error(
      'Cloudflare 尚未設定 DISCORD_TOKEN。',
    )
  }

  if (!guildId) {
    throw new Error(
      '這個指令必須在 Discord 伺服器內使用。',
    )
  }

  const url
    = 'https://discord.com/api/v10/guilds/'
      + `${guildId}/audit-logs?limit=${limit}`

  const response
    = await fetchWithTimeout(
      url,
      {
        method:
          'GET',

        headers: {
          'Authorization':
            `Bot ${env.DISCORD_TOKEN}`,

          'User-Agent':
            'ExampleDiscordBot/1.0',
        },
      },
      DISCORD_REQUEST_TIMEOUT_MS,
    )

  const responseText
    = await response.text()

  let data

  try {
    data
      = JSON.parse(responseText)
  }
  catch {
    data = null
  }

  if (!response.ok) {
    const apiMessage
      = data?.message
        || responseText
        || 'Unknown Discord API error'

    throw new Error(
      `Discord Audit Log HTTP `
      + `${response.status}：${
        apiMessage}`,
    )
  }

  return {
    entries:
      Array.isArray(
        data?.audit_log_entries,
      )
        ? data.audit_log_entries
        : [],

    users:
      Array.isArray(data?.users)
        ? data.users
        : [],
  }
}

function analyzeDiscordAuditLog(
  auditData,
  lookbackHours =
    SECURITY_LOOKBACK_HOURS,
) {
  const cutoff
    = Date.now()
      - lookbackHours
      * 60
      * 60
      * 1000

  const userNameById
    = new Map()

  for (const user of auditData.users) {
    if (!user?.id) {
      continue
    }

    userNameById.set(
      String(user.id),
      user.global_name
      || user.username
      || maskDiscordId(user.id),
    )
  }

  const events = []

  for (const entry of auditData.entries) {
    const timestamp
      = discordSnowflakeToTimestamp(
        entry.id,
      )

    if (
      !timestamp
      || timestamp < cutoff
    ) {
      continue
    }

    const action
      = DISCORD_AUDIT_ACTIONS[
        entry.action_type
      ]

    if (!action) {
      continue
    }

    const executorId
      = String(entry.user_id || '')

    /*
     * Manual /security report rule:
     * Changes made by the creator remain visible as ordinary records,
     * but do not count as warnings or high-risk events.
     * Automatic alerts keep their own separate filtering rules.
     */
    const effectiveSeverity
      = executorId === OWNER_USER_ID
        ? 'notice'
        : action.severity

    events.push({
      id:
        String(entry.id),

      timestamp,

      actionName:
        action.name,

      severity:
        effectiveSeverity,

      executorId,

      executorName:
        userNameById.get(
          executorId,
        )
        || maskDiscordId(
          executorId,
        ),

      targetId:
        entry.target_id
          ? String(entry.target_id)
          : '',

      reason:
        typeof entry.reason
        === 'string'
          ? entry.reason.trim()
          : '',
    })
  }

  events.sort(
    (a, b) =>
      b.timestamp
      - a.timestamp,
  )

  const highCount
    = events.filter(
      event =>
        event.severity
        === 'high',
    ).length

  const warningCount
    = events.filter(
      event =>
        event.severity
        === 'warning',
    ).length

  const noticeCount
    = events.filter(
      event =>
        event.severity
        === 'notice',
    ).length

  let risk
    = 'normal'

  if (highCount >= 3) {
    risk = 'critical'
  }
  else if (highCount >= 1) {
    risk = 'warning'
  }
  else if (warningCount >= 1) {
    risk = 'notice'
  }

  return {
    lookbackHours,
    events,
    highCount,
    warningCount,
    noticeCount,
    risk,
  }
}

function formatSecurityEventTime(
  timestamp,
) {
  return new Intl.DateTimeFormat(
    'zh-Hant',
    {
      month:
        '2-digit',

      day:
        '2-digit',

      hour:
        '2-digit',

      minute:
        '2-digit',

      hour12:
        false,
    },
  ).format(
    new Date(timestamp),
  )
}

function renderDiscordSecurityReport(
  report,
) {
  const lines = []

  if (report.risk === 'critical') {
    lines.push(
      '先別亂碰設定。這裡最近有多筆高風險管理變動，我正在盯著。',
    )
  }
  else if (report.risk === 'warning') {
    lines.push(
      '嘖，最近確實有值得確認的管理動作。還不能直接說是被入侵，但別當作沒看見。',
    )
  }
  else if (report.risk === 'notice') {
    lines.push(
      '我巡過了。有一些權限或伺服器設定變動，不算失控，但我把它們列出來。',
    )
  }
  else {
    lines.push(
      '巡過了，這塊地方目前很安靜。沒有看到值得判定為入侵跡象的管理變動。',
    )
  }

  lines.push(
    '',
    `檢查範圍：最近 ${report.lookbackHours} 小時`,
    `高風險：${report.highCount} 筆`,
    `需注意：${report.warningCount} 筆`,
    `一般紀錄：${report.noticeCount} 筆`,
  )

  if (report.events.length === 0) {
    lines.push(
      '',
      '沒有找到頻道刪除、成員封鎖、身分組變更、Webhook 或新 Bot 等重要紀錄。',
    )

    return lines.join('\n')
  }

  lines.push(
    '',
    '最近事件：',
  )

  for (
    const event of
    report.events.slice(0, 10)
  ) {
    const severityLabel
      = event.severity === 'high'
        ? '高'
        : event.severity === 'warning'
          ? '注意'
          : '紀錄'

    const targetText
      = event.targetId
        ? `，目標 ${maskDiscordId(event.targetId)}`
        : ''

    const reasonText
      = event.reason
        ? `，原因：${event.reason.slice(0, 100)}`
        : ''

    lines.push(
      `- [${severityLabel}] `
      + `${formatSecurityEventTime(event.timestamp)} `
      + `${event.actionName}；`
      + `執行者：${event.executorName}${
        targetText
      }${reasonText}`,
    )
  }

  lines.push(
    '',
    '這些是 Discord 稽核紀錄，不代表主機或帳號一定已被攻破。',
  )

  return lines.join('\n')
}

async function sendDiscordChannelMessage(
  env,
  channelId,
  content,
) {
  if (!env.DISCORD_TOKEN) {
    throw new Error(
      'Cloudflare 尚未設定 DISCORD_TOKEN。',
    )
  }

  const chunks
    = splitDiscordMessage(
      content,
      1900,
    )

  for (const chunk of chunks) {
    const response
      = await fetchWithTimeout(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method:
            'POST',

          headers: {
            'Authorization':
              `Bot ${env.DISCORD_TOKEN}`,

            'Content-Type':
              'application/json; charset=utf-8',

            'User-Agent':
              'ExampleDiscordBot/1.0',
          },

          body:
            JSON.stringify({
              content:
                chunk,

              allowed_mentions: {
                parse: [],
              },
            }),
        },
        DISCORD_REQUEST_TIMEOUT_MS,
      )

    if (!response.ok) {
      const errorText
        = await response.text()

      throw new Error(
        `Discord 頻道訊息發送失敗：HTTP `
        + `${response.status} ${errorText}`,
      )
    }
  }
}

async function fetchDiscordChannelMessages(
  env,
  channelId,
  limit = SECURITY_HISTORY_MESSAGE_LIMIT,
) {
  if (!env.DISCORD_TOKEN) {
    throw new Error(
      'Cloudflare 尚未設定 DISCORD_TOKEN。',
    )
  }

  const safeLimit
    = Math.max(
      1,
      Math.min(
        100,
        Number(limit)
        || SECURITY_HISTORY_MESSAGE_LIMIT,
      ),
    )

  const response
    = await fetchWithTimeout(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=${safeLimit}`,
      {
        method:
          'GET',

        headers: {
          'Authorization':
            `Bot ${env.DISCORD_TOKEN}`,

          'User-Agent':
            'ExampleDiscordBot/1.0',
        },
      },
      DISCORD_REQUEST_TIMEOUT_MS,
    )

  const responseText
    = await response.text()

  let data

  try {
    data
      = JSON.parse(responseText)
  }
  catch {
    data = null
  }

  if (!response.ok) {
    const apiMessage
      = data?.message
        || responseText
        || 'Unknown Discord API error'

    throw new Error(
      `Discord 頻道歷史讀取失敗：HTTP `
      + `${response.status} ${apiMessage}`,
    )
  }

  return Array.isArray(data)
    ? data
    : []
}

function extractReportedAuditLogIds(
  messages,
) {
  const reportedIds
    = new Set()

  for (const message of messages) {
    const content
      = typeof message?.content
        === 'string'
        ? message.content
        : ''

    const markerMatches
      = content.matchAll(
        /事件紀錄：([0-9,，\s]+)/g,
      )

    for (const markerMatch of markerMatches) {
      const ids
        = String(markerMatch[1] || '')
          .split(/[，,\s]+/)
          .map(value =>
            value.trim(),
          )
          .filter(value =>
            /^\d{17,20}$/.test(value),
          )

      for (const id of ids) {
        reportedIds.add(id)
      }
    }
  }

  return reportedIds
}

function getAuditUserNameMap(
  auditData,
) {
  const map = new Map()

  for (const user of auditData.users) {
    if (!user?.id)
      continue

    map.set(
      String(user.id),
      user.global_name
      || user.username
      || maskDiscordId(user.id),
    )
  }

  return map
}

function shouldAutomaticallyAlertAuditEntry(
  entry,
) {
  const actionType
    = Number(entry.action_type)

  if (!AUTOMATIC_SECURITY_ACTIONS.has(actionType)) {
    return false
  }

  /* New Bot additions are always reported. */
  if (actionType === DISCORD_AUDIT_ACTION_BOT_ADD) {
    return true
  }

  /* Creator changes are intentionally ignored automatically. */
  return String(entry.user_id || '') !== OWNER_USER_ID
}

function buildAutomaticSecurityAlertMessage(
  entries,
  auditData,
) {
  const userNameById
    = getAuditUserNameMap(auditData)

  const lines = [
    entries.length === 1
      ? '⚠️ 系統擁有者，我看到一項新的管理變動。'
      : `⚠️ 系統擁有者，我看到 ${entries.length} 項新的管理變動。`,
    '',
  ]

  for (const entry of entries) {
    const actionType
      = Number(entry.action_type)

    const action
      = DISCORD_AUDIT_ACTIONS[actionType]

    const executorId
      = String(entry.user_id || '')

    const executorName
      = userNameById.get(executorId)
        || maskDiscordId(executorId)

    const targetId
      = String(entry.target_id || '')

    const timestamp
      = discordSnowflakeToTimestamp(entry.id)
        || Date.now()

    const targetText
      = actionType === DISCORD_AUDIT_ACTION_BOT_ADD && targetId
        ? `<@${targetId}>`
        : maskDiscordId(targetId)

    lines.push(
      `- ${formatSecurityEventTime(timestamp)}｜`
      + `${action?.name || `動作 ${actionType}`}｜`
      + `執行者：${executorName}${
        targetId ? `｜目標：${targetText}` : ''}`,
    )
  }

  lines.push(
    '',
    `事件紀錄：${entries
      .map(entry => String(entry.id))
      .join(',')}`,
    '',
    '你自己的 Webhook、頻道與身分組變更不會觸發自動通知；這些事件是由其他帳號執行，或屬於新 Bot 加入。我只做記錄與提醒，沒有自行回復或修改任何設定。',
  )

  return lines.join('\n')
}

async function runAutomaticSecurityAuditCheck(env) {
  const guildId
    = String(
      env.SECURITY_GUILD_ID
      || '',
    ).trim()

  if (!guildId) {
    throw new Error(
      'Cloudflare 尚未設定 SECURITY_GUILD_ID。',
    )
  }

  /*
   * Read the guard-room history first. If Discord history cannot
   * be read, stop without sending anything to avoid duplicates.
   */
  const guardRoomMessages
    = await fetchDiscordChannelMessages(
      env,
      SECURITY_REPORT_CHANNEL_ID,
      SECURITY_HISTORY_MESSAGE_LIMIT,
    )

  const reportedAuditLogIds
    = extractReportedAuditLogIds(
      guardRoomMessages,
    )

  const auditData
    = await fetchDiscordAuditLog(
      env,
      guildId,
      100,
    )

  const cutoff
    = Date.now()
      - AUTOMATIC_SECURITY_LOOKBACK_MINUTES
      * 60
      * 1000

  const alertEntries
    = auditData.entries
      .filter((entry) => {
        if (!entry?.id) {
          return false
        }

        if (
          !AUTOMATIC_SECURITY_ACTIONS.has(
            Number(entry.action_type),
          )
        ) {
          return false
        }

        const timestamp
          = discordSnowflakeToTimestamp(
            entry.id,
          )

        if (
          !timestamp
          || timestamp < cutoff
        ) {
          return false
        }

        if (
          reportedAuditLogIds.has(
            String(entry.id),
          )
        ) {
          return false
        }

        return shouldAutomaticallyAlertAuditEntry(
          entry,
        )
      })
      .sort((a, b) =>
        String(a.id).localeCompare(
          String(b.id),
        ),
      )

  if (alertEntries.length === 0) {
    return
  }

  await sendDiscordChannelMessage(
    env,
    SECURITY_REPORT_CHANNEL_ID,
    buildAutomaticSecurityAlertMessage(
      alertEntries,
      auditData,
    ),
  )
}

async function handleSecurityCommand(
  interaction,
  env,
) {
  const applicationId
    = interaction.application_id

  const interactionToken
    = interaction.token

  try {
    const userId
      = getDiscordUserId(
        interaction,
      )

    if (!userId) {
      throw new Error(
        '無法取得 Discord 使用者 ID。',
      )
    }

    if (
      userId
      !== OWNER_USER_ID
    ) {
      await updateDiscordOriginalReply(
        applicationId,
        interactionToken,
        '這項巡查目前只開放給系統擁有者。',
      )

      return
    }

    if (!interaction.guild_id) {
      throw new Error(
        '/security 必須在伺服器頻道內使用，不能在私訊中執行。',
      )
    }

    const auditData
      = await fetchDiscordAuditLog(
        env,
        interaction.guild_id,
        100,
      )

    const report
      = analyzeDiscordAuditLog(
        auditData,
        SECURITY_LOOKBACK_HOURS,
      )

    const reportText
      = renderDiscordSecurityReport(
        report,
      )

    await updateDiscordOriginalReply(
      applicationId,
      interactionToken,
      reportText,
    )
  }
  catch (error) {
    console.error(
      'Security command failed:',
      error,
    )

    const errorMessage
      = error instanceof Error
        ? error.message
        : String(error)

    try {
      await updateDiscordOriginalReply(
        applicationId,
        interactionToken,
        '……巡查中斷了。我現在無法確認這裡是否安全，'
        + `原因：${errorMessage}`,
      )
    }
    catch (discordError) {
      console.error(
        'Unable to send security error reply:',
        discordError,
      )
    }
  }
}

// ============================================================
// /chat handler
// ============================================================
async function handleChatCommand(
  interaction,
  env,
) {
  const applicationId
    = interaction.application_id

  const interactionToken
    = interaction.token

  let interactionStateKey
    = ''

  let interactionMarkedCompleted
    = false

  let cachedInteractionState
    = null

  try {
    const userId
      = getDiscordUserId(
        interaction,
      )

    if (!userId) {
      throw new Error(
        '無法取得 Discord 使用者 ID。',
      )
    }

    const interactionId
      = interaction.id

    if (!interactionId) {
      throw new Error(
        '無法取得 Discord Interaction ID。',
      )
    }

    /*
     * Basic duplicate-interaction guard.
     *
     * Cloudflare KV is eventually consistent, so this is not
     * a perfect distributed lock. It still prevents most
     * accidental Discord retries from calling Gemini twice.
     */
    interactionStateKey
      = getInteractionStateKey(
        interactionId,
      )

    if (env.MEMORY) {
      cachedInteractionState
        = parseInteractionState(
          await env.MEMORY.get(
            interactionStateKey,
          ),
        )

      if (
        cachedInteractionState?.state
        === 'processing'
      ) {
        console.warn(
          'Duplicate interaction still processing:',
          interactionId,
        )

        return
      }

      if (
        cachedInteractionState?.state
        === 'completed'
      ) {
        console.warn(
          'Completed interaction ignored:',
          interactionId,
        )

        return
      }

      if (
        cachedInteractionState?.state
        !== 'generated'
      ) {
        await writeInteractionState(
          env,
          interactionStateKey,
          {
            state:
              'processing',

            generatedAt:
              getTimestamp(),
          },
          INTERACTION_PROCESSING_TTL_SECONDS,
        )
      }
    }

    const userIdentityInstruction = ''

    const messageOption
      = getCommandOption(
        interaction,
        'message',
      )

    const userMessage
      = typeof messageOption?.value
        === 'string'
        ? messageOption
            .value
            .trim()
        : ''

    const longTermMemory
      = await loadLongTermMemory(
        env,
        userId,
      )

    const history
      = await loadRecentHistory(
        env,
        userId,
      )

    const currentUserParts = []

    currentUserParts.push({
      text:
        userMessage
        || buildDefaultMediaPrompt(
          media?.kind,
        ),
    })

    if (media) {
      const base64Media
        = await downloadAttachmentAsBase64(
          media.attachment,
        )

      currentUserParts.push({
        inline_data: {
          mime_type:
            media.attachment
              .content_type,

          data:
            base64Media,
        },
      })
    }

    /*
     * 呼叫 Gemini。
     *
     * Gemini 成功產生回答後，
     * 才會保存這一輪完整聊天。
     */
    const geminiStartedAt
      = Date.now()

    console.log(
      'Gemini request started:',
      userId,
      interactionId,
    )

    const geminiResult
      = (
        cachedInteractionState?.state
        === 'generated'
        || cachedInteractionState?.state
        === 'completed'
      )
      && cachedInteractionState.replyText
        ? {
            replyText:
          cachedInteractionState.replyText,

            finishReason:
          cachedInteractionState.finishReason,
          }
        : await callGemini(
            env,
            history,
            currentUserParts,
            longTermMemory,
            userIdentityInstruction,
          )

    console.log(
      'Gemini request completed:',
      userId,
      interactionId,
      'durationMs:',
      Date.now() - geminiStartedAt,
      'usedCachedReply:',
      Boolean(
        cachedInteractionState?.replyText,
      ),
    )

    const replyText
      = geminiResult.replyText

    /*
 * Cache the generated reply before any later KV maintenance or
 * Discord webhook step. A retry can reuse it without calling
 * Gemini again.
 */
    if (
      env.MEMORY
      && interactionStateKey
      && !cachedInteractionState?.replyText
    ) {
      await writeInteractionState(
        env,
        interactionStateKey,
        {
          state:
        'generated',

          replyText:
        geminiResult.replyText,

          finishReason:
        geminiResult.finishReason,

          generatedAt:
        getTimestamp(),
        },
        INTERACTION_COMPLETED_TTL_SECONDS,
      )
    }

    const reachedOutputLimit
      = geminiResult.finishReason
        === 'MAX_TOKENS'

    /*
     * KV 只保存媒體種類與檔名提示，
     * 不保存附件 Base64。
     */
    const savedUserText
      = media
        ? (
            `${userMessage || buildDefaultMediaPrompt(media.kind)}\n`
            + `[使用者上傳${getMediaKindName(media.kind)}：`
            + `${media.attachment.filename || '未命名附件'}]`
          )
        : userMessage

    const savedModelText
      = reachedOutputLimit
        ? (
            `${replyText}\n\n`
            + `[此回答因輸出上限而停止]`
          )
        : replyText

    const userEntry = {
      role:
        'user',

      parts: [
        {
          text:
            savedUserText,
        },
      ],
    }

    const modelEntry = {
      role:
        'model',

      parts: [
        {
          text:
            savedModelText,
        },
      ],
    }

    /*
     * 每輪先寫入自己的唯一 Key：
     * history_turn_<userId>_<interactionId>
     */
    await saveIndependentChatTurn(
      env,
      userId,
      interactionId,
      userEntry,
      modelEntry,
    )

    const outputLimitNotice
      = reachedOutputLimit
        ? (
            '\n\n［回答已達輸出上限；'
            + '請輸入「（繼續以上，把回覆打完）」接續回答。］'
          )
        : ''

    const visibleReply
      = `${replyText}${
        outputLimitNotice}`

    /*
     * 先把回答顯示在 Discord。
     *
     * 後面的歸檔或摘要即使失敗，
     * 也不影響已完成的正常回覆。
     */
    await updateDiscordOriginalReply(
      applicationId,
      interactionToken,
      visibleReply,
    )

    /*
     * Once the user-visible reply succeeds, mark the interaction
     * completed before archive/summary maintenance begins.
     *
     * Archive or summary failure must not cause Gemini to run
     * again for the same Discord interaction.
     */
    if (
      env.MEMORY
      && interactionStateKey
    ) {
      await writeInteractionState(
        env,
        interactionStateKey,
        {
          state:
            'completed',

          replyText,

          finishReason:
            geminiResult.finishReason,

          generatedAt:
            cachedInteractionState
              ?.generatedAt
              || getTimestamp(),
        },
        INTERACTION_COMPLETED_TTL_SECONDS,
      )

      interactionMarkedCompleted
        = true
    }

    /*
     * 每累積 10 個未歸檔 turn，
     * 建立一個不可變 archive。
     *
     * archive 讀回並驗證成功後，
     * 才刪除來源 10 個 turn。
     */
    try {
      await archivePendingTurns(
        env,
        userId,
      )
    }
    catch (archiveError) {
      console.error(
        'Chat archive error:',
        archiveError,
      )
    }

    try {
      await summarizeAndMergeLongTermMemory(
        env,
        userId,
      )
    }
    catch (summaryError) {
      console.error(
        'Automatic memory summary error:',
        summaryError,
      )
    }

    console.log(
      'Chat command completed:',
      userId,
      'interactionId:',
      interactionId,
    )
  }
  catch (error) {
    console.error(
      'Chat command processing error:',
      error,
    )

    /*
     * A request that failed before producing a visible reply
     * may be retried. Remove the temporary processing marker.
     */
    if (
      env.MEMORY
      && interactionStateKey
      && !interactionMarkedCompleted
    ) {
      try {
        const currentState
          = parseInteractionState(
            await env.MEMORY.get(
              interactionStateKey,
            ),
          )

        /*
         * Keep generated replies so a retry can resend them.
         * Only clear a request that failed before generation.
         */
        if (
          !currentState
          || currentState.state
          === 'processing'
        ) {
          await env.MEMORY.delete(
            interactionStateKey,
          )
        }
      }
      catch (
        interactionStateError
      ) {
        console.error(
          'Unable to clear interaction state:',
          interactionStateError,
        )
      }
    }

    const errorMessage
      = error instanceof Error
        ? error.message
        : String(error)

    try {
      await updateDiscordOriginalReply(
        applicationId,
        interactionToken,
        `處理失敗：${errorMessage}`,
      )
    }
    catch (discordError) {
      console.error(
        'Unable to send Discord error reply:',
        discordError,
      )
    }
  }
}

// ============================================================
// Main Worker
// ============================================================

export default {
  async fetch(
    request,
    env,
    ctx,
  ) {
    /*
     * 用瀏覽器直接開 Worker 網址時，
     * 顯示程式正在運作。
     */
    if (
      request.method
      !== 'POST'
    ) {
      return new Response(
        'CloudAssistant Discord Worker is running.',
        {
          status:
            200,

          headers: {
            'Content-Type':
              'text/plain; charset=utf-8',
          },
        },
      )
    }

    const bodyText
      = await request.text()

    /*
     * 驗證 Discord Ed25519 簽章。
     */
    const isValid
      = await verifySignature(
        request,
        bodyText,
        env.DISCORD_PUBLIC_KEY,
      )

    if (!isValid) {
      return new Response(
        'Invalid request signature',
        {
          status:
            401,
        },
      )
    }

    let interaction

    try {
      interaction
        = JSON.parse(
          bodyText,
        )
    }
    catch {
      return new Response(
        'Invalid JSON',
        {
          status:
            400,
        },
      )
    }

    /*
     * Discord Endpoint PING。
     */
    if (
      interaction.type
      === 1
    ) {
      return jsonResponse({
        type:
          1,
      })
    }

    /*
     * Discord Slash/Application Command。
     */
    if (
      interaction.type
      === 2
    ) {
      const commandName
        = interaction.data?.name

      if (
        commandName
        === 'chat'
      ) {
        /*
         * 先立即回覆 Discord deferred response，
         * 再於 waitUntil 中處理 Gemini、KV、
         * 歸檔與摘要。
         */
        ctx.waitUntil(
          handleChatCommand(
            interaction,
            env,
          ),
        )

        return jsonResponse({
          type:
            5,
        })
      }

      if (
        commandName
        === 'security'
      ) {
        const securityUserId
          = getDiscordUserId(
            interaction,
          )

        if (
          securityUserId
          !== OWNER_USER_ID
        ) {
          return jsonResponse({
            type:
              4,

            data: {
              content:
                '這項巡查目前只開放給系統擁有者。',

              flags:
                64,
            },
          })
        }

        if (
          interaction.channel_id
          !== SECURITY_REPORT_CHANNEL_ID
        ) {
          return jsonResponse({
            type:
              4,

            data: {
              content:
                `請到 <#${SECURITY_REPORT_CHANNEL_ID}> 使用 /security。`,

              flags:
                64,
            },
          })
        }

        ctx.waitUntil(
          handleSecurityCommand(
            interaction,
            env,
          ),
        )

        /*
         * Public deferred reply. The completed report replaces
         * this interaction response directly in 安全紀錄頻道.
         */
        return jsonResponse({
          type:
            5,
        })
      }

      return jsonResponse({
        type:
          4,

        data: {
          content:
            '請輸入有效指令。',

          flags:
            64,
        },
      })
    }

    return new Response(
      'OK',
      {
        status:
          200,
      },
    )
  },

  async scheduled(
    event,
    env,
    ctx,
  ) {
    ctx.waitUntil(
      runAutomaticSecurityAuditCheck(env)
        .catch((error) => {
          console.error(
            'Automatic security audit check failed:',
            error,
          )
        }),
    )
  },
}
