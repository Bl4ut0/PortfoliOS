<?php
/** Hyperbeam control plane only. Never forwards arbitrary browsing traffic. */
function hb_config() {
    $docroot = realpath($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 2));
    $privateDir = dirname($docroot) . '/portfolios-private';
    $configPath = getenv('PORTFOLIOS_HYPERBEAM_CONFIG') ?: $privateDir . '/hyperbeam.php';
    $extra = [];
    if (is_file($configPath)) {
        $real = realpath($configPath);
        if (!$real || strpos(str_replace('\\', '/', $real), str_replace('\\', '/', $docroot) . '/') === 0) throw new RuntimeException('Configuration must be outside the public site.');
        $extra = require $real;
        if (!is_array($extra)) throw new RuntimeException('Invalid configuration.');
    }
    return array_merge([
        'enabled' => getenv('HYPERBEAM_ENABLED') === 'true',
        'api_key' => getenv('HYPERBEAM_API_KEY') ?: '',
        // Set only after confirming this account's allowance and disabled paid overages.
        'free_only_confirmed' => getenv('HYPERBEAM_FREE_ONLY_CONFIRMED') === 'true',
        'origin' => 'https://os.bl4ut0.dev',
        'ledger_path' => $privateDir . '/hyperbeam-ledger.json',
        'monthly_limit_seconds' => 9000 * 60,
        'session_seconds' => 20 * 60,
        'max_concurrent' => 3,
        'daily_sessions_per_ip' => 6
    ], $extra);
}
function hb_reply($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}
function hb_call($config, $method, $route, $body = null) {
    if (!function_exists('curl_init')) throw new RuntimeException('Remote browsing is unavailable on this host.');
    $curl = curl_init('https://engine.hyperbeam.com/v0/vm' . $route);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $config['api_key'], 'Content-Type: application/json'],
        CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 15, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS]);
    if ($body !== null) curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($curl);
    $code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($method === 'DELETE' && ($code === 404 || ($code >= 200 && $code < 300))) return [];
    if ($raw === false || $code < 200 || $code >= 300) throw new RuntimeException('Hyperbeam could not be reached. Choose a free proxy service.');
    $data = json_decode($raw, true);
    if (!is_array($data)) throw new RuntimeException('Hyperbeam returned an invalid response.');
    return $data;
}
function hb_provider_seconds($config, $month) {
    $data = hb_call($config, 'GET', '/usage');
    if (!isset($data['usage']) || !is_array($data['usage'])) throw new RuntimeException('Usage could not be verified.');
    $seconds = 0;
    foreach ($data['usage'] as $row) {
        if (!is_array($row) || !isset($row['date'], $row['seconds']) || !is_numeric($row['seconds']) || $row['seconds'] < 0) throw new RuntimeException('Usage could not be verified.');
        $stamp = strtotime($row['date']);
        if ($stamp === false) throw new RuntimeException('Usage could not be verified.');
        if (gmdate('Y-m', $stamp) === $month) $seconds += (int)ceil($row['seconds']);
    }
    return $seconds;
}
function hb_with_ledger($config, $callback) {
    $ledgerPath = $config['ledger_path'];
    $dir = dirname($ledgerPath);
    $root = str_replace('\\', '/', realpath($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 2)));
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) throw new RuntimeException('Usage storage is unavailable.');
    $resolved = str_replace('\\', '/', realpath($dir));
    if ($resolved === $root || strpos($resolved, $root . '/') === 0) throw new RuntimeException('Usage storage must be outside the public site.');
    // Lock a separate stable file so atomic ledger replacement cannot break mutual exclusion.
    $handle = fopen($ledgerPath . '.lock', 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) throw new RuntimeException('Usage storage is unavailable.');
    @chmod($ledgerPath . '.lock', 0600);
    $temporary = null;
    try {
        $exists = is_file($ledgerPath);
        $raw = $exists ? file_get_contents($ledgerPath) : null;
        $ledger = $exists ? json_decode($raw, true) : null;
        if ($exists && (!is_array($ledger) || !isset($ledger['month'], $ledger['reserved'], $ledger['leases'], $ledger['daily']) || !preg_match('/^\d{4}-\d{2}$/', $ledger['month']) || !is_array($ledger['leases']) || !is_array($ledger['daily']) || !is_numeric($ledger['reserved']) || $ledger['reserved'] < 0)) throw new RuntimeException('Usage storage needs administrator attention.');
        $month = gmdate('Y-m');
        if (!$exists || $ledger['month'] !== $month) $ledger = ['month' => $month, 'reserved' => 0, 'leases' => [], 'daily' => [], 'provider_seconds' => 0, 'baseline_seconds' => null, 'checked_at' => 0];
        $result = $callback($ledger);
        $json = json_encode($ledger);
        $temporary = tempnam($dir, 'hb-ledger-');
        if ($json === false || $temporary === false) throw new RuntimeException('Usage storage could not be committed.');
        @chmod($temporary, 0600);
        $output = fopen($temporary, 'wb');
        if (!$output) throw new RuntimeException('Usage storage could not be committed.');
        try {
            if (fwrite($output, $json) !== strlen($json) || !fflush($output)) throw new RuntimeException('Usage storage could not be committed.');
            if (function_exists('fsync') && !fsync($output)) throw new RuntimeException('Usage storage could not be committed.');
        } finally { fclose($output); }
        if (!rename($temporary, $ledgerPath)) throw new RuntimeException('Usage storage could not be committed.');
        $temporary = null;
        return $result;
    } finally {
        if ($temporary && is_file($temporary)) unlink($temporary);
        flock($handle, LOCK_UN); fclose($handle);
    }
}
function hb_refresh_usage($config, &$ledger, $force = false) {
    if ($force || time() - ($ledger['checked_at'] ?? 0) >= 30) {
        $ledger['provider_seconds'] = max((int)($ledger['provider_seconds'] ?? 0), hb_provider_seconds($config, $ledger['month']));
        if (!isset($ledger['baseline_seconds'])) $ledger['baseline_seconds'] = $ledger['provider_seconds'];
        $ledger['checked_at'] = time();
    }
}
function hb_remaining($config, $ledger) {
    $outstanding = 0;
    foreach (($ledger['leases'] ?? []) as $lease) {
        if (empty($lease['ended']) && ($lease['expires_at'] ?? 0) > time()) $outstanding += (int)$lease['duration'] + 60;
    }
    // Never refund committed allocations. Do not double-charge completed allocations already in provider totals.
    $committed = (int)($ledger['baseline_seconds'] ?? 0) + (int)$ledger['reserved'];
    $reportedAndOutstanding = (int)$ledger['provider_seconds'] + $outstanding;
    return max(0, min(540000, (int)$config['monthly_limit_seconds']) - max($committed, $reportedAndOutstanding));
}
function hb_owner($config, $sessionId, $profile) {
    return hash_hmac('sha256', $sessionId . ':' . $profile, $config['api_key']);
}
function hb_start($config, $input, $sessionId) {
    $url = $input['url'] ?? '';
    $parts = is_string($url) ? parse_url($url) : false;
    if (!$parts || strlen($url) > 2048 || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) throw new InvalidArgumentException('Enter a valid HTTP or HTTPS website address.');
    $requestId = $input['requestId'] ?? '';
    if (!is_string($requestId) || !preg_match('/^[a-f0-9-]{36}$/i', $requestId)) throw new InvalidArgumentException('Invalid session request.');
    $profile = $input['profile'];
    $owner = hb_owner($config, $sessionId, $profile);
    $ipKey = hash_hmac('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), $config['api_key']);
    $leaseId = bin2hex(random_bytes(24));
    $leaseToken = bin2hex(random_bytes(32));
    // Reserve durably BEFORE the external session request, including uncertain network outcomes.
    $reservation = hb_with_ledger($config, function (&$ledger) use ($config, $owner, $ipKey, $requestId, $leaseId, $leaseToken) {
        hb_refresh_usage($config, $ledger, true);
        $active = 0;
        foreach ($ledger['leases'] as $id => $lease) {
            if (($lease['expires_at'] ?? 0) <= time() || !empty($lease['ended'])) continue;
            $active++;
            if ($lease['owner'] === $owner) {
                if ($lease['request_id'] === $requestId && isset($lease['response'])) return ['existing' => $lease['response']];
                throw new RuntimeException('A remote browser is already running for this profile. End it first.');
            }
        }
        if ($active >= min(8, max(1, (int)$config['max_concurrent']))) throw new RuntimeException('All remote browser slots are busy. Choose a free proxy service.');
        $day = gmdate('Y-m-d');
        if (($ledger['daily'][$day][$ipKey] ?? 0) >= max(1, (int)$config['daily_sessions_per_ip'])) throw new RuntimeException('Today’s remote browser allowance for this connection is reached. Choose a free proxy service.');
        $secondsToMonthEnd = strtotime(gmdate('Y-m-01') . ' +1 month UTC') - time() - 60;
        $duration = min(1800, max(60, (int)$config['session_seconds']), hb_remaining($config, $ledger) - 60, $secondsToMonthEnd);
        if ($duration < 60) throw new RuntimeException('The shared remote browser allowance is exhausted. Choose a free proxy service.');
        $lease = ['owner' => $owner, 'request_id' => $requestId, 'token_hash' => hash('sha256', $leaseToken), 'expires_at' => time() + $duration + 30, 'duration' => $duration, 'user_id' => null];
        $ledger['reserved'] += $duration + 60;
        $ledger['leases'][$leaseId] = $lease;
        $ledger['daily'][$day][$ipKey] = ($ledger['daily'][$day][$ipKey] ?? 0) + 1;
        return $lease;
    });
    if (isset($reservation['existing'])) return $reservation['existing'];
    $webhookBearer = hash_hmac('sha256', 'portfolios-browser-webhook', $config['api_key']);
    $body = [
        'start_url' => $url, 'kiosk' => false, 'tag' => 'portfolios-' . $leaseId,
        'timeout' => ['absolute' => $reservation['duration'], 'inactive' => 180, 'offline' => 65, 'warning' => 60],
        'auth' => ['type' => 'webhook', 'value' => ['url' => rtrim($config['origin'], '/') . '/apps/browser/hyperbeam.php?action=authorize&lease=' . $leaseId, 'bearer' => $webhookBearer]],
        'profile' => ['save' => false], 'adblock' => true,
        'width' => !empty($input['mobile']) ? 720 : 1280, 'height' => !empty($input['mobile']) ? 1280 : 720
    ];
    if (!empty($input['mobile'])) $body['user_agent'] = 'chrome_android';
    $remote = hb_call($config, 'POST', '', $body);
    $remoteId = $remote['session_id'] ?? '';
    $embedUrl = $remote['embed_url'] ?? '';
    $embedParts = is_string($embedUrl) ? parse_url($embedUrl) : false;
    if (!preg_match('/^[a-f0-9-]{36}$/i', $remoteId) || !$embedParts || ($embedParts['scheme'] ?? '') !== 'https' || !preg_match('/\.hyperbeam\.com$/i', $embedParts['host'] ?? '') || isset($embedParts['user']) || isset($embedParts['pass'])) throw new RuntimeException('Remote session could not be verified.');
    $response = ['lease' => $leaseId, 'leaseToken' => $leaseToken, 'embedUrl' => $embedUrl, 'expiresAt' => time() + $reservation['duration']];
    hb_with_ledger($config, function (&$ledger) use ($leaseId, $remoteId, $response) {
        if (!isset($ledger['leases'][$leaseId])) throw new RuntimeException('The accounting period changed. Please try again.');
        $ledger['leases'][$leaseId]['remote_id'] = $remoteId;
        $ledger['leases'][$leaseId]['response'] = $response;
        return null;
    });
    // Never send the remote admin token: it could be used to extend provider-enforced timeouts.
    return $response;
}

function hb_authorize($config, $input, $id) {
    if (!is_string($id)) return false;
    return hb_with_ledger($config, function (&$ledger) use ($input, $id) {
        if (!isset($ledger['leases'][$id])) return false;
        $lease = &$ledger['leases'][$id];
        $token = $input['userdata']['leaseToken'] ?? '';
        $userId = $input['user_id'] ?? '';
        if (!is_string($token) || !is_string($userId) || !preg_match('/^[a-f0-9-]{36}$/i', $userId) || !hash_equals($lease['token_hash'], hash('sha256', $token)) || $lease['expires_at'] <= time() || !empty($lease['ended'])) return false;
        if ($lease['user_id'] !== null && $lease['user_id'] !== $userId) return false;
        $lease['user_id'] = $userId;
        return true;
    });
}
