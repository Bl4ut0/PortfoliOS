/**
 * Example owner configuration for Music Mini.
 *
 * Copy the relevant values into data/config.js or inject window.musicMiniConfig
 * before apps/musicmini/app.js loads.
 *
 * Spotify uses browser-only Authorization Code + PKCE. Client IDs are public
 * OAuth identifiers, and this flow does not use a client secret. Apple Music
 * developer tokens should usually come from a small backend endpoint because
 * they are signed with your Apple private key.
 */
window.musicMiniConfig = {
    spotify: {
        clientId: "YOUR_SPOTIFY_CLIENT_ID",
        redirectUri: "https://os.bl4ut0.dev/",
        market: "US"
    },
    apple: {
        developerTokenEndpoint: "https://example.com/api/apple-music-token"
    }
};
