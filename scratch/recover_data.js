import fs from 'node:fs'

// Use the 15:51 backup as the golden source (discovered to be cleaner than 17:02)
const goldenPath = 'C:\\Users\\h4rdc\\Documents\\Github\\coding-agent\\VRMs\\recovery\\airi-characters-2026-05-01T15_51_30.329Z.json'
const latestPath = 'C:\\Users\\h4rdc\\Documents\\Github\\coding-agent\\VRMs\\kanjira\\airi-characters-2026-05-06T04_36_38.678Z.json'
const outputPath = 'C:\\Users\\h4rdc\\Documents\\Github\\airi-rebase-scratch\\fixed_data.txt'

function restoreData() {
  console.log('Loading files...')
  const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'))
  const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'))

  const goldenById = new Map(golden.cards)
  const goldenByName = new Map()
  for (const [id, card] of golden.cards) {
    goldenByName.set(card.name.toLowerCase(), card)
  }

  let restoredCount = 0

  for (const cardPair of latest.cards) {
    const id = cardPair[0]
    const card = cardPair[1]

    // Try ID match first
    let oldCard = goldenById.get(id)

    // If ID match fails, try exact Name match
    if (!oldCard) {
      oldCard = goldenByName.get(card.name.toLowerCase())
      if (oldCard) {
        console.log(`Name match for: ${card.name} (${id})`)
      }
    }

    // If Name match fails, try fuzzy Name match
    if (!oldCard) {
      const cardNameLower = card.name.toLowerCase()
      for (const [gName, gCard] of goldenByName.entries()) {
        if (cardNameLower.includes(gName) || gName.includes(cardNameLower)) {
          oldCard = gCard
          console.log(`Fuzzy name match for: ${card.name} (${id}) -> ${gCard.name}`)
          break
        }
      }
    }

    if (oldCard) {
      console.log(`Restoring tech-stack for: ${card.name} (${id})`)

      // Restore modules (includes displayModelId, consciousness, speech)
      if (oldCard.extensions?.airi?.modules && card.extensions?.airi?.modules) {
        const oldModules = oldCard.extensions.airi.modules
        const newModules = card.extensions.airi.modules

        newModules.displayModelId = oldModules.displayModelId
        newModules.consciousness = JSON.parse(JSON.stringify(oldModules.consciousness))
        newModules.speech = JSON.parse(JSON.stringify(oldModules.speech))

        // Also restore activeBackgroundId if available in gold
        if (oldModules.activeBackgroundId) {
          newModules.activeBackgroundId = oldModules.activeBackgroundId
        }
      }

      // Restore generation block
      if (oldCard.extensions?.airi?.generation && card.extensions?.airi?.generation) {
        card.extensions.airi.generation = JSON.parse(JSON.stringify(oldCard.extensions.airi.generation))
      }

      // Restore acting block (prompts, idle animations)
      if (oldCard.extensions?.airi?.acting && card.extensions?.airi?.acting) {
        card.extensions.airi.acting = JSON.parse(JSON.stringify(oldCard.extensions.airi.acting))
      }

      restoredCount++
    }
    else {
      console.warn(`No golden record for: ${card.name} (${id}). Keeping current data.`)
    }
  }

  console.log(`Successfully patched ${restoredCount} characters.`)

  // Stringify only the cards array (which is what 'airi-cards' store expects)
  const cardsArray = latest.cards
  const jsonString = JSON.stringify(cardsArray)
  const base64Data = Buffer.from(jsonString).toString('base64')

  // Create the full console command with location.reload() for immediate application
  const command = `localStorage.setItem('airi-cards', atob('${base64Data}')); location.reload();`

  fs.writeFileSync(outputPath, command, 'utf8')
  console.log(`Command written to: ${outputPath}`)
}

try {
  restoreData()
}
catch (err) {
  console.error('Error during restoration:', err)
}
