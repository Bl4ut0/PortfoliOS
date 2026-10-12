<?php
/** Pure state machine; caller supplies authenticated account and serializes with flock. */
function portfolios_lease_step(array $s, string $action, string $id, int $epoch, int $now, ?string $snapshot = null): array {
    $s += ['generation'=>0, 'active'=>null, 'pending'=>null, 'lastSnapshot'=>null];
    if ($s['pending'] && $s['pending']['expires'] <= $now) $s['pending'] = null;
    $active = $s['active'];
    $mine = $active && $active['id'] === $id && $active['epoch'] === $epoch && $active['expires'] > $now;
    if ($action === 'claim' || $action === 'force') {
        if ($active && $active['id'] === $id && $action !== 'force') {
            // Resuming the same tab is not a takeover. Fence its old requests if
            // the lease expired, and preserve any legitimate waiting handoff.
            if ($active['expires'] <= $now) {
                $s['generation']++;
                $s['active']['epoch'] = $s['generation'];
            }
            $s['active']['expires'] = $now + 180;
        } elseif (!$active || $action === 'force') {
            $s['generation']++;
            $s['active'] = ['id'=>$id, 'epoch'=>$s['generation'], 'expires'=>$now+180];
            $s['pending'] = null;
        }
        // Expired owners still require explicit force: silence is not a confirmed save.
    } elseif ($action === 'request') {
        if (!$active) return portfolios_lease_step($s, 'claim', $id, 0, $now);
        if ($active['id'] !== $id && (!$s['pending'] || $s['pending']['id'] === $id))
            $s['pending'] = ['id'=>$id, 'requested'=>$now, 'expires'=>$now+300];
    } elseif ($action === 'cancel') {
        if (($s['pending']['id'] ?? null) === $id) $s['pending'] = null;
    } elseif ($action === 'renew' || $action === 'assert') {
        if ($mine) $s['active']['expires'] = $now+180;
    } elseif ($action === 'release') {
        if (!$mine) throw new RuntimeException('Session ownership was lost.');
        if ($snapshot !== null) $s['lastSnapshot'] = $snapshot;
        $next = $s['pending'];
        $s['active'] = null; $s['pending'] = null;
        if ($next) {
            $s['generation']++;
            $s['active'] = ['id'=>$next['id'], 'epoch'=>$s['generation'], 'expires'=>$now+180];
        }
    }
    return $s;
}
function portfolios_lease_view(array $s, string $id, int $now): array {
    $a=$s['active'];
    return ['owned'=>!!$a && $a['id']===$id && $a['expires']>$now,
        'epoch'=>$a && $a['id']===$id ? $a['epoch'] : null,
        'expires'=>$a['expires'] ?? null, 'occupied'=>!!$a,
        'handoffRequested'=>!!$s['pending'] && ($a['id'] ?? null)===$id,
        'waiting'=>($s['pending']['id'] ?? null)===$id,
        'lastSnapshot'=>$s['lastSnapshot']];
}

/** Atomic state replacement while a separate stable account lock is held. */
function portfolios_lease_store(string $file, array $state): void {
    $temp=$file.'.'.bin2hex(random_bytes(8)).'.tmp';
    $handle=fopen($temp,'x');
    if(!$handle)throw new RuntimeException('Session state storage unavailable.');
    try {
        chmod($temp,0600);
        $json=json_encode($state,JSON_THROW_ON_ERROR);
        if(fwrite($handle,$json)!==strlen($json) || !fflush($handle))throw new RuntimeException('Session state write failed.');
        if(function_exists('fsync') && !fsync($handle))throw new RuntimeException('Session state flush failed.');
        fclose($handle);$handle=null;
        if(!rename($temp,$file))throw new RuntimeException('Session state commit failed.');
    }finally{if($handle)fclose($handle);if(is_file($temp))unlink($temp);}
}
