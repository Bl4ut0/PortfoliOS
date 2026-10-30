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
$s=portfolios_lease_step($s,'claim','B',0,1000);check($s['active']['id']==='B','expired owner automatically cleaned up and claimed');
check(portfolios_lease_view($s,'B',1000)['owned'],'claimed session owns lease');
$s=portfolios_lease_step($s,'request','C',0,1002);$s=portfolios_lease_step($s,'cancel','C',0,1003);check(!$s['pending'],'request cancellation');
$resume=portfolios_lease_step([],'claim','reload-tab',0,100);
$old=$resume['active']['epoch'];
$resume=portfolios_lease_step($resume,'request','other-tab',0,299);
$resume=portfolios_lease_step($resume,'claim','reload-tab',0,300);
check(portfolios_lease_view($resume,'reload-tab',300)['owned'],'same tab resumes after lease expiry');
check($resume['active']['epoch']>$old,'expired resumption fences old requests');
check($resume['pending']['id']==='other-tab','resumption preserves waiting handoff');
$renewed=portfolios_lease_step($resume,'assert','reload-tab',$old,301);
check($renewed['active']['expires']===$resume['active']['expires'],'stale pre-refresh epoch cannot renew');
$resume=portfolios_lease_step($resume,'claim','other-tab',0,302);
check($resume['active']['id']==='reload-tab','different tab still cannot steal resumed lease');
echo "PASS: exclusive claims, handoff, epochs, expired ownership, forced takeover and cancellation.\n";
