<?php
/** Streaming transport. HTTP entry supplies only validated fixed-origin Drive URLs. */
function portfolios_drive_request(string $url, string $method, string $token, $stream, int $length, string $type, array $extraHeaders=[]): array {
    $headers=['Authorization: Bearer '.$token,'Content-Type: '.$type];
    foreach($extraHeaders as $label=>$value)$headers[]=$label.': '.$value;
    $location=null;$curl=curl_init($url);
    curl_setopt_array($curl,[CURLOPT_UPLOAD=>true,CURLOPT_INFILE=>$stream,CURLOPT_INFILESIZE=>$length,
        CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,
        CURLOPT_HEADERFUNCTION=>function($handle,$line)use(&$location){if(stripos($line,'Location:')===0)$location=trim(substr($line,9));return strlen($line);},
        CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>60,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_FOLLOWLOCATION=>false]);
    $body=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_HTTP_CODE);unset($curl);
    return ['body'=>$body,'status'=>$status,'location'=>$location];
}
