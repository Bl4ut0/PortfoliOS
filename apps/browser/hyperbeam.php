<?php
// Hosted sessions are disabled by the Native Relay / browser sandbox policy.
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
http_response_code(410);
echo json_encode(['available'=>false,'message'=>'Hosted browser sessions are disabled. Install the local Native Relay.']);
