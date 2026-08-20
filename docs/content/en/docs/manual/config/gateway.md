---
title: Configuring the AIRI Gateway
description: How to configure the local WebSocket gateway, find and rotate authentication tokens, and securely pair external companion apps.
---

# Configuring the AIRI Gateway

The **AIRI Gateway** is a local WebSocket server that allows external clients—such as the Android/iOS Pocket companion apps, VS Code extensions, and custom Python scripts—to securely connect, stream audio, and interact with your desktop AIRI instance.

---

## 1. Gateway Security & Authentication

Starting with version `0.9.0-alpha.16`, the AIRI Gateway enforces a mandatory authentication handshake on every connection to prevent unauthorized software or LAN devices from accessing your companion.

### Application Gateway Key (Auth Token)
When AIRI is first installed, it generates a secure, random cryptographic UUID known as the **Gateway Auth Token**.
Any client connecting to `ws://127.0.0.1:6121` must pass this token during the WebSocket initialization handshake.

### Finding Your Gateway Token
You can find your Gateway Token in two ways:

1. **In the Settings UI**:
   - Open **Settings &rarr; System &rarr; Gateway / Connection**.
   - View or copy the **Application Gateway Key** using the copy button.
2. **In the Local Filesystem**:
   - On Windows: `%APPDATA%\airi\config.json` or `%APPDATA%\stage-tamagotchi\config.json`
   - On macOS: `~/Library/Application Support/airi/config.json`
   - On Linux: `~/.config/airi/config.json`
   - Look for the `"gatewayToken"` field.

### Rotating the Gateway Token
If you suspect your key has leaked or you want to revoke access to previously paired devices:
1. Go to **Settings &rarr; System &rarr; Gateway**.
2. Click **"Regenerate Key"**.
3. Re-pair your authorized mobile or extension clients with the new token.

---

## 2. Hostname Binding & LAN Pairing

For maximum security, the AIRI Gateway defaults to binding to the local loopback address: `127.0.0.1`.

| Binding Address | Access Scope | Security Level |
| :--- | :--- | :--- |
| `127.0.0.1` *(Default)* | Local PC only | **High** (External devices cannot reach the port). |
| `0.0.0.0` | Local Network (LAN) | **Standard** (Enables mobile Pocket apps on same WiFi; protected by token). |

### Pairing with Mobile (Stage Pocket) on Local WiFi
1. Change **AIRI Gateway Hostname** to `0.0.0.0` in Gateway Settings.
2. Ensure your PC's local IP address (e.g., `192.168.1.50`) is accessible across your home WiFi router.
3. In the Mobile Pocket app, enter your PC's IP, port `6121`, and your **Gateway Auth Token**.
4. Tap **Connect** to establish the live companion link.
