<?php
/** Streaming transport. HTTP entry supplies only validated fixed-origin Drive URLs. */
function portfolios_drive_request(string $url, string $method, string $token, $streamOrBody, int $length, string $type, array $extraHeaders=[]): array {
    $body = is_resource($streamOrBody) ? stream_get_contents($streamOrBody) : (string)$streamOrBody;
    $actualLength = strlen($body);
    $headers=['Authorization: Bearer '.$token,'Content-Type: '.$type,'Expect:'];
    if ($actualLength > 0 || in_array($method, ['POST', 'PUT', 'PATCH'], true)) $headers[] = 'Content-Length: ' . $actualLength;
    foreach($extraHeaders as $label=>$value)$headers[]=$label.': '.$value;
    $location=null;$curl=curl_init($url);
    $curlOpts = [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HEADERFUNCTION => function($handle, $line) use (&$location) {
            if (stripos($line, 'Location:') === 0) $location = trim(substr($line, 9));
            return strlen($line);
        },
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_FOLLOWLOCATION => false
    ];
    curl_setopt_array($curl, $curlOpts);
    $response=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);unset($curl);
    return ['body'=>$response,'status'=>$status,'location'=>$location];
}
