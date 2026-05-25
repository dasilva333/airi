import * as dotenv from 'dotenv'
import WebSocket from 'ws'

dotenv.config()

// USE THE STABLE AQ KEY
const PRIMARY_API_KEY = process.env.GEMINI_API_KEY || ''
const MODEL = 'models/gemini-3.1-flash-live-preview'
const API_VERSION = 'v1alpha'

async function main() {
  console.log('--- Tools POC: Isolated Clean Room ---')

  const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${API_VERSION}.GenerativeService.BidiGenerateContent?key=${PRIMARY_API_KEY}`
  console.debug('Connecting to endpoint...')

  const ws = new WebSocket(endpoint)

  ws.on('open', () => {
    console.debug('WebSocket connected!')

    const setupMessage = {
      setup: {
        generationConfig: {
          responseModalities: ['TEXT', 'AUDIO'],
        },
        model: MODEL,
        systemInstruction: {
          parts: [{ text: 'You are a helpful assistant. Use the "get_secret_word" tool to uncover the secret word.' }],
        },
        tools: [
          {
            functionDeclarations: [
              {
                description: 'Returns the secret code word.',
                name: 'get_secret_word',
                parameters: {
                  properties: {},
                  type: 'object',
                },
              },
            ],
          },
        ],
      },
    }

    console.debug('Sending setup message (Fixed Tools schema)...')
    ws.send(JSON.stringify(setupMessage))
  })

  ws.on('message', (data) => {
    try {
      const response = JSON.parse(data.toString())

      if (response.setupComplete) {
        console.debug('--- Setup complete! ---')

        // TRY THE OFFICIAL clientContent format for text turns
        const clientMessage = {
          clientContent: {
            turnComplete: true,
            turns: [
              {
                parts: [{ text: 'What is the secret word?' }],
              },
            ],
          },
        }
        console.log('Sending query via clientContent: "What is the secret word?"')
        ws.send(JSON.stringify(clientMessage))
      }

      if (response.serverContent) {
        console.log('\n[SERVER CONTENT RECEIVED]:', JSON.stringify(response.serverContent, null, 2))

        const content = response.serverContent
        if (content.modelTurn?.parts) {
          content.modelTurn.parts.forEach((p: any) => {
            if (p.text) console.log('\n[ASSISTANT]:', p.text)

            const call = p.functionCall || p.function_call
            if (call) {
              console.log('\n>>> TOOL CALLED:', call.name, 'with ID:', call.id)

              const toolResponse = {
                toolResponse: {
                  functionResponses: [
                    {
                      id: call.id,
                      name: 'get_secret_word',
                      response: { output: 'blue flamingo' },
                    },
                  ],
                },
              }
              console.log('Sending Tool Response: "blue flamingo"')
              ws.send(JSON.stringify(toolResponse))
            }
          })
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
    console.debug(`\nWebSocket closed [${code}]:`, reason.toString())
  })
}

main()
