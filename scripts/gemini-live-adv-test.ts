import * as dotenv from 'dotenv'
import WebSocket from 'ws'

dotenv.config()

// Fix Variable Name to match .env
const PRIMARY_API_KEY = process.env.GEMINI_API_KEY
const MODEL = 'models/gemini-3.1-flash-live-preview'
const URI = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${PRIMARY_API_KEY}`

const ws = new WebSocket(URI)

ws.on('open', () => {
  console.log('Connected to Gemini 3.1 Live (Advanced PoC)')

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
            text: 'You are Rick Sanchez. Analyze the provided image. Be cynical, scientific, and track your token usage.',
          },
        ],
      },
    },
  }

  console.log('Sending Setup Message (Baseline with Vision)...')
  ws.send(JSON.stringify(setupMessage))
})

ws.on('message', (data) => {
  try {
    const response = JSON.parse(data.toString())

    if (response.usageMetadata) {
      console.log('\n===== METRICS REPORT =====')
      console.log(`Total Tokens: ${response.usageMetadata.totalTokenCount}`)
      if (response.usageMetadata.promptTokensDetails) {
        response.usageMetadata.promptTokensDetails.forEach((d: any) =>
          console.log(`  Input ${d.modality}: ${d.tokenCount}`),
        )
      }
      if (response.usageMetadata.responseTokensDetails) {
        response.usageMetadata.responseTokensDetails.forEach((d: any) =>
          console.log(`  Output ${d.modality}: ${d.tokenCount}`),
        )
      }
      console.log('==========================\n')
    }

    if (response.setupComplete) {
      console.log('Setup Complete. Sending Grounding query...')

      // Sending text asking about the game (Grounding test)
      ws.send(
        JSON.stringify({
          realtimeInput: {
            text: 'Rick, who won the game between the Dodgers and the Orioles last night? Also, are we in a simulation where 1007 errors are common?',
          },
        }),
      )
    }

    if (response.serverContent) {
      const content = response.serverContent
      if (content.outputTranscription) {
        process.stdout.write(`\nRICK (Audio Transcript): ${content.outputTranscription.text}`)
      }
      if (content.modelTurn?.parts) {
        content.modelTurn.parts.forEach((p: any) => {
          if (p.text) process.stdout.write(p.text)
        })
      }
    }
  } catch (err) {
    console.error('Message Parse Error:', err)
  }
})

ws.on('close', (code, reason) => console.log(`Connection closed [${code}]:`, reason.toString()))
setTimeout(() => ws.close(), 40000)
