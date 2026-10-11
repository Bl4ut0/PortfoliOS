<?php
/** Authenticated session coordinator and serialized Drive mutation gateway. */
require_once __DIR__.'/session-lease-lib.php';
require_once __DIR__.'/session-drive-lib.php';
header('Content-Type: application/json'); header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function lease_error(int $status, string $message): never {
    http_response_code($status); echo json_encode(['error'=>$message]); exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') lease_error(405, 'POST required.');
$origin = parse_url($_SERVER['HTTP_ORIGIN'] ?? '');
$host = strtolower($_SERVER['HTTP_HOST'] ?? '');
$originHost = strtolower(($origin['host'] ?? '').(isset($origin['port']) ? ':'.$origin['port'] : ''));
if (!$originHost || $originHost !== $host || !in_array($origin['scheme'] ?? '', ['https','http'], true)) lease_error(403, 'Same-origin request required.');
if (($origin['scheme'] ?? '')!=='https' && !preg_match('/^(localhost|127\.0\.0\.1)(:[0-9]+)?$/D',$host)) lease_error(403,'HTTPS required.');
if (!function_exists('curl_init')) lease_error(503, 'Session coordination requires server cURL support.');
$headers=function_exists('getallheaders') ? array_change_key_case(getallheaders(),CASE_LOWER) : [];
$authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? $headers['authorization'] ?? '';
if (!preg_match('/^Bearer ([A-Za-z0-9._~+\/-]{16,4096})$/D', $authorization, $match)) lease_error(401, 'Google sign-in required.');
$token = $match[1];
// Private server metadata contains no bearer credentials or document contents.
$dir=getenv('PORTFOLIOS_SESSION_DIR') ?: dirname(__DIR__,2).'/.portfolios-private-sessions-'.substr(hash('sha256',__DIR__),0,20);
if (!is_dir($dir) && !mkdir($dir,0700,true) && !is_dir($dir)) lease_error(503,'Session storage unavailable.');
// Brief verification cache avoids a Google identity roundtrip per uploaded file.
// Cache keys are irreversible token hashes; revocation may take at most 30 seconds.
$cacheFile=$dir.'/auth-'.hash('sha256',$token).'.json';
$identity=is_file($cacheFile) ? json_decode(file_get_contents($cacheFile),true) : null;
if (!$identity || ($identity['verifiedUntil'] ?? 0)<=time()) {
    $curl=curl_init('https://openidconnect.googleapis.com/v1/userinfo');
    curl_setopt_array($curl,[CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$token],CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_FOLLOWLOCATION=>false]);
    $identityBody=curl_exec($curl);$identityStatus=curl_getinfo($curl,CURLINFO_HTTP_CODE);unset($curl);
    $identity=is_string($identityBody) ? json_decode($identityBody,true) : null;
    if ($identityStatus===0 || $identityStatus>=500) lease_error(503,'Google session verification is temporarily unavailable. Local data is retained.');
    if ($identityStatus!==200 || !preg_match('/^[A-Za-z0-9_-]{1,128}$/D',$identity['sub'] ?? '')) lease_error(401,'Google identity could not be verified. Reconnect and retry.');
    $identity=['sub'=>$identity['sub'],'verifiedUntil'=>time()+30];
    file_put_contents($cacheFile,json_encode($identity),LOCK_EX);chmod($cacheFile,0600);
}
$id=$_SERVER['HTTP_X_PORTFOLIOS_SESSION'] ?? '';
$epoch=(int)($_SERVER['HTTP_X_PORTFOLIOS_EPOCH'] ?? 0);
if (!preg_match('/^[a-f0-9-]{36}$/D',$id)) lease_error(400,'Invalid session identifier.');
$action=$_GET['action'] ?? '';
if (!in_array($action,['claim','request','force','cancel','renew','assert','release','drive'],true)) lease_error(400,'Invalid session action.');
// Each verified account has one serialized ownership record outside the served tree.
$file=$dir.'/'.hash('sha256',$identity['sub']).'.json';
$handle=fopen($file.'.lock','c+');
if (!$handle || !flock($handle,LOCK_EX)) lease_error(503,'Session lock unavailable.');
try {
    $s=is_file($file) ? json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR) : ['generation'=>0,'active'=>null,'pending'=>null,'lastSnapshot'=>null];
    $now=time();
    if ($action==='drive') {
        $view=portfolios_lease_view($s,$id,$now);
        if (!$view['owned'] || $view['epoch']!==$epoch) lease_error(409,'This workspace no longer owns the active session.');
        $method=$_SERVER['HTTP_X_DRIVE_METHOD'] ?? '';
        $target=$_SERVER['HTTP_X_DRIVE_PATH'] ?? '';
        $targetParts=parse_url($target);$params=[];parse_str($targetParts['query'] ?? '',$params);
        if (!in_array($method,['POST','PATCH','PUT','DELETE'],true) || isset($targetParts['host']) || !preg_match('~^/(?:upload/)?drive/v3/files(?:/[A-Za-z0-9_-]+)?$~D',$targetParts['path'] ?? '') || array_diff(array_keys($params),['uploadType','fields','upload_id']) || isset($params['uploadType']) && !in_array($params['uploadType'],['multipart','media','resumable'],true) || isset($params['fields']) && $params['fields']!=='id,version' || isset($params['upload_id']) && !preg_match('/^[A-Za-z0-9._~%-]{10,2048}$/D',$params['upload_id'])) lease_error(400,'Unsupported Drive operation.');
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0)>268435456) lease_error(413,'Drive upload exceeds the 256 MiB gateway limit.');
        $length=(int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        $stream=fopen('php://input','rb');
        if (!$stream) lease_error(503,'Drive upload stream unavailable.');
        $type=$_SERVER['CONTENT_TYPE'] ?? 'application/octet-stream';
        if (strpbrk($type,"\r\n")!==false) lease_error(400,'Invalid content type.');
        $upstreamHeaders=[];
        foreach(['HTTP_CONTENT_RANGE'=>'Content-Range','HTTP_X_UPLOAD_CONTENT_TYPE'=>'X-Upload-Content-Type','HTTP_X_UPLOAD_CONTENT_LENGTH'=>'X-Upload-Content-Length'] as $key=>$label) {
            if(isset($_SERVER[$key])) {if(strpbrk($_SERVER[$key],"\r\n")!==false)lease_error(400,'Invalid upload header.');$upstreamHeaders[$label]=$_SERVER[$key];}
        }
        $result=portfolios_drive_request('https://www.googleapis.com'.$target,$method,$token,$stream,$length,$type,$upstreamHeaders);
        fclose($stream);$response=$result['body'];$status=$result['status'];$location=$result['location'];
        // Ownership cannot transfer while the upstream mutation is in progress.
        $s['active']['expires']=time()+180;
        portfolios_lease_store($file,$s);
        if ($response===false || !$status) lease_error(502,'Drive request outcome is uncertain. Retry sync to reconcile; do not assume it failed.');
        if($location && str_starts_with($location,'https://www.googleapis.com/upload/drive/v3/files'))header('X-Drive-Upload-Location: '.$location);
        http_response_code($status); echo $response; exit;
    }
    $body=json_decode(file_get_contents('php://input'),true) ?: [];
    $snapshot=$body['snapshot'] ?? null;
    if ($snapshot!==null && !preg_match('/^[A-Za-z0-9_-]{1,160}$/D',$snapshot)) lease_error(400,'Invalid snapshot reference.');
    if ($action==='release' && $s['pending'] && ($body['synced'] ?? false)!==true) lease_error(409,'Finish saving to Drive before handing this workspace to the waiting session.');
    $s=portfolios_lease_step($s,$action,$id,$epoch,$now,$snapshot);
    portfolios_lease_store($file,$s);
    echo json_encode(portfolios_lease_view($s,$id,time()),JSON_THROW_ON_ERROR);
} catch (Throwable $error) { lease_error(503,'Session coordination unavailable. Your local files are retained.'); }
finally { flock($handle,LOCK_UN); fclose($handle); }
