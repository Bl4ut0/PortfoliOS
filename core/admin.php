<?php
/**
 * PortfoliOS Admin Management Gateway
 * Handles CLI authentication and persists approved portfolio customization options.
 */

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
header('Cross-Origin-Resource-Policy: same-origin');

$secretFile = __DIR__ . '/admin-secret.php';
$configFile = dirname(__DIR__) . '/data/portfolio-config.json';
$rateLimitFile = sys_get_temp_dir() . '/portfolios_admin_ratelimit.json';

// Rate Limiter: max 5 failed attempts per IP per 15 minutes
function checkRateLimit($ip, $rateLimitFile) {
    if (!file_exists($rateLimitFile)) return true;
    $raw = @file_get_contents($rateLimitFile);
    $data = json_decode($raw, true) ?: [];
    $now = time();
    if (isset($data[$ip])) {
        $entry = $data[$ip];
        if ($now - $entry['last_attempt'] < 900 && $entry['failures'] >= 5) {
            return false;
        }
    }
    return true;
}

function recordFailure($ip, $rateLimitFile) {
    $raw = @file_get_contents($rateLimitFile);
    $data = json_decode($raw, true) ?: [];
    $now = time();
    $failures = 1;
    if (isset($data[$ip])) {
        if ($now - $data[$ip]['last_attempt'] < 900) {
            $failures = $data[$ip]['failures'] + 1;
        }
    }
    $data[$ip] = ['last_attempt' => $now, 'failures' => $failures];
    // Clean old entries
    foreach ($data as $k => $v) {
        if ($now - $v['last_attempt'] >= 900) unset($data[$k]);
    }
    @file_put_contents($rateLimitFile, json_encode($data), LOCK_EX);
}

function recordSuccess($ip, $rateLimitFile) {
    if (!file_exists($rateLimitFile)) return;
    $raw = @file_get_contents($rateLimitFile);
    $data = json_decode($raw, true) ?: [];
    if (isset($data[$ip])) {
        unset($data[$ip]);
        @file_put_contents($rateLimitFile, json_encode($data), LOCK_EX);
    }
}

if (!file_exists($secretFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Admin secret configuration missing on server.']);
    exit;
}

$secrets = require $secretFile;
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: [];
$action = $input['action'] ?? $_GET['action'] ?? '';

// Issue HMAC Signed Token
function createToken($secrets) {
    $nonce = bin2hex(random_bytes(16));
    $exp = time() + 7200; // 2 hours valid
    $sig = hash_hmac('sha256', "$nonce:$exp", $secrets['signing_secret']);
    return base64_encode(json_encode(['nonce' => $nonce, 'exp' => $exp, 'sig' => $sig]));
}

// Verify HMAC Signed Token
function verifyToken($tokenString, $secrets) {
    if (!$tokenString) return false;
    $decoded = json_decode(base64_decode($tokenString), true);
    if (!$decoded || !isset($decoded['nonce'], $decoded['exp'], $decoded['sig'])) return false;
    if (time() > $decoded['exp']) return false;
    $expectedSig = hash_hmac('sha256', "{$decoded['nonce']}:{$decoded['exp']}", $secrets['signing_secret']);
    return hash_equals($expectedSig, $decoded['sig']);
}

// Action: GET Config (Public or Authenticated)
if ($action === 'get_config') {
    if (file_exists($configFile)) {
        $config = json_decode(file_get_contents($configFile), true) ?: [];
        echo json_encode(['success' => true, 'config' => $config]);
    } else {
        echo json_encode(['success' => true, 'config' => null]);
    }
    exit;
}

// Action: Auth
if ($action === 'auth') {
    if (!checkRateLimit($ip, $rateLimitFile)) {
        http_response_code(429);
        echo json_encode(['success' => false, 'error' => 'Too many failed login attempts. Try again in 15 minutes.']);
        exit;
    }

    $password = $input['password'] ?? '';
    $computedHash = hash('sha256', $secrets['salt'] . $password);

    if (hash_equals($secrets['password_hash'], $computedHash)) {
        recordSuccess($ip, $rateLimitFile);
        $token = createToken($secrets);
        echo json_encode([
            'success' => true,
            'token' => $token,
            'expiresAt' => (time() + 7200) * 1000,
            'isDefaultPassword' => ($computedHash === 'fc715e4c31d188b9574b4a60152dcfec5656c3ef997886545d9ab521aa30389d')
        ]);
    } else {
        recordFailure($ip, $rateLimitFile);
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid administrator passphrase.']);
    }
    exit;
}

// Protected Actions: Check Bearer Token
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$token = '';
if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
    $token = $matches[1];
} elseif (isset($input['token'])) {
    $token = $input['token'];
}

if (!verifyToken($token, $secrets)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized: Invalid or expired admin session token.']);
    exit;
}

// Action: Save Config
if ($action === 'save') {
    $newConfig = $input['config'] ?? null;
    if (!is_array($newConfig)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid configuration payload.']);
        exit;
    }

    // Sanitize and normalize schema
    $cleanConfig = [
        'version' => 1,
        'updatedAt' => round(microtime(true) * 1000),
        'profile' => [
            'displayName' => substr(strip_tags($newConfig['profile']['displayName'] ?? 'Guest Access'), 0, 80),
            'handle' => substr(strip_tags($newConfig['profile']['handle'] ?? 'bl4ut0'), 0, 40),
            'role' => substr(strip_tags($newConfig['profile']['role'] ?? 'Guest'), 0, 40),
            'accountType' => substr(strip_tags($newConfig['profile']['accountType'] ?? 'Public portfolio session'), 0, 60),
            'status' => substr(strip_tags($newConfig['profile']['status'] ?? 'Guest session'), 0, 60),
            'bio' => substr(strip_tags($newConfig['profile']['bio'] ?? ''), 0, 600),
            'avatar' => substr(strip_tags($newConfig['profile']['avatar'] ?? 'identity-portrait.jpg'), 0, 200),
            'accent' => preg_match('/^#[0-9a-fA-F]{6}$/', $newConfig['profile']['accent'] ?? '') ? $newConfig['profile']['accent'] : '#22d3ee',
            'links' => is_array($newConfig['profile']['links'] ?? null) ? array_map(function($l) {
                return [
                    'label' => substr(strip_tags($l['label'] ?? ''), 0, 40),
                    'url' => filter_var($l['url'] ?? '', FILTER_VALIDATE_URL) ? $l['url'] : '',
                    'icon' => substr(strip_tags($l['icon'] ?? 'fa-solid fa-link'), 0, 40)
                ];
            }, array_slice($newConfig['profile']['links'], 0, 10)) : []
        ],
        'boot' => [
            'eyebrow' => substr(strip_tags($newConfig['boot']['eyebrow'] ?? 'Personal Network Console'), 0, 80),
            'title' => substr(strip_tags($newConfig['boot']['title'] ?? 'PortfoliOS'), 0, 80),
            'summary' => substr(strip_tags($newConfig['boot']['summary'] ?? 'Development projects, infrastructure, community links, and professional systems work in one interactive hub.'), 0, 300)
        ],
        'appearance' => [
            'defaultTheme' => substr(strip_tags($newConfig['appearance']['defaultTheme'] ?? 'dark'), 0, 30),
            'defaultWallpaper' => substr(strip_tags($newConfig['appearance']['defaultWallpaper'] ?? 'aurora'), 0, 30),
            'defaultScreensaver' => substr(strip_tags($newConfig['appearance']['defaultScreensaver'] ?? 'starfield'), 0, 30)
        ],
        'guestHiddenAppIds' => is_array($newConfig['guestHiddenAppIds'] ?? null) 
            ? array_values(array_filter(array_map(function($id) {
                return preg_match('/^[a-z0-9-]+$/', $id) ? $id : null;
            }, $newConfig['guestHiddenAppIds'])))
            : []
    ];

    $saved = @file_put_contents($configFile, json_encode($cleanConfig, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
    if ($saved === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to write configuration to server storage.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Portfolio configuration successfully published to production server.',
        'config' => $cleanConfig
    ]);
    exit;
}

// Action: Change Admin Password
if ($action === 'change_password') {
    $newPassword = $input['new_password'] ?? '';
    if (strlen($newPassword) < 8) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'New passphrase must be at least 8 characters long.']);
        exit;
    }

    $newSalt = bin2hex(random_bytes(16));
    $newHash = hash('sha256', $newSalt . $newPassword);
    $newSigningSecret = bin2hex(random_bytes(32));

    $secretPhp = "<?php\n// PortfoliOS Admin Secret Store\nif (basename(\$_SERVER['SCRIPT_FILENAME'] ?? '') === 'admin-secret.php') {\n    http_response_code(403);\n    exit('Access Denied');\n}\n\nreturn [\n    'salt' => '{$newSalt}',\n    'password_hash' => '{$newHash}',\n    'signing_secret' => '{$newSigningSecret}'\n];\n";

    if (@file_put_contents($secretFile, $secretPhp, LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to persist new admin credentials.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Admin passphrase updated successfully.']);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Unknown action.']);
