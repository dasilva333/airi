import { describe, expect, it } from 'vitest'

import {
  embedWord,
  speakAddress,
  speakPath,
  speakWikiTarget,
  verbalizeObsidianWikiLinks,
  verbalizeWebAddressesAndLinks,
} from './web-address-speech'

describe('web-address-speech', () => {
  describe('speakWikiTarget', () => {
    it('handles simple and complex wiki targets', () => {
      expect(speakWikiTarget('Home Assistant 配置')).toBe('Home Assistant 配置')
      expect(speakWikiTarget('Home Assistant 配置#网络')).toBe('Home Assistant 配置 网络')
      expect(speakWikiTarget('Home Assistant 配置#^a1b2')).toBe('Home Assistant 配置')
    })
  })

  describe('embedWord', () => {
    it('returns appropriate word for media kinds', () => {
      expect(embedWord('shot.png', 'en')).toBe('image')
      expect(embedWord('shot.png', 'zh')).toBe('图片')
      expect(embedWord('shot.png', 'ja')).toBe('画像')
      expect(embedWord('voice.mp3', 'en')).toBe('audio')
      expect(embedWord('voice.mp3', 'zh')).toBe('音频')
      expect(embedWord('clip.mp4', 'en')).toBe('video')
      expect(embedWord('clip.mp4', 'zh')).toBe('视频')
      expect(embedWord('doc.pdf', 'en')).toBe('PDF file')
      expect(embedWord('doc.pdf', 'zh')).toBe('PDF 文件')
      expect(embedWord('note', 'en')).toBeUndefined()
    })
  })

  describe('verbalizeObsidianWikiLinks', () => {
    it('verbalizes standard wiki links with and without aliases', () => {
      expect(verbalizeObsidianWikiLinks('看 [[Home Assistant 配置]] 这页。', 'zh')).toBe('看 Home Assistant 配置 这页。')
      expect(verbalizeObsidianWikiLinks('看 [[Home Assistant 配置|配置说明]] 这页。', 'zh')).toBe('看 配置说明 这页。')
      expect(verbalizeObsidianWikiLinks('看 [[Home Assistant 配置#网络]] 这页。', 'zh')).toBe('看 Home Assistant 配置 网络 这页。')
      expect(verbalizeObsidianWikiLinks('看 [[Home Assistant 配置#^a1b2]] 这页。', 'zh')).toBe('看 Home Assistant 配置 这页。')
    })

    it('verbalizes embeds and handles dimensions', () => {
      expect(verbalizeObsidianWikiLinks('图 ![[shot.png]] 在这。', 'zh')).toBe('图 图片 在这。')
      expect(verbalizeObsidianWikiLinks('图 ![[shot.png|截图]] 在这。', 'zh')).toBe('图 截图 在这。')
      expect(verbalizeObsidianWikiLinks('图 ![[shot.png|300]] 在这。', 'zh')).toBe('图 图片 在这。')
      expect(verbalizeObsidianWikiLinks('图 ![[shot.png|300x200]] 在这。', 'zh')).toBe('图 图片 在这。')
      expect(verbalizeObsidianWikiLinks('听 ![[voice.mp3]]，看 ![[clip.mp4]]，读 ![[doc.pdf]]。', 'zh')).toBe('听 音频，看 视频，读 PDF 文件。')
      expect(verbalizeObsidianWikiLinks('See ![[shot.png]] here.', 'en')).toBe('See image here.')
    })
  })

  describe('speakAddress', () => {
    it('verbalizes web URLs and hostnames', () => {
      expect(speakAddress('https://home.example.com', 'en')).toBe('https home dot example dot com')
      expect(speakAddress('https://home.example.com', 'zh')).toBe('https home 点 example 点 com')
      expect(speakAddress('https://home.example.com:8123/config', 'en')).toBe('https home dot example dot com port 8123 slash config')
      expect(speakAddress('https://home.example.com:8123/config', 'zh')).toBe('https home 点 example 点 com 端口 8123 斜杠 config')
      expect(speakAddress('example.com', 'en')).toBe('example dot com')
    })
  })

  describe('speakPath', () => {
    it('verbalizes relative and absolute file paths', () => {
      expect(speakPath('./src/index.ts', 'en')).toBe('dot slash src slash index dot ts')
      expect(speakPath('./src/index.ts', 'zh')).toBe('点 斜杠 src 斜杠 index 点 ts')
      expect(speakPath('C:\\Users\\user', 'en')).toBe('C colon backslash Users backslash user')
      expect(speakPath('~/notes/todo.md', 'en')).toBe('tilde slash notes slash todo dot md')
    })
  })

  describe('verbalizeWebAddressesAndLinks full pipeline', () => {
    it('processes addresses in code, prose, and angle brackets', () => {
      expect(verbalizeWebAddressesAndLinks('连接 Home Assistant 地址 `https://home.example.com` 时，网络请求失败。', 'zh'))
        .toBe('连接 Home Assistant 地址 https home 点 example 点 com 时，网络请求失败。')
      expect(verbalizeWebAddressesAndLinks('Open `https://home.example.com` now.', 'en'))
        .toBe('Open https home dot example dot com now.')
      expect(verbalizeWebAddressesAndLinks('链接 <https://home.example.com> 在这。', 'zh'))
        .toBe('链接 https home 点 example 点 com 在这。')
      expect(verbalizeWebAddressesAndLinks('打开 `./src/index.ts` 看看。', 'zh'))
        .toBe('打开 点 斜杠 src 斜杠 index 点 ts 看看。')
      expect(verbalizeWebAddressesAndLinks('Open C:\\Users\\user now.', 'en'))
        .toBe('Open C colon backslash Users backslash user now.')
      expect(verbalizeWebAddressesAndLinks('Is it example.com? See https://a.io now.', 'en'))
        .toBe('Is it example dot com? See https a dot io now.')
    })
  })
})
