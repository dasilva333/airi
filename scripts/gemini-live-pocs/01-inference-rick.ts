import * as dotenv from 'dotenv'
import WebSocket from 'ws'

dotenv.config()

const PRIMARY_API_KEY = process.env.GEMINI_API_KEY

if (!PRIMARY_API_KEY) {
  console.error('Please set your GEMINI_API_KEY environment variable.')
  process.exit(1)
}

const MODEL = 'models/gemini-3.1-flash-live-preview'
const API_VERSION = 'v1alpha'

async function main() {
  console.log('--- Phase 2: Raw Bidi Connection (API Key + camelCase) ---')

  // Using the correct URI format discovered in SDK/Examples
  const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${API_VERSION}.GenerativeService.BidiGenerateContent?key=${PRIMARY_API_KEY}`
  console.debug('Connecting to endpoint...')

  const ws = new WebSocket(endpoint)

  ws.on('open', () => {
    console.debug('WebSocket connected!')

    // Following the schema found in geminilive.js (from ephemeral-tokens example)
    const setupMessage = {
      setup: {
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck',
              },
            },
          },
        },
        model: MODEL,
        systemInstruction: {
          parts: [
            {
              text: 'You are Rick Sanchez from Rick and Morty. You are cynical, brilliant, and speak to the user as if they are Morty or a slow research assistant. Use science-heavy jargon and occasional belches in text form [burp].',
            },
          ],
        },
      },
    }

    console.debug('Sending setup message (camelCase)...')
    ws.send(JSON.stringify(setupMessage))
  })

  ws.on('message', (data) => {
    try {
      const response = JSON.parse(data.toString())
      // console.debug('Received RAW:', JSON.stringify(response, null, 2));

      if (response.setupComplete) {
        console.debug('Setup handshake complete! Rick is listening.')
        const clientMessage = {
          realtimeInput: {
            text: 'Rick, i just saw a massive floating head in the sky. It said DISQUALIFIED. What is it?',
          },
        }
        ws.send(JSON.stringify(clientMessage))
      }

      if (response.serverContent) {
        const content = response.serverContent
        if (content.outputTranscription) {
          process.stdout.write(`\nRICK (transcription): ${content.outputTranscription.text}`)
        }
        if (content.modelTurn?.parts) {
          content.modelTurn.parts.forEach((p: any) => {
            if (p.text) process.stdout.write(p.text)
          })
        }
        if (content.turnComplete) {
          console.log('\n--- Rick is done talking ---')

          // Requesting metadata by sending an empty input or just waiting for the next turn?
          // Actually usageMetadata should be in the message already if provided.
        }
      }

      if (response.usageMetadata) {
        console.log('\n--- Usage Metadata ---')
        console.log(`Total Tokens: ${response.usageMetadata.totalTokenCount}`)
        if (response.usageMetadata.promptTokensDetails) {
          console.log('Prompt Tokens:', response.usageMetadata.promptTokensDetails)
        }
        if (response.usageMetadata.responseTokensDetails) {
          console.log('Response Tokens:', response.usageMetadata.responseTokensDetails)
        }
        console.log('----------------------')
      }
    } catch (err) {
      console.error('Message Parse Error:', err)
    }
  })

  ws.on('error', (err) => {
    console.error('WebSocket Error:', err)
  })

  ws.on('close', (code, reason) => {
    console.debug(`WebSocket closed [${code}]:`, reason.toString())
  })
}

main()
