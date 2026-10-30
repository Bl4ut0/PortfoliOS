<?php
/** Streaming transport. HTTP entry supplies only validated fixed-origin Drive URLs. */
function portfolios_drive_request(string $url, string $method, string $token, $stream, int $length, string $type, array $extraHeaders=[]): array {
    $headers=['Authorization: Bearer '.$token,'Content-Type: '.$type];
    foreach($extraHeaders as $label=>$value)$headers[]=$label.': '.$value;
    $location=null;$curl=curl_init($url);
    $curlOpts = [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_HEADERFUNCTION => function($handle, $line) use (&$location) {
            if (stripos($line, 'Location:') === 0) $location = trim(substr($line, 9));
            return strlen($line);
        },
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_FOLLOWLOCATION => false
    ];
    if ($method === 'PUT' || $method === 'POST') {
        $curlOpts[CURLOPT_UPLOAD] = true;
        $curlOpts[CURLOPT_INFILE] = $stream;
        $curlOpts[CURLOPT_INFILESIZE] = $length;
    }
    curl_setopt_array($curl, $curlOpts);
    $body=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);unset($curl);
    return ['body'=>$body,'status'=>$status,'location'=>$location];
}
