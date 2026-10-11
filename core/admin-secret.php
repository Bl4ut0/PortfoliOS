<?php
// PortfoliOS Admin Secret Store
// Direct web requests are forbidden.
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'admin-secret.php') {
    http_response_code(403);
    exit('Access Denied');
}

return [
    'salt' => '15263aeb4d538c1fd240d0cc4f3bd582',
    'password_hash' => 'fc715e4c31d188b9574b4a60152dcfec5656c3ef997886545d9ab521aa30389d', // default: bl4ut0-admin
    'signing_secret' => '56ce78d9bb78ff542b7d860c2348c08e5a8226711496ba09d55a2b1a4884aab5'
];
