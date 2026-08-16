import UIKit
import Capacitor
import WebKit

class DevBridgeViewController: CAPBridgeViewController {
    private var initialAppUrl: URL?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if let webView = bridge?.webView {
            webView.navigationDelegate = self
            print("[DevBridge] Navigation delegate set for WebView")
        } else {
            print("[DevBridge] Warning: WebView not available in viewDidLoad")
        }
    }
}

extension DevBridgeViewController: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        print("[DevBridge] Navigation request to: \(url.absoluteString)")

        // Track the local application URL scheme
        if url.scheme == "capacitor" || url.host == "localhost" && (url.port == nil || url.port != 8976) {
            initialAppUrl = url
        }

        // Native OAuth 2.0 PKCE Callback Interceptor for Cloudflare Wrangler
        if (url.host == "localhost" || url.host == "127.0.0.1"), url.port == 8976, url.path == "/oauth/callback" {
            print("[DevBridge] Intercepted OAuth Callback URL on port 8976!")
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            let code = components?.queryItems?.first(where: { $0.name == "code" })?.value ?? ""
            let state = components?.queryItems?.first(where: { $0.name == "state" })?.value ?? ""
            let error = components?.queryItems?.first(where: { $0.name == "error" })?.value ?? ""

            decisionHandler(.cancel)

            // Resolve root app base URL
            let baseString: String
            if let serverUrl = self.bridge?.config.serverURL {
                baseString = serverUrl.absoluteString
            } else if let initial = initialAppUrl {
                baseString = "\(initial.scheme ?? "capacitor")://\(initial.host ?? "localhost")"
            } else {
                baseString = "capacitor://localhost"
            }

            let safeBase = baseString.replacingOccurrences(of: "/$", with: "", options: .regularExpression)

            if !code.isEmpty {
                print("[DevBridge] Successfully intercepted OAuth code: \(code.prefix(10))...")
                let safeCode = code.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? code
                let safeState = state.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? state
                let returnUrlString = "\(safeBase)/#/?cf_code=\(safeCode)&cf_state=\(safeState)"

                if let returnUrl = URL(string: returnUrlString) {
                    print("[DevBridge] Returning to app: \(returnUrl.absoluteString)")
                    DispatchQueue.main.async {
                        webView.load(URLRequest(url: returnUrl))
                    }
                }
            } else {
                print("[DevBridge] OAuth returned with error: \(error)")
                let safeError = error.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? error
                let returnUrlString = "\(safeBase)/#/?cf_error=\(safeError)"
                if let returnUrl = URL(string: returnUrlString) {
                    DispatchQueue.main.async {
                        webView.load(URLRequest(url: returnUrl))
                    }
                }
            }
            return
        }

        decisionHandler(.allow)
    }

    func webView(
        _ webView: WKWebView,
        didStartProvisionalNavigation navigation: WKNavigation!
    ) {
        print("[DevBridge] Started provisional navigation")
    }

    func webView(
        _ webView: WKWebView,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        let authMethod = challenge.protectionSpace.authenticationMethod

        if authMethod == NSURLAuthenticationMethodServerTrust {
            if let serverTrust = challenge.protectionSpace.serverTrust {
                completionHandler(.useCredential, URLCredential(trust: serverTrust))
                return
            }
        }

        completionHandler(.performDefaultHandling, nil)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        print("[DevBridge] Navigation failed: \(error.localizedDescription)")
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        print("[DevBridge] Navigation didFail: \(error.localizedDescription)")
    }
}
