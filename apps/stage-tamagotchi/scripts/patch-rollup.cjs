const fs = require('node:fs')

const target = 'node_modules/.pnpm/rollup@4.59.0/node_modules/rollup/dist/es/shared/node-entry.js'
let code = fs.readFileSync(target, 'utf8')

let count = 0
code = code.replace(/if\s*\(!this\.included\)\s*this\.includeNode\(context\);/g, () => {
  count++
  return 'if (!this.included && typeof this.includeNode === "function") this.includeNode(context);'
})

console.log('Replaced', count, 'occurrences')
fs.writeFileSync(target, code, 'utf8')
