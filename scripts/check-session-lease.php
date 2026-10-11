<?php
require __DIR__.'/../core/session-lease-lib.php';
function check($condition,$message){if(!$condition)throw new RuntimeException($message);}
$s=portfolios_lease_step([],'claim','A',0,100);
check($s['active']['id']==='A','first owner');$epoch=$s['active']['epoch'];
$s=portfolios_lease_step($s,'claim','B',0,101);check($s['active']['id']==='A','cannot steal');
$s=portfolios_lease_step($s,'request','B',0,102);check(portfolios_lease_view($s,'A',102)['handoffRequested'],'request visible');
$s=portfolios_lease_step($s,'renew','A',$epoch,103);check($s['active']['id']==='A','renew retains pending owner');
$s=portfolios_lease_step($s,'release','A',$epoch,104,'snapshot123');check($s['active']['id']==='B' && $s['lastSnapshot']==='snapshot123','confirmed release transfers');
try{portfolios_lease_step($s,'release','A',$epoch,105);throw new LogicException('stale release accepted');}catch(RuntimeException $e){}
$s=portfolios_lease_step($s,'force','A',0,106);check($s['active']['id']==='A' && $s['active']['epoch']>$epoch,'forced epoch fenced');
$s=portfolios_lease_step($s,'assert','A',$epoch,107);check(!($s['active']['epoch']===$epoch),'old epoch never renews');
$s=portfolios_lease_step($s,'claim','B',0,1000);check($s['active']['id']==='A','expired does not imply safely saved');
$s=portfolios_lease_step($s,'force','B',0,1001);check(portfolios_lease_view($s,'B',1001)['owned'],'explicit force recovers expired owner');
$s=portfolios_lease_step($s,'request','C',0,1002);$s=portfolios_lease_step($s,'cancel','C',0,1003);check(!$s['pending'],'request cancellation');
echo "PASS: exclusive claims, handoff, epochs, expired ownership, forced takeover and cancellation.\n";
