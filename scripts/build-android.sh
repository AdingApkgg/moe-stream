#!/usr/bin/env bash
# 用法: scripts/build-android.sh <mikiacg|aiacg> [--debug]
# 一键完成: 清理 -> tauri android init -> 注入签名配置 -> 注入 WebView 配置(去 wv UA + 开三方 cookie) -> 打包 aarch64 APK -> 复制到 build-output/
set -euo pipefail

VARIANT="${1:-}"
MODE="${2:-release}"

if [[ "$VARIANT" != "mikiacg" && "$VARIANT" != "aiacg" ]]; then
  echo "Usage: $0 <mikiacg|aiacg> [--debug]" >&2
  exit 1
fi

if [[ "$MODE" == "--debug" ]]; then
  TAURI_FLAGS="--debug"
  MODE_LABEL="debug"
else
  TAURI_FLAGS=""
  MODE_LABEL="release"
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export NDK_HOME="${NDK_HOME:-$ANDROID_HOME/ndk/28.2.13676358}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

CONFIG="src-tauri/configs/${VARIANT}.json"
PKG="com.${VARIANT}.app"
GEN_DIR="src-tauri/gen/android"
case "$VARIANT" in
  mikiacg) INTERNAL_DOMAIN="mikiacg.vip" ;;
  aiacg)   INTERNAL_DOMAIN="aiacg.vip" ;;
esac

echo "==> [${VARIANT} / ${MODE_LABEL}] 清理 gen/android"
rm -rf "$GEN_DIR"

echo "==> [${VARIANT} / ${MODE_LABEL}] tauri android init"
cargo tauri android init --config "$CONFIG"

GRADLE_FILE="$GEN_DIR/app/build.gradle.kts"
MAIN_ACTIVITY="$GEN_DIR/app/src/main/java/com/${VARIANT}/app/MainActivity.kt"

echo "==> 注入 release 签名配置到 build.gradle.kts"
/usr/bin/python3 - "$GRADLE_FILE" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1])
s = p.read_text()

# 1) 在 tauriProperties 块后(android { 之前)插入 keystoreProperties
keystore_block = '''val keystoreProperties = Properties().apply {
    val propFile = file("/Users/i/Code/mikiacg/src-tauri/keystore/keystore.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

'''
assert s.count('\nandroid {\n') == 1, f"unexpected number of 'android {{' in {p}"
s = s.replace('\nandroid {\n', '\n' + keystore_block + 'android {\n', 1)

# 2) android { 块开头加 signingConfigs
signing_block = '''    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
            storeFile = file(keystoreProperties.getProperty("storeFile"))
            storePassword = keystoreProperties.getProperty("storePassword")
        }
    }
'''
s = s.replace('android {\n', 'android {\n' + signing_block, 1)

# 3) release buildType 加 signingConfig
s = s.replace(
    'getByName("release") {\n',
    'getByName("release") {\n            signingConfig = signingConfigs.getByName("release")\n',
    1
)

# 4) targetSdk 降到 34,关闭 Android 15+ 的 edge-to-edge 强制(状态栏不再覆盖 WebView)
s = s.replace('targetSdk = 36', 'targetSdk = 34', 1)

p.write_text(s)
print(f"patched: {p}")
PY

echo "==> 替换 MainActivity.kt 注入 WebView 兼容性配置"
PKG_PATH="com/${VARIANT}/app"
cat > "$MAIN_ACTIVITY" <<KOTLIN
package ${PKG}

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // 不走 edge-to-edge,状态栏保持不透明,内容下沉到安全区域,避免被遮挡
    WindowCompat.setDecorFitsSystemWindows(window, true)
  }

  @SuppressLint("SetJavaScriptEnabled")
  override fun onWebViewCreate(webView: WebView) {
    val settings = webView.settings

    // 去掉 UA 里的 "wv" 标记,绕过 Google/Apple 等 OAuth 提供方对 WebView 的拦截
    var ua = settings.userAgentString ?: ""
    ua = ua.replace("; wv)", ")").replace(" wv", "")
    settings.userAgentString = ua

    // OAuth 回调通常依赖第三方 cookie
    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

    // 等 Tauri 自己设完 WebViewClient 之后再覆盖:外链跳系统浏览器
    webView.post {
      webView.webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
          val uri = request.url
          val host = uri.host ?: ""
          val scheme = uri.scheme ?: ""

          // 1) 自有域 -> 留在 App
          if (scheme == "https" && isInternalHost(host)) return false

          // 2) 服务器 302/301 重定向 -> 留在 App(覆盖 OAuth 的 sign-in -> 提供方 -> callback)
          if (request.isRedirect) return false

          // 3) http/https 外链 -> 系统浏览器
          if (scheme == "http" || scheme == "https") {
            return try {
              startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
              true
            } catch (e: Exception) {
              false
            }
          }

          // 4) 其它 scheme(mailto, tel, intent:// 等) -> 交给系统
          return try {
            startActivity(Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
          } catch (e: Exception) {
            false
          }
        }

        override fun onPageFinished(view: WebView, url: String) {
          super.onPageFinished(view, url)
          // target=_blank 链接改成同窗口跳转,以便 shouldOverrideUrlLoading 接管
          view.evaluateJavascript(
            "(function(){if(window.__blankLinkHandler)return;window.__blankLinkHandler=true;document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a');if(!a||a.target!=='_blank')return;var href=a.href;if(!href)return;e.preventDefault();window.location.href=href;},true);})();",
            null
          )
        }
      }
    }
  }

  private fun isInternalHost(host: String): Boolean {
    return host == "${INTERNAL_DOMAIN}" || host.endsWith(".${INTERNAL_DOMAIN}")
  }
}
KOTLIN

echo "==> cargo tauri android build --apk --target aarch64 ${TAURI_FLAGS}"
cargo tauri android build --apk --target aarch64 ${TAURI_FLAGS} --config "$CONFIG"

APK_SRC="$GEN_DIR/app/build/outputs/apk/universal/${MODE_LABEL}/app-universal-${MODE_LABEL}.apk"
mkdir -p build-output
case "$VARIANT" in
  mikiacg) APK_DST="build-output/MikiACG-${MODE_LABEL}.apk" ;;
  aiacg)   APK_DST="build-output/AiACG-${MODE_LABEL}.apk" ;;
esac

cp "$APK_SRC" "$APK_DST"
echo "==> 完成: $APK_DST ($(du -h "$APK_DST" | cut -f1))"
