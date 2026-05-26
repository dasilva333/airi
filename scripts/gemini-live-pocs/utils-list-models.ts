import https from 'node:https'

const API_KEY = 'AIzaSyAnNzARUkElomGk02VfWP3L-bPyo9BkQUQ'

const options = {
  headers: {
    'Content-Type': 'application/json',
  },
  hostname: 'generativelanguage.googleapis.com',
  method: 'GET',
  path: `/v1beta/models?key=${API_KEY}`,
}

const req = https.request(options, (res) => {
  let data = ''
  res.on('data', (chunk) => {
    data += chunk
  })
  res.on('end', () => {
    console.log('Response status:', res.statusCode)
    try {
      const parsed = JSON.parse(data)
      if (parsed.models) {
        console.log('Available models:')
        parsed.models.forEach((m: any) => console.log(`- ${m.name}`))
      } else {
        console.log('No models found or error:', data)
      }
    } catch {
      console.log('Raw response:', data)
    }
  })
})

req.on('error', (e) => {
  console.error('Request error:', e)
})

req.end()
