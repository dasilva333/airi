import * as dotenv from 'dotenv'
import WebSocket from 'ws'

dotenv.config()

// USE PROVIDED API KEY (Second one)
const PRIMARY_API_KEY = process.env.GEMINI_API_KEY || ''
const MODEL = 'models/gemini-3.1-flash-live-preview'
const API_VERSION = 'v1alpha'

async function main() {
  console.log('--- Grounding POC: Isolated Clean Room ---')

  const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${API_VERSION}.GenerativeService.BidiGenerateContent?key=${PRIMARY_API_KEY}`
  console.debug('Connecting to endpoint...')

  const ws = new WebSocket(endpoint)

  ws.on('open', () => {
    console.debug('WebSocket connected!')

    const setupMessage = {
      setup: {
        generationConfig: {
          responseModalities: ['AUDIO'],
        },
        model: MODEL,
        systemInstruction: {
          parts: [{ text: 'You are a helpful assistant. Use Google Search for current events.' }],
        },
        tools: [{ google_search: {} }],
      },
    }

    console.debug('Sending setup message (AUDIO + google_search)...')
    ws.send(JSON.stringify(setupMessage))
  })

  ws.on('message', (data) => {
    try {
      const response = JSON.parse(data.toString())

      // LOG EVERYTHING for deep inspection
      if (!response.serverContent) {
        console.log('\n[RAW RESPONSE]:', JSON.stringify(response, null, 2))
      }

      if (response.setupComplete) {
        console.debug('--- Setup complete! ---')
        const clientMessage = {
          realtimeInput: {
            text: 'Who won the game between the Dodgers and the Orioles last night?',
          },
        }
        console.log('Sending query: "Who won the Dodgers/Orioles game last night?"')
        ws.send(JSON.stringify(clientMessage))
      }

      if (response.serverContent) {
        const content = response.serverContent

        if (content.modelTurn?.parts) {
          content.modelTurn.parts.forEach((p: any) => {
            if (p.text) {
              console.log('\n[ASSISTANT]:', p.text)
            }
            if (p.call) {
              console.log('\n[TOOL CALL]:', JSON.stringify(p.call, null, 2))
            }
          })
        }

        if (content.groundingMetadata) {
          console.log('\n[GROUNDING METADATA]:', JSON.stringify(content.groundingMetadata, null, 2))
        }

        if (content.turnComplete) {
          console.log('\n--- Turn Complete ---')
          ws.close()
        }
      }

      if (response.error) {
        console.error('\n[ERROR]:', response.error)
        ws.close()
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
