<?php
const UT99_REMOTE_BASE = "https://www.icculus.org/ut99-emscripten/flyby/wasm/";

$pathInfo = $_SERVER["PATH_INFO"] ?? "";
$requested = $pathInfo !== "" ? ltrim($pathInfo, "/") : ($_GET["file"] ?? "index.html");
$requested = str_replace("\\", "/", rawurldecode($requested));

if ($requested === "" || $requested === ".") {
    $requested = "index.html";
}

if (
    strpos($requested, "..") !== false ||
    strpos($requested, "/") === 0 ||
    preg_match('/^[a-z][a-z0-9+.-]*:/i', $requested)
) {
    http_response_code(400);
    header("Content-Type: text/plain; charset=UTF-8");
    echo "Invalid UT99 runtime path.";
    exit;
}

$extension = strtolower(pathinfo(parse_url($requested, PHP_URL_PATH) ?: $requested, PATHINFO_EXTENSION));
$types = [
    "html" => "text/html; charset=UTF-8",
    "js" => "text/javascript; charset=UTF-8",
    "json" => "application/json; charset=UTF-8",
    "wasm" => "application/wasm",
    "png" => "image/png",
    "jpg" => "image/jpeg",
    "jpeg" => "image/jpeg",
    "gif" => "image/gif",
    "svg" => "image/svg+xml",
    "css" => "text/css; charset=UTF-8",
    "txt" => "text/plain; charset=UTF-8"
];
$isHtml = $extension === "html";
$runtimeBaseHref = "/apps/ut99/runtime/index.php/";

header("Content-Type: " . ($types[$extension] ?? "application/octet-stream"));
header("Cross-Origin-Opener-Policy: same-origin");
header("Cross-Origin-Embedder-Policy: require-corp");
header("Cross-Origin-Resource-Policy: same-origin");
header("Permissions-Policy: cross-origin-isolated=(self)");
header("X-Content-Type-Options: nosniff");
header("X-Robots-Tag: noindex, nofollow, nosnippet, noarchive");
$localPath = $requested;
if (strpos($localPath, "gamedata/") === 0) {
    $localPath = substr($localPath, 9);
}
$localFile = __DIR__ . "/gamedata/" . $localPath;
if (file_exists($localFile) && !is_dir($localFile)) {
    header("Content-Length: " . filesize($localFile));
    readfile($localFile);
    exit;
}

$remoteUrl = UT99_REMOTE_BASE . implode("/", array_map("rawurlencode", explode("/", $requested)));

function fail_runtime_fetch($message) {
    http_response_code(502);
    header("Content-Type: text/html; charset=UTF-8");
    echo "<!doctype html><meta charset=\"utf-8\"><title>UT99 Runtime</title>";
    echo "<body style=\"background:#05070b;color:#e5f6ff;font:16px system-ui;padding:2rem\">";
    echo "<h1>UT99 runtime fetch failed</h1>";
    echo "<p>" . htmlspecialchars($message, ENT_QUOTES, "UTF-8") . "</p>";
    echo "</body>";
    exit;
}

function prepare_runtime_html($html, $baseHref) {
    $base = "<base href=\"" . htmlspecialchars($baseHref, ENT_QUOTES, "UTF-8") . "\">";
    $favicon = "<link rel=\"icon\" href=\"data:,\">";
    $volumeHook = "<script src=\"/volume-hook.js?v=1.0.93\"></script>";
    $errorBridge = <<<'HTML'
<script>
(function() {
    function sendError(type, message, detail) {
        if (window.parent && window.parent !== window) {
            try {
                window.parent.postMessage({
                    source: "portfolio-ut99-runtime",
                    type: "ut99-log",
                    level: "error",
                    message: "[Iframe] " + type + ": " + message,
                    detail: detail || null
                }, window.location.origin);
            } catch (e) {}
        }
    }

    window.addEventListener("error", function(event) {
        sendError("Unhandled Error",
            (event.message || "Unknown") + " at " +
            (event.filename || "?") + ":" +
            (event.lineno || 0) + ":" +
            (event.colno || 0),
            event.error ? (event.error.stack || event.error.message) : null
        );
    });

    window.addEventListener("unhandledrejection", function(event) {
        var reason = event.reason;
        var msg = reason instanceof Error ? reason.message : String(reason || "");
        sendError("Unhandled Promise Rejection", msg,
            reason instanceof Error ? (reason.stack || reason.message) : null
        );
    });

    window.__ut99SendError = sendError;
})();
</script>
HTML;
    $fullscreenStyle = <<<'HTML'
<style id="portfolios-ut99-fullscreen">
html,
body {
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: #000 !important;
}

body > a[href*="emscripten"],
#spinner,
#status,
#controls,
#progress,
#output,
progress {
    display: none !important;
}

.emscripten,
div.emscripten {
    display: block !important;
    width: 100% !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    text-align: left !important;
}

.emscripten_border {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    border: 0 !important;
    background: #000 !important;
}

canvas.emscripten,
#canvas {
    position: absolute !important;
    inset: 0 !important;
    display: block !important;
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    background: #000 !important;
}
</style>
HTML;
    $fullscreenScript = <<<'HTML'
<script>
(function() {
    function fitUt99Canvas() {
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        var pointerLock = document.getElementById("pointerLock");
        if (pointerLock) {
            pointerLock.checked = false;
            pointerLock.defaultChecked = false;
            pointerLock.removeAttribute("checked");
        }
        var canvas = document.getElementById("canvas");
        if (!canvas) return;
        canvas.tabIndex = 0;
        canvas.style.position = "absolute";
        canvas.style.inset = "0";
        canvas.style.width = "100vw";
        canvas.style.height = "100vh";
        canvas.style.margin = "0";
        canvas.style.cursor = "default";
    }

    window.addEventListener("load", fitUt99Canvas);
    window.addEventListener("DOMContentLoaded", fitUt99Canvas);
    window.addEventListener("resize", fitUt99Canvas);
    document.addEventListener("pointerdown", fitUt99Canvas, true);
    window.setInterval(fitUt99Canvas, 1000);
})();
</script>
HTML;
    $html = str_replace(
        'id="pointerLock" checked',
        'id="pointerLock"',
        $html
    );
    $html = str_replace(
        "var dbname = 'ut99flyby';",
        "var dbname = 'ut99flyby-portfolios-v3';",
        $html
    );
    $html = str_replace(
        '          statusElement.innerHTML = text;',
        '          statusElement.innerHTML = text;
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              source: "portfolio-ut99-runtime",
              type: "ut99-status",
              status: text || ""
            }, window.location.origin);
          }',
        $html
    );
    $html = str_replace(
        'Module["callMain"]();',
        '(function() {
                          function exists(path) {
                            try {
                              FS.stat(path);
                              return true;
                            } catch (error) {
                              return false;
                            }
                          }
                          function copyIfMissing(source, target) {
                            try {
                              if (!exists(target) && exists(source)) {
                                FS.writeFile(target, FS.readFile(source, { encoding: "utf8" }));
                                console.log("PortfoliOS: seeded " + target + " from " + source);
                              }
                            } catch (error) {
                              console.warn("PortfoliOS: failed to seed " + target, error);
                            }
                          }
                          function ensureDir(path) {
                            try {
                              if (!exists(path)) FS.mkdir(path);
                            } catch (error) {}
                          }
                          function setIniValue(ini, section, key, value) {
                            var lines = String(ini || "").replace(/\r\n/g, "\n").split("\n");
                            var sectionName = "[" + section + "]";
                            var inSection = false;
                            var foundSection = false;
                            var inserted = false;
                            var output = [];
                            for (var i = 0; i < lines.length; i += 1) {
                              var line = lines[i];
                              var trimmed = line.trim();
                              if (/^\[[^\]]+\]$/.test(trimmed)) {
                                if (inSection && !inserted) {
                                  output.push(key + "=" + value);
                                  inserted = true;
                                }
                                inSection = trimmed.toLowerCase() === sectionName.toLowerCase();
                                foundSection = foundSection || inSection;
                              }
                              if (inSection && trimmed.indexOf("=") !== -1) {
                                var currentKey = trimmed.slice(0, trimmed.indexOf("=")).trim();
                                if (currentKey.toLowerCase() === key.toLowerCase()) {
                                  if (!inserted) {
                                    output.push(key + "=" + value);
                                    inserted = true;
                                  }
                                  continue;
                                }
                              }
                              output.push(line);
                            }
                            if (inSection && !inserted) output.push(key + "=" + value);
                            if (!foundSection) output.push("", sectionName, key + "=" + value);
                            return output.join("\n");
                          }
                          function removeIniPrefix(ini, section, prefix) {
                            var lines = String(ini || "").replace(/\r\n/g, "\n").split("\n");
                            var sectionName = "[" + section + "]";
                            var inSection = false;
                            var output = [];
                            for (var i = 0; i < lines.length; i += 1) {
                              var line = lines[i];
                              var trimmed = line.trim();
                              if (/^\[[^\]]+\]$/.test(trimmed)) {
                                inSection = trimmed.toLowerCase() === sectionName.toLowerCase();
                              }
                              if (inSection && trimmed.toLowerCase().indexOf(prefix.toLowerCase()) === 0) continue;
                              output.push(line);
                            }
                            return output.join("\n");
                          }
                          function setPracticeMapList(ini, section) {
                            var maps = ["DM-Codex.unr", "DM-Deck16][.unr", "DM-Turbine.unr", "DM-Phobos.unr"];
                            for (var i = 0; i < 32; i += 1) {
                              ini = setIniValue(ini, section, "Maps[" + i + "]", maps[i] || "");
                            }
                            return setIniValue(ini, section, "MapNum", "0");
                          }
                          function patchGameIni(ini) {
                            ini = removeIniPrefix(ini, "Engine.GameEngine", "ServerActors=");
                            ini = setIniValue(ini, "IpDrv.UdpBeacon", "DoBeacon", "False");
                            ini = setIniValue(ini, "UWeb.WebServer", "bEnabled", "False");
                            ini = setIniValue(ini, "Engine.GameInfo", "bLocalLog", "False");
                            ini = setIniValue(ini, "Engine.GameInfo", "bWorldLog", "False");
                            ini = setIniValue(ini, "Botpack.TournamentGameInfo", "bLocalLog", "False");
                            ini = setIniValue(ini, "Botpack.TournamentGameInfo", "bWorldLog", "False");
                            ini = setIniValue(ini, "Botpack.DeathMatchPlus", "bLocalLog", "False");
                            ini = setIniValue(ini, "Botpack.DeathMatchPlus", "bWorldLog", "False");
                            ini = setIniValue(ini, "Botpack.DeathMatchPlus", "MinPlayers", "1");
                            ["Botpack.TDMmaplist", "Botpack.TDMDefaultMapList", "Botpack.TDMSmallMapList", "Botpack.TDMMediumMapList", "Botpack.TDMLargeMapList"].forEach(function(section) {
                              ini = setPracticeMapList(ini, section);
                            });
                            return ini;
                          }
                          function patchUserIni(ini) {
                            ini = setIniValue(ini, "DefaultPlayer", "Class", "Botpack.TBoss");
                            ini = setIniValue(ini, "DefaultPlayer", "skin", "BossSkins.Boss");
                            ini = setIniValue(ini, "DefaultPlayer", "Face", "");
                            ini = setIniValue(ini, "Botpack.ChallengeBotInfo", "bRandomOrder", "False");
                            ini = setIniValue(ini, "Botpack.ChallengeBotInfo", "Difficulty", "1");
                            for (var i = 0; i < 32; i += 1) {
                              ini = setIniValue(ini, "Botpack.ChallengeBotInfo", "BotClasses[" + i + "]", "BotPack.TBossBot");
                              ini = setIniValue(ini, "Botpack.ChallengeBotInfo", "BotSkins[" + i + "]", "BossSkins.Boss");
                              ini = setIniValue(ini, "Botpack.ChallengeBotInfo", "BotFaces[" + i + "]", "");
                            }
                            return ini;
                          }
                          function prepareConfig(source, target, patcher) {
                            try {
                              var text = exists(source)
                                ? FS.readFile(source, { encoding: "utf8" })
                                : (exists(target) ? FS.readFile(target, { encoding: "utf8" }) : "");
                              if (!text) return;
                              FS.writeFile(target, patcher(text));
                              console.log("PortfoliOS: prepared browser-safe UT99 config " + target);
                            } catch (error) {
                              console.warn("PortfoliOS: failed to prepare " + target, error);
                            }
                          }
                          function verifyRequiredAsset(path, minSize) {
                            try {
                              var stat = FS.stat(path);
                              var size = stat && Number(stat.size);
                              return Number.isFinite(size) && size >= minSize ? size : -1;
                            } catch (error) {
                              return -1;
                            }
                          }
                          function verifyBrowserAssetCache() {
                            var checks = [
                              ["/System/BotPack.u", 1000000, "BotPack core classes"],
                              ["/Textures/BossSkins.utx", 1000000, "Boss player skin"],
                              ["/Textures/Soldierskins.utx", 1000000, "Iron Guard/SoldierSkins team package"],
                              ["/System/SoldierSkins.int", 200, "SoldierSkins metadata"]
                            ];
                            var bad = [];
                            for (var i = 0; i < checks.length; i += 1) {
                              if (verifyRequiredAsset(checks[i][0], checks[i][1]) < 0) {
                                bad.push(checks[i][2] + " at " + checks[i][0]);
                              }
                            }
                            if (!bad.length) {
                              try {
                                window.sessionStorage.removeItem("portfolios-ut99-cache-refresh-v3");
                              } catch (error) {}
                              console.log("PortfoliOS: verified UT99 browser cache includes Iron Guard/SoldierSkins assets.");
                              return;
                            }

                            var message = "PortfoliOS: UT99 cache is missing or corrupt required asset(s): " + bad.join(", ");
                            try {
                              if (window.sessionStorage.getItem("portfolios-ut99-cache-refresh-v3") !== "done" && window.indexedDB) {
                                window.sessionStorage.setItem("portfolios-ut99-cache-refresh-v3", "done");
                                console.warn(message + ". Clearing UT99 cache once and reloading.");
                                var request = window.indexedDB.deleteDatabase("ut99flyby-portfolios-v3");
                                request.onsuccess = request.onerror = request.onblocked = function() {
                                  window.location.reload();
                                };
                                window.setTimeout(function() {
                                  window.location.reload();
                                }, 1200);
                                throw new Error("UT99 cache refresh requested for missing assets.");
                              }
                            } catch (error) {
                              if (String(error && error.message || error).indexOf("cache refresh requested") !== -1) throw error;
                            }
                            console.error(message + ". Cache refresh already attempted; aborting before engine crash.");
                            throw new Error(message);
                          }
                          ensureDir("/Logs");
                          ensureDir("/Save");
                          ensureDir("/Cache");
                          console.log("PortfoliOS: UT99 runtime cache namespace ut99flyby-portfolios-v3.");
                          copyIfMissing("/System/Default.ini", "/System/UnrealTournament.ini");
                          copyIfMissing("/System/DefUser.ini", "/System/User.ini");
                          copyIfMissing("/System/Default.ini", "/UnrealTournament.ini");
                          copyIfMissing("/System/DefUser.ini", "/User.ini");
                          prepareConfig("/System/Default.ini", "/System/UnrealTournament.ini", patchGameIni);
                          prepareConfig("/System/DefUser.ini", "/System/User.ini", patchUserIni);
                          prepareConfig("/System/Default.ini", "/UnrealTournament.ini", patchGameIni);
                          prepareConfig("/System/DefUser.ini", "/User.ini", patchUserIni);
                          verifyBrowserAssetCache();
                        })();
                        try {
                          Module["callMain"]();
                        } catch (err) {
                          var errMsg = err && err.message ? err.message : String(err);
                          var errStack = err && err.stack ? err.stack : null;
                          console.error("PortfoliOS: Module.callMain() crashed: " + errMsg);
                          if (typeof window.__ut99SendError === "function") {
                            window.__ut99SendError("callMain crash", errMsg, errStack);
                          }
                          if (window.parent && window.parent !== window) {
                            window.parent.postMessage({
                              source: "portfolio-ut99-runtime",
                              type: "ut99-status",
                              status: "Runtime error: " + errMsg
                            }, window.location.origin);
                          }
                          throw err;
                        }',
        $html
    );
    $headParts = [$favicon, $volumeHook, $errorBridge, $fullscreenStyle, $fullscreenScript];
    if (stripos($html, "<base ") === false) {
        array_unshift($headParts, $base);
    }
    $headInjection = implode("\n    ", $headParts);

    if (stripos($html, "<head>") !== false) {
        return preg_replace("/<head>/i", "<head>\n    " . $headInjection, $html, 1);
    }
    return $headInjection . $html;
}

if (function_exists("curl_init")) {
    $curl = curl_init($remoteUrl);
    $curlOptions = [
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 12,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_USERAGENT => "PortfoliOS UT99 runtime proxy",
        CURLOPT_HEADER => false,
        CURLOPT_ENCODING => ""
    ];

    if ($isHtml) {
        $curlOptions[CURLOPT_RETURNTRANSFER] = true;
    } else {
        $curlOptions[CURLOPT_WRITEFUNCTION] = static function ($curl, $chunk) {
            echo $chunk;
            return strlen($chunk);
        };
    }

    curl_setopt_array($curl, $curlOptions);

    $result = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if ($result === false || $status >= 400) {
        fail_runtime_fetch($error !== "" ? $error : "Remote server returned HTTP " . $status . ".");
    }

    if ($isHtml) {
        echo prepare_runtime_html($result, $runtimeBaseHref);
    }
    exit;
}

if ($isHtml) {
    $context = stream_context_create([
        "http" => [
            "timeout" => 120,
            "header" => "User-Agent: PortfoliOS UT99 runtime proxy\r\n"
        ]
    ]);
    $html = @file_get_contents($remoteUrl, false, $context);
    if ($html === false) {
        fail_runtime_fetch("PHP cannot open the remote UT99 runtime URL.");
    }
    echo prepare_runtime_html($html, $runtimeBaseHref);
    exit;
}

$context = stream_context_create([
    "http" => [
        "timeout" => 120,
        "header" => "User-Agent: PortfoliOS UT99 runtime proxy\r\n"
    ]
]);
$stream = @fopen($remoteUrl, "rb", false, $context);
if (!$stream) {
    fail_runtime_fetch("PHP cannot open the remote UT99 runtime URL.");
}
fpassthru($stream);
fclose($stream);
