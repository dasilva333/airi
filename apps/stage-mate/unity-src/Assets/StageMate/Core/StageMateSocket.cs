using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace StageMate.Core
{
    public class StageMateSocket : MonoBehaviour
    {
        [Header("Connection Settings")]
        public string wsUrl = "ws://localhost:6171";
        public float reconnectIntervalSeconds = 2.0f;
        public float pingIntervalSeconds = 5.0f;

        public event Action<string> OnMessageReceived;
        public event Action OnConnected;
        public event Action OnDisconnected;

        public bool IsConnected => isConnected;
        public DateTime LastRxTime => lastRxTime;

        private ClientWebSocket socket;
        private CancellationTokenSource cts;
        private volatile bool isConnected;
        private DateTime lastRxTime = DateTime.MinValue;
        private readonly ConcurrentQueue<string> inboundQueue = new ConcurrentQueue<string>();
        private readonly ConcurrentQueue<string> outboundQueue = new ConcurrentQueue<string>();

        private static string runtimeLogPath;
        private static StreamWriter runtimeLogWriter;

        private void Awake()
        {
            try
            {
                string dir = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Build"));
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                runtimeLogPath = Path.Combine(dir, "stagemate-runtime.log");
                runtimeLogWriter = new StreamWriter(runtimeLogPath, append: false, Encoding.UTF8) { AutoFlush = true };
                runtimeLogWriter.WriteLine($"=== StageMate Runtime Log Started: {DateTime.Now:yyyy-MM-dd HH:mm:ss} ===");
                Application.logMessageReceived += HandleLogMessage;
            }
            catch { }
        }

        private void HandleLogMessage(string logString, string stackTrace, LogType type)
        {
            try
            {
                string timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
                runtimeLogWriter?.WriteLine($"[{timestamp}] [{type}] {logString}");
                if (type == LogType.Exception || type == LogType.Error)
                {
                    runtimeLogWriter?.WriteLine(stackTrace);
                }
            }
            catch { }
        }

        private void Start()
        {
            StartCoroutine(ConnectionLoop());
        }

        private void Update()
        {
            // Process inbound messages on the Unity main thread
            while (inboundQueue.TryDequeue(out var json))
            {
                try
                {
                    OnMessageReceived?.Invoke(json);
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[StageMateSocket] Error dispatching message: {ex.Message}\n{ex.StackTrace}");
                }
            }
        }

        private void OnDestroy()
        {
            Disconnect();
            try
            {
                Application.logMessageReceived -= HandleLogMessage;
                runtimeLogWriter?.Flush();
                runtimeLogWriter?.Close();
            }
            catch { }
        }

        public void SendJson(string json)
        {
            if (!isConnected || socket == null || socket.State != WebSocketState.Open)
                return;

            outboundQueue.Enqueue(json);
        }

        public void Disconnect()
        {
            isConnected = false;
            cts?.Cancel();
            try
            {
                if (socket != null && socket.State == WebSocketState.Open)
                {
                    socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None).Wait(500);
                }
                socket?.Dispose();
            }
            catch { }
            socket = null;
        }

        private System.Collections.IEnumerator ConnectionLoop()
        {
            while (true)
            {
                if (!isConnected)
                {
                    var task = Task.Run(() => ConnectAsync());
                    while (!task.IsCompleted)
                        yield return null;

                    if (task.IsFaulted)
                    {
                        Debug.LogWarning($"[StageMateSocket] Connection failed: {task.Exception?.GetBaseException().Message}");
                    }
                }

                yield return new WaitForSeconds(reconnectIntervalSeconds);
            }
        }

        private async Task ConnectAsync()
        {
            cts = new CancellationTokenSource();
            socket = new ClientWebSocket();

            try
            {
                var uri = new Uri(wsUrl);
                Debug.Log($"[StageMateSocket] Connecting to {uri}...");
                await socket.ConnectAsync(uri, cts.Token);

                // Authenticate
                string token = ResolveAuthToken();
                var authMsg = new AuthMessage
                {
                    type = "module:authenticate",
                    data = new AuthData { token = token, caller = "stage-mate" }
                };
                string authJson = JsonUtility.ToJson(authMsg);
                byte[] authBytes = Encoding.UTF8.GetBytes(authJson);
                await socket.SendAsync(new ArraySegment<byte>(authBytes), WebSocketMessageType.Text, true, cts.Token);

                isConnected = true;
                lastRxTime = DateTime.UtcNow;
                inboundQueue.Enqueue(JsonUtility.ToJson(new WireEnvelope { type = "_internal:connected" }));

                // Start send and receive loops
                var receiveTask = ReceiveLoopAsync(cts.Token);
                var sendTask = SendLoopAsync(cts.Token);

                await Task.WhenAny(receiveTask, sendTask);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[StageMateSocket] Socket lifecycle ended: {ex.Message}");
            }
            finally
            {
                isConnected = false;
                inboundQueue.Enqueue(JsonUtility.ToJson(new WireEnvelope { type = "_internal:disconnected" }));
                try { socket?.Dispose(); } catch { }
                socket = null;
            }
        }

        private async Task ReceiveLoopAsync(CancellationToken token)
        {
            var buffer = new byte[65536];
            var ms = new MemoryStream();

            while (!token.IsCancellationRequested && socket != null && socket.State == WebSocketState.Open)
            {
                ms.SetLength(0);
                WebSocketReceiveResult result;
                do
                {
                    result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Ack close", token);
                        return;
                    }
                    ms.Write(buffer, 0, result.Count);
                } while (!result.EndOfMessage);

                lastRxTime = DateTime.UtcNow;
                string json = Encoding.UTF8.GetString(ms.ToArray());
                inboundQueue.Enqueue(json);
            }
        }

        private async Task SendLoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested && socket != null && socket.State == WebSocketState.Open)
            {
                if (outboundQueue.TryDequeue(out var json))
                {
                    byte[] bytes = Encoding.UTF8.GetBytes(json);
                    await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, token);
                }
                else
                {
                    await Task.Delay(10, token);
                }
            }
        }

        private string ResolveAuthToken()
        {
            // 1. CLI parameter: --token <val>
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i].Equals("--token", StringComparison.OrdinalIgnoreCase))
                    return args[i + 1].Trim('"');
            }

            // 2. Environment variable: AIRI_AUTH_TOKEN
            string envToken = Environment.GetEnvironmentVariable("AIRI_AUTH_TOKEN");
            if (!string.IsNullOrEmpty(envToken))
                return envToken;

            // 3. Known AIRI user-data config on disk (e.g. server-channel-config.json)
            try
            {
                string home = Environment.GetFolderPath(Environment.SpecialFolder.Personal);
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);

                string[] searchPaths = new string[]
                {
                    Path.Combine(appData, "@proj-airi", "stage-tamagotchi", "server-channel-config.json"),
                    Path.Combine(appData, "airi", "server-channel-config.json"),
                    Path.Combine(home, "Library", "Application Support", "@proj-airi", "stage-tamagotchi", "server-channel-config.json"),
                    Path.Combine(home, ".config", "@proj-airi", "stage-tamagotchi", "server-channel-config.json")
                };

                foreach (var sp in searchPaths)
                {
                    if (File.Exists(sp))
                    {
                        string text = File.ReadAllText(sp);
                        int idx = text.IndexOf("\"authToken\"");
                        if (idx >= 0)
                        {
                            int colon = text.IndexOf(':', idx);
                            int q1 = text.IndexOf('"', colon + 1);
                            int q2 = text.IndexOf('"', q1 + 1);
                            if (q1 >= 0 && q2 > q1)
                                return text.Substring(q1 + 1, q2 - q1 - 1).Trim();
                        }
                    }
                }
            }
            catch { }

            return "mate-stage-dev-token";
        }
    }
}
