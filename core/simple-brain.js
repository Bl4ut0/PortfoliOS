/**
 * PortfoliOS: SimpleBrain
 * Rule-based offline answering engine for basic questions.
 * Gracefully defaults to null to allow fallback routing.
 */
(function() {
    window.SimpleBrain = {
        query(rawQuery) {
            const query = (rawQuery || "").toLowerCase().trim();
            if (!query) return null;

            const isPrivate = (window.getCurrentUser ? window.getCurrentUser()?.id : window.state?.currentUserId) === "private";

            // Private checks
            if (isPrivate) {
                if (/(who|about|yourself)/.test(query)) {
                    return "I am a simulated assistant running inside a private PortfoliOS profile. Owner-specific identity and project links are hidden in this session.";
                }
                if (/(project|portfolio|built)/.test(query)) {
                    return "This private profile exposes only the shared desktop shell and available apps. Use `projects` or open the Store to see what is available here.";
                }
                if (/(contact|discord|github|email|phone)/.test(query)) {
                    return "Owner contact links are not exposed in private profile mode.";
                }
            }

            // Standard matches
            if (/(who|about|yourself|owner|alex|mammen)/.test(query)) {
                return "I am a simulated assistant built into **PortfoliOS**. I can tell you about Alex (Bl4ut0), an infrastructure operator and systems builder focused on connecting self-hosted tools and gaming ecosystems.";
            }
            if (/(project|portfolio|built|apps)/.test(query)) {
                return "There are several active nodes in the portfolio:\n**Bl4ut0.dev** - The main dev portal.\n**GuildCraft** - A gaming community platform.\n**DOOM Source** - An embedded WASM Doom engine.\nType `projects` or `status` to see standard system lists.";
            }
            if (/(skill|tech|stack|experience|code|language)/.test(query)) {
                return "Core skills include:\n- **Infrastructure**: Linux, Proxmox, Docker, Cloudflare\n- **Development**: Node.js, Lua (WoW), React, Python\n- **Operations**: Self-hosting, homelab automation, system administration";
            }
            if (/(contact|discord|github|link|social)/.test(query)) {
                return "You can find Alex on:\n- **GitHub**: github.com/Bl4ut0\n- **Discord**: discord.gg/fEwanmFR9m\nType `links` for a full directory.";
            }
            if (/(hello|hi|hey|greetings)/.test(query)) {
                return "Hello! I'm the PortfoliOS Assistant. How can I help you navigate the system today?";
            }
            if (/(doom|game|play|diablo|quake)/.test(query)) {
                return "Ah, games! You can play DOOM, Diablo, or Quake right here in the browser. Type `play doom` in the CLI or select a game from the desktop.";
            }
            if (/clear/.test(query)) {
                return "Type `clear` as a raw command to clear the terminal screen.";
            }
            if (/(joke|funny)/.test(query)) {
                return "Why do programmers prefer dark mode?\nBecause light attracts bugs.";
            }
            if (/(purpose|what is this|help|command)/.test(query)) {
                return "PortfoliOS is a personal browser-native OS showcasing Alex's work. Try typing standard system commands like `help`, `projects`, `status`, or `ls`.";
            }

            // Conversational fallback for unmatched queries
            if (query.includes("?") || /\b(what|how|why|who|where|can|tell|show|explain|help|info|status|do)\b/.test(query) || query.split(/\s+/).length > 1) {
                return "I'm a basic offline rule-based helper. I can answer questions about Alex's **profile**, **projects**, **skills**, **contacts**, or **games**.\n\nFor more complex or general questions, you can enable a higher-tier AI model in the AI app, or type `help` to see the list of valid CLI commands.";
            }

            // Return null if we don't know the answer
            return null;
        }
    };
})();
