<?php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
require __DIR__ . '/hyperbeam-lib.php';
try {
    $config = hb_config();
    if (($_SERVER['CONTENT_LENGTH'] ?? 0) > 4096) hb_reply(['message' => 'Request too large.'], 413);
    $action = $_GET['action'] ?? '';
    $input = [];
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) hb_reply(['message' => 'Invalid request.'], 400);
        if ($action !== 'authorize') $action = $input['action'] ?? '';
    }
    if ($action === 'authorize') {
        $expected = 'Bearer ' . hash_hmac('sha256', 'portfolios-browser-webhook', $config['api_key']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !$config['api_key'] || !hash_equals($expected, $_SERVER['HTTP_AUTHORIZATION'] ?? '')) hb_reply(['authorized' => false], 403);
        $authorized = hb_authorize($config, $input, $_GET['lease'] ?? '');
        hb_reply(['authorized' => $authorized]);
    }
    session_name('portfolios_browser');
    session_start(['use_strict_mode' => 1, 'cookie_httponly' => true, 'cookie_samesite' => 'Strict', 'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'cookie_path' => '/apps/browser/']);
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    $csrf = $_SESSION['csrf']; $sessionId = session_id(); session_write_close();
    $enabled = $config['enabled'] === true && !empty($config['api_key']) && $config['free_only_confirmed'] === true && function_exists('curl_init');
    if ($action === 'status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        if (!$enabled) hb_reply(['available' => false, 'monitoringOk' => false, 'csrf' => $csrf, 'message' => 'Not configured · free proxy services are ready']);
        $budget = hb_with_ledger($config, function (&$ledger) use ($config) {
            hb_refresh_usage($config, $ledger);
            return ['monitoringOk' => true, 'mustEnd' => $ledger['provider_seconds'] >= min(540000, (int)$config['monthly_limit_seconds']), 'available' => hb_remaining($config, $ledger) >= 120, 'remainingSeconds' => hb_remaining($config, $ledger), 'usedSeconds' => $ledger['provider_seconds'], 'reservedSeconds' => $ledger['reserved'], 'period' => $ledger['month']];
        });
        $budget['csrf'] = $csrf;
        $budget['message'] = $budget['available'] ? 'Remote browsing available' : 'Shared allowance exhausted · choose a free proxy';
        hb_reply($budget);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !in_array($action, ['start', 'stop'], true)) hb_reply(['message' => 'Unsupported request.'], 405);
    if (($_SERVER['HTTP_ORIGIN'] ?? '') !== rtrim($config['origin'], '/') || !is_string($input['csrf'] ?? null) || !hash_equals($csrf, $input['csrf'])) hb_reply(['message' => 'Refresh the Browser app and try again.'], 403);
    if (!is_string($input['profile'] ?? null) || !preg_match('/^[a-z0-9_-]{1,100}$/i', $input['profile'])) hb_reply(['message' => 'Invalid profile.'], 400);
    if (!$enabled) hb_reply(['message' => 'Hyperbeam is not configured. Choose a free proxy service.'], 503);
    if ($action === 'start') hb_reply(hb_start($config, $input, $sessionId));
    $owner = hb_owner($config, $sessionId, $input['profile']);
    $result = hb_with_ledger($config, function (&$ledger) use ($config, $input, $owner) {
        $id = $input['lease'] ?? '';
        if (!is_string($id) || !isset($ledger['leases'][$id]) || !hash_equals($ledger['leases'][$id]['owner'], $owner)) return ['forbidden' => true];
        $lease = &$ledger['leases'][$id];
        if (!empty($lease['remote_id']) && empty($lease['ended'])) hb_call($config, 'DELETE', '/' . $lease['remote_id']);
        $lease['ended'] = true;
        unset($lease['response']);
        return ['ended' => true];
    });
    hb_reply($result, isset($result['forbidden']) ? 403 : 200);
} catch (InvalidArgumentException $error) {
    hb_reply(['message' => $error->getMessage()], 400);
} catch (Throwable $error) {
    // Provider payloads, credentials, cookies, destination URLs and ledger records are never logged.
    hb_reply(['message' => 'Remote browsing is unavailable or its allowance is reserved. Choose a free proxy service.'], 503);
}
