import { describe, expect, it } from 'vitest'

import {
  applyUSTTransformations,
  integerToWords,
  toSignedPercent,
  verbalizePrices,
} from './speech'

describe('speech store helpers', () => {
  it('formats positive percentages with a plus sign', () => {
    expect(toSignedPercent(25)).toBe('+25%')
  })

  it('formats negative percentages without a double minus', () => {
    expect(toSignedPercent(-20)).toBe('-20%')
    expect(toSignedPercent(-20)).not.toContain('--')
  })

  it('formats zero as 0%', () => {
    expect(toSignedPercent(0)).toBe('0%')
  })

  describe('integerToWords', () => {
    it('converts single digits and zero', () => {
      expect(integerToWords(0)).toBe('zero')
      expect(integerToWords(7)).toBe('seven')
    })

    it('converts teens and tens', () => {
      expect(integerToWords(13)).toBe('thirteen')
      expect(integerToWords(19)).toBe('nineteen')
      expect(integerToWords(20)).toBe('twenty')
      expect(integerToWords(42)).toBe('forty-two')
      expect(integerToWords(99)).toBe('ninety-nine')
    })

    it('converts hundreds and thousands', () => {
      expect(integerToWords(100)).toBe('one hundred')
      expect(integerToWords(305)).toBe('three hundred five')
      expect(integerToWords(1250)).toBe('one thousand two hundred fifty')
    })

    it('handles negative numbers', () => {
      expect(integerToWords(-5)).toBe('minus five')
    })
  })

  describe('verbalizePrices', () => {
    it('converts dollars and cents naturally', () => {
      expect(verbalizePrices('Your total is $19.99.')).toBe(
        'Your total is nineteen dollars and ninety-nine cents.',
      )
      expect(verbalizePrices('Only $0.50 per ticket')).toBe(
        'Only fifty cents per ticket',
      )
      expect(verbalizePrices('Costs $5!')).toBe(
        'Costs five dollars!',
      )
      expect(verbalizePrices('Total: $1,200.50')).toBe(
        'Total: one thousand two hundred dollars and fifty cents',
      )
    })
  })

  describe('applyUSTTransformations', () => {
    it('returns original text if UST is disabled or undefined', () => {
      expect(applyUSTTransformations('*smiles* $19.99', undefined)).toBe('*smiles* $19.99')
      expect(applyUSTTransformations('*smiles* $19.99', { enabled: false } as any)).toBe('*smiles* $19.99')
    })

    it('processes brackets according to actions: mute, flatten, passThrough, token', () => {
      const baseUst: any = {
        enabled: true,
        asterisks: 'mute',
        squareBrackets: 'flatten',
        parentheses: 'passThrough',
        angleBrackets: 'token',
        stripHtml: false,
        readCurrencyNaturally: false,
      }

      const input = '*giggles* [happy] (whispers) <aside>'
      const output = applyUSTTransformations(input, baseUst)
      expect(output).toBe('happy (whispers) <|aside|>')
    })

    it('handles math formulas mute vs passThrough vs verbalize', () => {
      const ustMuteMath: any = {
        enabled: true,
        mathFormulas: 'mute',
        readCurrencyNaturally: false,
      }
      expect(applyUSTTransformations('Formula $x^2 + y^2 = z^2$ is fun', ustMuteMath)).toBe('Formula is fun')

      const ustPassMath: any = {
        enabled: true,
        mathFormulas: 'passThrough',
        readCurrencyNaturally: false,
      }
      expect(applyUSTTransformations('Formula $x^2 + y^2 = z^2$ is fun', ustPassMath)).toBe('Formula $x^2 + y^2 = z^2$ is fun')

      const ustVerbalizeMath: any = {
        enabled: true,
        mathFormulas: 'verbalize',
        formulaLanguage: 'en',
        readCurrencyNaturally: false,
      }
      expect(applyUSTTransformations('Formula $x^2 + y^2 = z^2$ is fun', ustVerbalizeMath)).toBe('Formula x squared plus y squared equals z squared is fun')

      const ustVerbalizeMathJa: any = {
        enabled: true,
        mathFormulas: 'verbalize',
        formulaLanguage: 'ja',
        readCurrencyNaturally: false,
      }
      expect(applyUSTTransformations('Formula $x^2 + y^2 = z^2$ is fun', ustVerbalizeMathJa)).toBe('Formula エックスの二乗プラスワイの二乗 イコール ゼットの二乗 is fun')
    })

    it('handles chemical notation mute vs passThrough vs verbalize', () => {
      const ustMuteChem: any = {
        enabled: true,
        chemicalNotation: 'mute',
        readCurrencyNaturally: false,
      }
      expect(applyUSTTransformations('Mix \\ce{H2O} and acid', ustMuteChem)).toBe('Mix and acid')

      const ustPassChem: any = {
        enabled: true,
        chemicalNotation: 'passThrough',
        readCurrencyNaturally: false,
      }
      expect(applyUSTTransformations('Mix \\ce{H2O} and acid', ustPassChem)).toBe('Mix \\ce{H2O} and acid')

      const ustVerbalizeChem: any = {
        enabled: true,
        chemicalNotation: 'verbalize',
        formulaLanguage: 'en',
        readCurrencyNaturally: false,
      }
      expect(applyUSTTransformations('Mix \\ce{H2O} and acid', ustVerbalizeChem)).toBe('Mix H two O and acid')
      expect(applyUSTTransformations('Reaction \\ce{2H2 + O2 -> 2H2O} done', ustVerbalizeChem)).toBe('Reaction two H two plus O two yields two H two O done')
    })

    it('handles complex combined playground scenario with UST transformations', () => {
      const ustFull: any = {
        enabled: true,
        asterisks: 'flatten',
        mathFormulas: 'verbalize',
        chemicalNotation: 'verbalize',
        readCurrencyNaturally: true,
        formulaLanguage: 'en',
        stripEmojis: true,
      }
      const input = '*smiles* In water \\ce{H2O}, $x^2 + y^2 = z^2$ costs $19.99 😊'
      const transformed = applyUSTTransformations(input, ustFull)
      expect(transformed).toContain('smiles')
      expect(transformed).toContain('H two O')
      expect(transformed).toContain('x squared plus y squared equals z squared')
      expect(transformed).toContain('nineteen dollars and ninety-nine cents')
      expect(transformed).not.toContain('😊')
      expect(transformed).not.toContain('*')
      expect(transformed).not.toContain('$')
    })

    it('handles code blocks mute vs passThrough', () => {
      const ustMuteCode: any = {
        enabled: true,
        codeBlocks: 'mute',
        readCurrencyNaturally: false,
      }
      expect(applyUSTTransformations('Start\n```bash\npnpm dev\n```\nDone', ustMuteCode)).toBe('Start\n\nDone')

      const ustPassCode: any = {
        enabled: true,
        codeBlocks: 'passThrough',
        readCurrencyNaturally: false,
      }
      expect(applyUSTTransformations('Start\n```bash\npnpm dev\n```\nDone', ustPassCode)).toBe('Start\n```bash\npnpm dev\n```\nDone')
    })

    it('protects arithmetic multiplication from asterisk muting', () => {
      const ustAsteriskMute: any = {
        enabled: true,
        asterisks: 'mute',
        preserveMathOperators: true,
        readCurrencyNaturally: false,
      }
      expect(applyUSTTransformations('*smiles* 2 * 3 = 6', ustAsteriskMute)).toBe('2 * 3 = 6')
    })

    it('handles web addresses and Obsidian wiki-links verbalization', () => {
      const ustWebAddressesEnabled: any = {
        enabled: true,
        readCurrencyNaturally: false,
        readWebAddressesNaturally: true,
      }
      expect(applyUSTTransformations('See https://home.example.com now.', ustWebAddressesEnabled))
        .toBe('See https home dot example dot com now.')
      expect(applyUSTTransformations('看 [[Home Assistant 配置|配置说明]] 这页。', ustWebAddressesEnabled, 'zh'))
        .toBe('看 配置说明 这页。')
      expect(applyUSTTransformations('看 [[Home Assistant 配置#网络]] 这页。', ustWebAddressesEnabled, 'zh'))
        .toBe('看 Home Assistant 配置 网络 这页。')
      expect(applyUSTTransformations('图 ![[shot.png|300]] 在这。', ustWebAddressesEnabled, 'zh'))
        .toBe('图 图片 在这。')
      expect(applyUSTTransformations('See ![[shot.png]] here.', ustWebAddressesEnabled, 'en'))
        .toBe('See image here.')
      expect(applyUSTTransformations('打开 `./src/index.ts` 看看。', ustWebAddressesEnabled, 'zh'))
        .toBe('打开 点 斜杠 src 斜杠 index 点 ts 看看。')

      const ustWebAddressesDisabled: any = {
        enabled: true,
        readCurrencyNaturally: false,
        readWebAddressesNaturally: false,
        squareBrackets: 'passThrough',
      }
      expect(applyUSTTransformations('See https://home.example.com now.', ustWebAddressesDisabled))
        .toBe('See https://home.example.com now.')
      expect(applyUSTTransformations('看 [[Home Assistant 配置|配置说明]] 这页。', ustWebAddressesDisabled))
        .toBe('看 [[Home Assistant 配置|配置说明]] 这页。')
    })
  })
})
