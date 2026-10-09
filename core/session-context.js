/** Token-free live workspace facts shared by Lobe, CLI and the offline helper. */
(function () {
    window.getAssistantSessionInfo = () => {
        const id = window.state?.currentUserId;
        const privateProfile = id === 'private' || /^private_[a-zA-Z0-9_-]+$/.test(id || '');
        const known = privateProfile || id === 'bl4ut0';
        const sync = window.GDriveSync;
        const connected = privateProfile && !!sync?.getToken?.() && (!sync.tokenUserId || sync.tokenUserId === id);
        return { profile: privateProfile ? 'private' : id === 'bl4ut0' ? 'public' : 'unknown', known, driveConnected: connected };
    };
    window.getAssistantSessionStatus = () => {
        const session = window.getAssistantSessionInfo();
        if (!session.known) return 'The active workspace is not available yet.';
        if (session.profile === 'public') return "You're using Bl4ut0's public profile. This workspace resets on reload; no sign-in is required.";
        return session.driveConnected
            ? 'Your private profile is active. Google Drive backup is connected.'
            : 'Your private profile is active. Google Drive backup is paused; reconnect only to resume backup. Your local files and preferences remain available.';
    };
    window.getAssistantSessionContext = () => [
        '### LIVE WORKSPACE STATUS (application facts for this request) ###',
        window.getAssistantSessionStatus(),
        'Private profile selection and Google Drive authorization are different states. An expired Drive token does not sign the user out of their private workspace.',
        'Do not ask an active private-profile user to sign in to access their profile, local files or preferences. Mention reconnecting Google only for paused Drive backup.',
        'The public profile needs no sign-in. Offer Google sign-in only when the user wants a private workspace or Drive backup.',
        'Use these current facts instead of inferring authentication from a shell username or the public portfolio biography.',
        'Never request passwords or access tokens in chat. Do not invent personal data or file access.',
        '##############################################################'
    ].join('\n');
    window.getAssistantSessionAnswer = raw => {
        const question = String(raw || '').replace(/^The user entered this PortfoliOS CLI input:\s*/i, '').trim().toLowerCase().replace(/[?!.,]+$/g, '');
        const greeting = /^(?:hi|hello|hey|greetings)(?:\s+(?:lobe|assistant))?$/.test(question);
        const sessionQuestion = /^(?:am i (?:already )?(?:signed|logged) in|(?:what|which) (?:account|profile|session) (?:am i (?:in|using)|is (?:active|this))|(?:what is|what's) my (?:login|session|sign-in) status|(?:show |check )?(?:my )?(?:login|session|sign-in) status|(?:is|am i in) (?:my |a |the )?private (?:profile|session)(?: active)?)$/.test(question);
        if (!greeting && !sessionQuestion) return null;
        return (greeting ? "Hi, I'm Lobe. " : '') + window.getAssistantSessionStatus();
    };
})();
