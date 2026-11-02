#!/bin/bash
# Registers PortfoliOS Native Game Relay Host with Chrome, Chromium, Edge, and Firefox on Linux / macOS.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER_PATH="$SCRIPT_DIR/host-runner.sh"
CHROME_MANIFEST="$SCRIPT_DIR/manifests/com.bl4ut0.portfolios.relay.chrome.json"
FIREFOX_MANIFEST="$SCRIPT_DIR/manifests/com.bl4ut0.portfolios.relay.firefox.json"

chmod +x "$RUNNER_PATH" "$SCRIPT_DIR/host.mjs"

echo "Registering PortfoliOS Native Relay Host..."

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS paths
    CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
    FIREFOX_DIR="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
else
    # Linux paths
    CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
    FIREFOX_DIR="$HOME/.mozilla/native-messaging-hosts"
fi

for DIR in "$CHROME_DIR" "$EDGE_DIR" "$FIREFOX_DIR"; do
    mkdir -p "$DIR"
done

cp "$CHROME_MANIFEST" "$CHROME_DIR/com.bl4ut0.portfolios.relay.json" 2>/dev/null || true
cp "$CHROME_MANIFEST" "$EDGE_DIR/com.bl4ut0.portfolios.relay.json" 2>/dev/null || true
cp "$FIREFOX_MANIFEST" "$FIREFOX_DIR/com.bl4ut0.portfolios.relay.json" 2>/dev/null || true

echo "Registered for Chrome, Edge, and Firefox."
