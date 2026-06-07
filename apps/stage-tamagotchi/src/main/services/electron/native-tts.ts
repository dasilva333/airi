import type { Buffer } from 'node:buffer'

import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type { BrowserWindow } from 'electron'

import os from 'node:os'
import path from 'node:path'

import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'

import { defineInvokeHandler } from '@moeru/eventa'
import { isLinux, isMacOS, isWindows } from 'std-env'

import { electronGenerateNativeTts, electronGetNativeTtsVoices } from '../../../shared/eventa'

// Helper to run a shell command
function execPromise(command: string): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      }
      else {
        resolve({ stdout, stderr })
      }
    })
  })
}

// Windows native TTS implementation
async function getWindowsVoices(): Promise<any[]> {
  const tmpDir = os.tmpdir()
  const vbsFile = path.join(tmpDir, `airi_get_voices_${Date.now()}.vbs`)
  const script = `
Set voice = CreateObject("SAPI.SpVoice")
WScript.StdOut.Write "["
first = True
For Each v In voice.GetVoices
    If Not first Then
        WScript.StdOut.Write ","
    End If
    first = False
    name = v.GetAttribute("Name")
    lang = v.GetAttribute("Language")
    gender = v.GetAttribute("Gender")
    locale = "en-US"
    Select Case LCase(lang)
        Case "409", "0409": locale = "en-US"
        Case "809", "0809": locale = "en-GB"
        Case "40a", "040a": locale = "es-ES"
        Case "80a", "080a": locale = "es-MX"
        Case "40c", "040c": locale = "fr-FR"
        Case "407", "0407": locale = "de-DE"
        Case "411", "0411": locale = "ja-JP"
        Case "412", "0412": locale = "ko-KR"
        Case "804", "0804": locale = "zh-CN"
        Case "419", "0419": locale = "ru-RU"
        Case "416", "0416": locale = "pt-BR"
        Case "410", "0410": locale = "it-IT"
    End Select
    name_esc = Replace(name, "\\", "\\\\")
    name_esc = Replace(name_esc, """", "\\""")
    WScript.StdOut.Write "{""id"":""" & name_esc & """,""name"":""" & name_esc & """,""lang"":""" & locale & """,""gender"":""" & gender & """}"
Next
WScript.StdOut.Write "]"
  `
  try {
    await fs.writeFile(vbsFile, `\uFEFF${script}`, 'utf16le')
    const { stdout } = await execPromise(`cscript //NoLogo "${vbsFile}"`)
    const trimmed = stdout.trim()
    if (!trimmed)
      return []
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : [parsed]
  }
  catch (error) {
    console.error('[Native TTS Service] Failed to list Windows voices:', error)
    return []
  }
  finally {
    fs.unlink(vbsFile).catch(() => {})
  }
}

async function generateWindowsTts(text: string, voiceId?: string): Promise<Buffer> {
  const tmpDir = os.tmpdir()
  const vbsFile = path.join(tmpDir, `airi_tts_${Date.now()}_${Math.random().toString(36).slice(2)}.vbs`)
  const outFile = path.join(tmpDir, `airi_tts_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`)

  const script = `
Set voice = CreateObject("SAPI.SpVoice")
Set stream = CreateObject("SAPI.SpFileStream")
stream.Open "${outFile.replace(/\\/g, '\\\\')}", 3
Set voice.AudioOutputStream = stream
voiceId = "${(voiceId || '').replace(/"/g, '""')}"
If voiceId <> "" Then
    For Each v In voice.GetVoices
        If LCase(v.GetAttribute("Name")) = LCase(voiceId) Or LCase(v.GetDescription) = LCase(voiceId) Then
            Set voice.Voice = v
            Exit For
        End If
    Next
End If
voice.Speak "${text.replace(/"/g, '""')}"
stream.Close
  `
  try {
    await fs.writeFile(vbsFile, `\uFEFF${script}`, 'utf16le')
    await execPromise(`cscript //NoLogo "${vbsFile}"`)
    const buffer = await fs.readFile(outFile)
    return buffer
  }
  finally {
    fs.unlink(vbsFile).catch(() => {})
    fs.unlink(outFile).catch(() => {})
  }
}

// macOS native TTS implementation
async function getMacVoices(): Promise<any[]> {
  try {
    const { stdout } = await execPromise('say -v ?')
    const lines = stdout.split('\n')
    const voices: any[] = []
    for (const line of lines) {
      const match = line.match(/^([\w.-]+)\s+([a-z]{2}_[A-Z]{2})/)
      if (match) {
        const name = match[1].trim()
        const lang = match[2].replace('_', '-')
        voices.push({
          id: name,
          name,
          lang,
          gender: 'neutral',
        })
      }
    }
    return voices
  }
  catch (error) {
    console.error('[Native TTS Service] Failed to list macOS voices:', error)
    return []
  }
}

async function generateMacTts(text: string, voiceId?: string): Promise<Buffer> {
  const tmpDir = os.tmpdir()
  const textFile = path.join(tmpDir, `airi_tts_text_${Date.now()}.txt`)
  const outFile = path.join(tmpDir, `airi_tts_${Date.now()}.aiff`)

  await fs.writeFile(textFile, text, 'utf8')

  let cmd = `say -o "${outFile}" -f "${textFile}"`
  if (voiceId) {
    cmd += ` -v "${voiceId.replace(/"/g, '\\"')}"`
  }

  try {
    await execPromise(cmd)
    const buffer = await fs.readFile(outFile)
    return buffer
  }
  finally {
    fs.unlink(textFile).catch(() => {})
    fs.unlink(outFile).catch(() => {})
  }
}

// Linux native TTS implementation
async function getLinuxVoices(): Promise<any[]> {
  try {
    const { stdout } = await execPromise('espeak --voices')
    const lines = stdout.split('\n')
    const voices: any[] = []
    for (const line of lines) {
      // parse espeak output format: Pty Language Age/Gender VoiceName File Other
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 4 && parts[0] !== 'Pty') {
        const lang = parts[1]
        const gender = parts[2] === 'M' ? 'male' : parts[2] === 'F' ? 'female' : 'neutral'
        const name = parts[3]
        voices.push({
          id: name,
          name,
          lang,
          gender,
        })
      }
    }
    return voices
  }
  catch (error) {
    console.error('[Native TTS Service] Failed to list Linux voices:', error)
    return []
  }
}

async function generateLinuxTts(text: string, voiceId?: string): Promise<Buffer> {
  const tmpDir = os.tmpdir()
  const textFile = path.join(tmpDir, `airi_tts_text_${Date.now()}.txt`)
  const outFile = path.join(tmpDir, `airi_tts_${Date.now()}.wav`)

  await fs.writeFile(textFile, text, 'utf8')

  let cmd = `espeak -w "${outFile}" -f "${textFile}"`
  if (voiceId) {
    cmd += ` -v "${voiceId.replace(/"/g, '\\"')}"`
  }

  try {
    await execPromise(cmd)
    const buffer = await fs.readFile(outFile)
    return buffer
  }
  finally {
    fs.unlink(textFile).catch(() => {})
    fs.unlink(outFile).catch(() => {})
  }
}

export function createNativeTtsService(params: { context: ReturnType<typeof createContext>['context'], window: BrowserWindow }) {
  // Define voice listing handler
  defineInvokeHandler(params.context, electronGetNativeTtsVoices, async () => {
    if (isWindows) {
      return getWindowsVoices()
    }
    else if (isMacOS) {
      return getMacVoices()
    }
    else if (isLinux) {
      return getLinuxVoices()
    }
    return []
  })

  // Define TTS audio generation handler
  defineInvokeHandler(params.context, electronGenerateNativeTts, async (payload) => {
    if (!payload?.text) {
      return null
    }
    try {
      let buffer: Buffer
      if (isWindows) {
        buffer = await generateWindowsTts(payload.text, payload.voiceId)
      }
      else if (isMacOS) {
        buffer = await generateMacTts(payload.text, payload.voiceId)
      }
      else if (isLinux) {
        buffer = await generateLinuxTts(payload.text, payload.voiceId)
      }
      else {
        return null
      }

      // Convert Node Buffer to ArrayBuffer
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }
    catch (error) {
      console.error('[Native TTS Service] TTS generation error:', error)
      return null
    }
  })
}
