<?php
// Exercise the production reservation logic against deterministic provider responses; no live minutes are consumed.
$source = file_get_contents(__DIR__ . '/../apps/browser/hyperbeam-lib.php');
eval(substr(str_replace('function hb_call(', 'function hb_live_call(', $source), 5));
$providerSeconds = 0; $providerCreates = 0; $providerFail = false; $providerPayloads = [];
function hb_call($config, $method, $route, $body = null) {
    global $providerSeconds, $providerCreates, $providerFail, $providerPayloads;
    if ($route === '/usage') return ['usage' => [['date' => gmdate('Y-m-01') . 'T00:00:00Z', 'seconds' => $providerSeconds]]];
    if ($method === 'POST') {
        $providerCreates++; $providerPayloads[] = $body;
        if ($providerFail) throw new RuntimeException('Simulated uncertain create');
        return ['session_id' => sprintf('00000000-0000-4000-8000-%012d', $providerCreates), 'embed_url' => 'https://fixture.hyperbeam.com/session?token=fixture', 'admin_token' => 'must-never-leave-the-server'];
    }
    return [];
}
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
function blocked($callback, $message) { try { $callback(); } catch (RuntimeException $error) { return; } throw new RuntimeException($message); }
if (($argv[1] ?? '') === '--worker') {
    $_SERVER['DOCUMENT_ROOT'] = realpath(__DIR__ . '/..');
    $workerConfig = ['ledger_path' => $argv[2]];
    for ($i = 0; $i < 15; $i++) hb_with_ledger($workerConfig, function (&$ledger) { $before = $ledger['reserved']; usleep(10000); $ledger['reserved'] = $before + 1; return null; });
    exit;
}
$dir = sys_get_temp_dir() . '/portfolios-browser-quota-' . bin2hex(random_bytes(6));
mkdir($dir, 0700, true);
$_SERVER['DOCUMENT_ROOT'] = realpath(__DIR__ . '/..'); $_SERVER['REMOTE_ADDR'] = '192.0.2.1';
$config = ['api_key' => 'fixture-only', 'origin' => 'https://example.test', 'ledger_path' => $dir . '/ledger.json', 'monthly_limit_seconds' => 300, 'session_seconds' => 120, 'max_concurrent' => 3, 'daily_sessions_per_ip' => 6];
$input = ['url' => 'https://example.com/', 'requestId' => '11111111-1111-4111-8111-111111111111', 'profile' => 'private_fixture'];
try {
    $first = hb_start($config, $input, 'cookie-one');
    check(!isset($first['admin_token']) && strpos(json_encode($first), 'must-never-leave') === false, 'Admin token leaked');
    check($providerCreates === 1, 'First allocation did not create one session');
    $authInput = ['user_id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'userdata' => ['leaseToken' => $first['leaseToken']]];
    check(hb_authorize($config, $authInput, $first['lease']) === true, 'Owner participant denied');
    check(hb_authorize($config, $authInput, $first['lease']) === true, 'Same participant reconnect denied');
    $otherParticipant = $authInput; $otherParticipant['user_id'] = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    check(hb_authorize($config, $otherParticipant, $first['lease']) === false, 'Second participant can multiply billable minutes');
    $badToken = $authInput; $badToken['userdata']['leaseToken'] = 'wrong';
    check(hb_authorize($config, $badToken, $first['lease']) === false, 'Invalid participant capability accepted');
    $same = hb_start($config, $input, 'cookie-one');
    check($same === $first && $providerCreates === 1, 'Retry created duplicate provider resources');
    check($providerPayloads[0]['timeout']['absolute'] === 120, 'Provider has no bounded lifetime');
    check($providerPayloads[0]['auth']['type'] === 'webhook' && $providerPayloads[0]['profile']['save'] === false, 'Participant isolation or disposable state missing');
    $input['requestId'] = '22222222-2222-4222-8222-222222222222';
    blocked(function () use ($config, $input) { hb_start($config, $input, 'cookie-one'); }, 'Same owner allocated overlapping sessions');
    $second = hb_start($config, $input, 'cookie-two');
    $ledger = json_decode(file_get_contents($config['ledger_path']), true);
    check($ledger['reserved'] === 300, 'Full duration plus overhead was not reserved');
    blocked(function () use ($config, $input) { hb_start($config, $input, 'cookie-three'); }, 'Global budget was overspent by another owner');
    check($providerCreates === 2, 'Rejected budget still created a provider session');
    hb_with_ledger($config, function (&$ledger) use ($first) { $ledger['leases'][$first['lease']]['ended'] = true; return null; });
    $ledger = json_decode(file_get_contents($config['ledger_path']), true);
    check($ledger['reserved'] === 300, 'Ended session refunded uncertain usage');
    check(hb_owner($config, 'cookie-one', 'private_fixture') !== hb_owner($config, 'cookie-one', 'bl4ut0'), 'Profiles share ownership');
    check(hb_owner($config, 'cookie-one', 'private_fixture') !== hb_owner($config, 'cookie-two', 'private_fixture'), 'Different browser cookies share ownership');
    check(hb_remaining(['monthly_limit_seconds' => 600], ['provider_seconds' => 300, 'baseline_seconds' => 0, 'reserved' => 300, 'leases' => []]) === 300, 'Completed allocations were counted twice');
    check(hb_remaining(['monthly_limit_seconds' => 600], ['provider_seconds' => 300, 'baseline_seconds' => 0, 'reserved' => 300, 'leases' => [['duration' => 120, 'expires_at' => time() + 60]]]) === 120, 'Outstanding sessions were not included beside reported usage');
    $config['ledger_path'] = $dir . '/failure.json'; $providerFail = true;
    blocked(function () use ($config, $input) { hb_start($config, $input, 'cookie-four'); }, 'Uncertain provider failure was accepted');
    $ledger = json_decode(file_get_contents($config['ledger_path']), true);
    check($ledger['reserved'] === 180, 'Uncertain provider failure lost its reservation');
    $config['ledger_path'] = $dir . '/corrupt.json'; file_put_contents($config['ledger_path'], '{broken');
    blocked(function () use ($config) { hb_with_ledger($config, function (&$ledger) { return true; }); }, 'Corrupt ledger did not fail closed');
    $config['ledger_path'] = $dir . '/empty.json'; file_put_contents($config['ledger_path'], '');
    blocked(function () use ($config) { hb_with_ledger($config, function (&$ledger) { return true; }); }, 'Empty damaged ledger did not fail closed');
    $config['ledger_path'] = $dir . '/usage.json'; $providerSeconds = 300; $providerFail = false;
    blocked(function () use ($config, $input) { hb_start($config, $input, 'cookie-five'); }, 'Existing provider usage was ignored');
    $config['ledger_path'] = $dir . '/rollover.json';
    file_put_contents($config['ledger_path'], json_encode(['month' => '2020-01', 'reserved' => 300, 'leases' => [], 'daily' => []]));
    hb_with_ledger($config, function (&$ledger) { check($ledger['month'] === gmdate('Y-m') && $ledger['reserved'] === 0, 'Month rollover did not reset expired allocations'); return null; });
    check(hb_remaining(['monthly_limit_seconds' => 99999999], ['provider_seconds' => 0, 'reserved' => 0]) === 540000, 'Safety cap can exceed 9000 minutes');
    $workers = [];
    for ($i = 0; $i < 3; $i++) $workers[] = proc_open([PHP_BINARY, __FILE__, '--worker', $dir . '/parallel.json'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    foreach ($workers as $worker) check(proc_close($worker) === 0, 'Concurrent ledger worker failed');
    $parallel = json_decode(file_get_contents($dir . '/parallel.json'), true);
    check($parallel['reserved'] === 45, 'Parallel workers lost budget reservations');
    echo "Browser quota checks passed: durable reservations, shared cap, retries, cookie/profile ownership, uncertain failures, provider limits, disposable sessions, and UTC rollover.\n";
} finally { foreach (glob($dir . '/*') as $file) unlink($file); rmdir($dir); }
