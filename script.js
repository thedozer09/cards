
const MAINTENANCE_ALERT_CONFIG = {
    enabled: true, 
    text: "Scheduled Maintenance: Storm Cards is under maintenance and development until further notice."
};

function updateMaintenanceAlertBanner() {
    let banner = document.getElementById('scheduledMaintenanceAlert');

    if (!MAINTENANCE_ALERT_CONFIG.enabled) {
        if (banner) {
            banner.remove();
        }
        return;
    }

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'scheduledMaintenanceAlert';
        banner.className = 'scheduledMaintenanceAlert';
        document.body.appendChild(banner);
    }

    banner.innerHTML = `
        <span class="mAlertIcon">⚠️</span>
        <span class="mAlertText">${MAINTENANCE_ALERT_CONFIG.text}</span>
    `;
}

const screen1 = document.getElementById('screen1');  
const screen2 = document.getElementById('screen2');  
const testButton = document.getElementById('testButton');
 
const rngButton = document.getElementById('rngButton');  
const errorMessage = document.getElementById('errorMessage');  
const activityMusic = document.getElementById('activityMusic'); 
const musicToggleButton = document.getElementById('musicToggleButton');  
const tosGate = document.getElementById('tosGate');
const tosAgreeButton = document.getElementById('tosAgreeButton');
const discoverSound = document.getElementById('discoversound');
const DISCORD_CLIENT_ID = "1371190489629593750";

let tosTimeoutTimer = null;
let isTosTimedOut = false;
const TOS_TIMEOUT_DURATION = 30000; // 30 seconds

function setOAuthStatus(text) {
    let badge = document.getElementById('oauthStatusBadge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'oauthStatusBadge';
        badge.style.position = 'fixed';
        badge.style.top = '20px';
        badge.style.left = '50%';
        badge.style.transform = 'translateX(-50%)';
        badge.style.zIndex = '999999';
        badge.style.padding = '10px 22px';
        badge.style.background = 'rgba(10, 22, 36, 0.94)';
        badge.style.border = '1.5px solid #38bdf8';
        badge.style.borderRadius = '999px';
        badge.style.color = '#38bdf8';
        badge.style.fontSize = '14px';
        badge.style.fontWeight = '800';
        badge.style.letterSpacing = '0.5px';
        badge.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.5)';
        badge.style.pointerEvents = 'none';
        document.body.appendChild(badge);
    }
    badge.textContent = `⏳ ${text}`;
    badge.classList.remove('hidden');

    const loading = document.getElementById('loadingScreen');
    if (loading && !loading.classList.contains('hidden')) {
        const heading = loading.querySelector('h1');
        if (heading) {
            heading.dataset.prevText = heading.dataset.prevText || heading.textContent;
            heading.textContent = text;
        }
    }
}

function clearOAuthStatus() {
    const badge = document.getElementById('oauthStatusBadge');
    if (badge) {
        badge.remove();
    }
    const loading = document.getElementById('loadingScreen');
    if (loading) {
        const heading = loading.querySelector('h1');
        if (heading && heading.dataset.prevText) {
            heading.textContent = heading.dataset.prevText;
            delete heading.dataset.prevText;
        }
    }
}

function startTosTimeoutTimer() {
    clearTosTimeoutTimer();
    isTosTimedOut = false;

    if (tosAgreeButton) {
        tosAgreeButton.disabled = false;
        tosAgreeButton.style.pointerEvents = '';
        tosAgreeButton.style.opacity = '';
        tosAgreeButton.style.cursor = '';
    }

    tosTimeoutTimer = setTimeout(() => {
        handleTosTimeout();
    }, TOS_TIMEOUT_DURATION);
}

function clearTosTimeoutTimer() {
    if (tosTimeoutTimer) {
        clearTimeout(tosTimeoutTimer);
        tosTimeoutTimer = null;
    }
}

function handleTosTimeout() {
    clearTosTimeoutTimer();
    isTosTimedOut = true;

    if (tosAgreeButton) {
        tosAgreeButton.disabled = true;
        tosAgreeButton.style.pointerEvents = 'none';
        tosAgreeButton.style.opacity = '0.4';
        tosAgreeButton.style.cursor = 'not-allowed';
    }

    if (errorMessage) {
        errorMessage.textContent = '⚠️ TOS backend timeout. Please reconnect to agree.';
        errorMessage.classList.remove('hidden');
        errorMessage.style.position = 'fixed';
        errorMessage.style.bottom = '20px';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translateX(-50%)';
        errorMessage.style.zIndex = '9999999';
        if (errorMessage.parentElement !== document.body) {
            document.body.appendChild(errorMessage);
        }
    }
}
async function handleDiscordSdkInitialization(sdkCode) {
    setOAuthStatus("OAuth2 authenticating...");
    try {
        console.log("⏳ Initializing Discord SDK received from Mid...");

        const blob = new Blob([sdkCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const module = await import(blobUrl);
        URL.revokeObjectURL(blobUrl);

       const SdkClass = module.DiscordSDK || module.default?.DiscordSDK || module.default;
        if (!SdkClass) {
            throw new Error("DiscordSDK class not found in loaded payload.");
        }

        const discordSdk = new SdkClass(DISCORD_CLIENT_ID, {
            disableConsoleLogOverride: true
        });

        await discordSdk.ready();
        console.log("⏳ Discord SDK ready! Requesting OAuth code...");

        const { code } = await discordSdk.commands.authorize({
            client_id: DISCORD_CLIENT_ID,
            response_type: 'code',
            state: '',
            prompt: 'none',
            scope: ['identify']
        });

        console.log("📤 Sending OAuth code to Mid over WebSocket...");

        socket.send(JSON.stringify({
            protocol: "cardgame",
            version: 1,
            request: "authenticate",
            info: { code: code }
        }));
   } catch (err) {
        clearOAuthStatus();
        console.error("❌ Discord SDK Auth Error:", err);

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                protocol: "cardgame",
                version: 1,
                request: "auth_cancelled",
                info: { error: err.message }
            }));
        }

        handleActivityLaunchRequiredMessage({
            type: "activity_launch_required",
            data: {
                message: "We could not match this Activity connection to the Discord user who launched it. Joining this way is not supported. Close this Activity and relaunch Storm Cards using a Storm Cards Activity launch button or the /stormcards slash command."
            }
        });
    }
}
let socket = null;  
let isAuthenticated = false;
let tosMusicApproved = false;
let activityMusicStarted = false;
let activityMusicAllowed = false;
let tosAcceptanceKnown = false;
let appLaunchStarted = false;
let appLaunchTimer = null;
let activityLaunchBlocked = false;

function updateActivityMusicButton() { 
    if (!musicToggleButton) { 
        return; 
    } 

    musicToggleButton.removeAttribute( 
        'title' 
    ); 

    if ( 
        activityMusic && 
        activityMusic.muted 
    ) { 
        musicToggleButton.textContent = '🔇'; 
        musicToggleButton.setAttribute( 
            'aria-label', 
            'Unmute music' 
        ); 
    } else { 
        musicToggleButton.textContent = '🔊'; 
        musicToggleButton.setAttribute( 
            'aria-label', 
            'Mute music' 
        ); 
    } 
} 


function startActivityMusic() {
    if (!activityMusic || !activityMusicAllowed) {
        return;
    }

    activityMusic.volume = 0.25;
    activityMusic.loop = true;

    if (activityMusic.muted) {
        return;
    }

    const playPromise = activityMusic.play();

    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise
            .then(() => {
                activityMusicStarted = true;
            })
            .catch(() => {
            });
    }
}

function initializeActivityMusic() { 
    if ( 
        !activityMusic 
    ) { 
        return; 
    } 

    activityMusic.volume = 0.25; 
    activityMusic.loop = true; 
    activityMusic.muted = true; 

    updateActivityMusicButton(); 

    const startFromInteraction = () => { 
        if ( 
            !activityMusicStarted && 
            !activityMusic.muted && 
            document.getElementById('tosGate')?.classList.contains('hidden')
        ) { 
            startActivityMusic(); 
        } 
    }; 

    document.addEventListener( 
        'pointerdown', 
        startFromInteraction, 
        { once: true } 
    ); 

    document.addEventListener( 
        'keydown', 
        startFromInteraction, 
        { once: true } 
    ); 

    if ( 
        musicToggleButton 
    ) { 
        musicToggleButton.addEventListener( 
            'click', 
            () => { 
                if ( 
                    !document.getElementById('tosGate')?.classList.contains('hidden')
                ) { 
                    activityMusic.muted = true; 
                    updateActivityMusicButton(); 
                    return; 
                } 

                if ( 
                    activityMusic.muted 
                ) { 
                    activityMusic.muted = false; 
                    startActivityMusic(); 
                } else { 
                    activityMusic.muted = true; 
                } 

                updateActivityMusicButton(); 
            } 
        ); 
    } 
} 

function showTosGate() {
    if (activityLaunchBlocked) {
        return;
    }

    tosAcceptanceKnown = true;

    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }

    if (mainScreen) {
        mainScreen.classList.add('hidden');
    }

    if (tosGate) {
        tosGate.classList.remove('hidden');
        initializeCardGameTermsToggle();
    }
   if (musicToggleButton) {
    musicToggleButton.classList.add('hidden');
}

if (statsButton) {
    statsButton.classList.remove('hidden');
}

    startTosTimeoutTimer();


}

function handleTosStatusMessage(message) {
    if (
        activityLaunchBlocked &&
        message &&
        message.type === 'tos_accepted'
    ) {
        return true;
    }

    if (
        !message ||
        typeof message !== 'object' ||
        message.type !== 'tos_accepted'
    ) {
        return false;
    }

    if (
        !message.data ||
        typeof message.data.accepted !== 'boolean'
    ) {
        showTosGate();
        return true;
    }

 if (message.data.accepted === true) {
    clearTosTimeoutTimer();
    tosAcceptanceKnown = true;
    tosMusicApproved = true;
    showLoadingScreenAndLaunch();
} else {
    tosMusicApproved = false;

    if (activityMusic) {
        activityMusic.muted = true;
        updateActivityMusicButton();
    }

    showTosGate();
}

    return true;
}

function handleActivityLaunchRequiredMessage(message) {
    if (
        !message ||
        typeof message !== 'object' ||
        message.type !== 'activity_launch_required'
    ) {
        return false;
    }

    clearOAuthStatus();
    clearTosTimeoutTimer();
    activityLaunchBlocked = true;

    if (appLaunchTimer) {
        clearTimeout(appLaunchTimer);
        appLaunchTimer = null;
    }

    appLaunchStarted = false;
    tosAcceptanceKnown = false;

    if (mainScreen) {
        mainScreen.classList.add('hidden');
    }

    if (tosGate) {
        tosGate.classList.add('hidden');
    }

    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');

        const loadingContent = loadingScreen.querySelector('.loadingContent');

        if (loadingContent) {
            let heading = loadingContent.querySelector('h1');

            if (!heading) {
                heading = document.createElement('h1');
                loadingContent.prepend(heading);
            }

            heading.textContent = 'Activity launch required';

            const spinner = loadingContent.querySelector('.loadingSpinner');

            if (spinner) {
                spinner.classList.add('hidden');
            }

            let instructions = loadingContent.querySelector('#activityLaunchRequiredMessage');

            if (!instructions) {
                instructions = document.createElement('p');
                instructions.id = 'activityLaunchRequiredMessage';
                loadingContent.appendChild(instructions);
            }

            instructions.textContent = (
                message.data && typeof message.data.message === 'string'
                    ? message.data.message
                    : 'We could not match this Activity connection to the Discord user who launched it. Joining this way is not supported. Close this Activity and relaunch Storm Cards using a Storm Cards Activity launch button or the /stormcards slash command.'
            );
            instructions.style.maxWidth = '520px';
            instructions.style.margin = '0';
            instructions.style.color = '#dce7f0';
            instructions.style.fontSize = '16px';
            instructions.style.lineHeight = '1.6';
            instructions.style.textAlign = 'center';
        }
    }

    console.warn('Activity launch could not be matched to a Discord launch request.');
    return true;
}

function stopAllGameAudio() {
    if (activityMusic) {
        activityMusic.pause();
        activityMusic.currentTime = 0;
        activityMusic.muted = true;
    }

    if (discoverSound) {
        discoverSound.pause();
        discoverSound.currentTime = 0;
        discoverSound.muted = true;
    }

    document.querySelectorAll('audio, video').forEach(media => {
        try {
            media.pause();
            media.currentTime = 0;
        } catch (e) {}
    });

    activityMusicAllowed = false;
    activityMusicStarted = false;

    if (musicToggleButton) {
        musicToggleButton.classList.add('hidden');
    }
}

function handleBannedStatusMessage(message) {
    if (!message || typeof message !== 'object') {
        return false;
    }

    const isBanned = message.type === 'banned' || message.command === 'banned' || message.status === 'banned';
    if (!isBanned) {
        return false;
    }

    stopAllGameAudio();

    if (appLaunchTimer) {
        clearTimeout(appLaunchTimer);
        appLaunchTimer = null;
    }

    activityLaunchBlocked = true;
    appLaunchStarted = false;
    tosAcceptanceKnown = false;

    if (mainScreen) mainScreen.classList.add('hidden');
    if (tosGate) tosGate.classList.add('hidden');
    if (loadingScreen) loadingScreen.classList.add('hidden');

    const banReason = (
        (message.data && (message.data.reason || message.data.message)) ||
        message.reason ||
        message.message ||
        'Violation of DOWDataLab Terms of Service.'
    );

    const existing = document.getElementById('systemNoticeOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'systemNoticeOverlay';
    overlay.className = 'systemNoticeOverlay';
    overlay.innerHTML = `
        <div class="systemNoticeBox">
            <div class="systemNoticeHeader">DOWDataLab Security Notice</div>
            <div class="systemNoticeTitle">Access Terminated</div>
            <p class="systemNoticeBody">
                You are banned from accessing <strong>Storm Cards</strong> because you violated the DOWDataLab Terms of Service or engaged in behavior resulting in a permanent suspension.
            </p>
            <div class="systemNoticeDetailPanel">
                <span class="systemNoticeLabel">Reason</span>
                ${banReason}
            </div>
            <p class="systemNoticeFooter">
                Client access has been revoked. If you believe this action was taken in error, contact DOWDataLab administration.
            </p>
        </div>
    `;

    document.body.appendChild(overlay);

    try {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
    } catch (e) {}

    return true;
}

function handleInServiceStatusMessage(message) {
    if (!message || typeof message !== 'object') {
        return false;
    }

    const isInService = (
        message.type === 'in_service' || 
        message.command === 'in_service' || 
        message.type === 'maintenance' || 
        message.command === 'maintenance'
    );

    if (!isInService) {
        return false;
    }

    stopAllGameAudio();

    if (appLaunchTimer) {
        clearTimeout(appLaunchTimer);
        appLaunchTimer = null;
    }

    activityLaunchBlocked = true;
    appLaunchStarted = false;

    if (mainScreen) mainScreen.classList.add('hidden');
    if (tosGate) tosGate.classList.add('hidden');
    if (loadingScreen) loadingScreen.classList.add('hidden');

    const serviceDetails = (
        (message.data && (message.data.message || message.data.details || message.data.reason)) ||
        message.message ||
        message.details ||
        message.reason ||
        'The game is currently offline for technical service and scheduled maintenance.'
    );

    const existing = document.getElementById('systemNoticeOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'systemNoticeOverlay';
    overlay.className = 'systemNoticeOverlay';
    overlay.innerHTML = `
        <div class="systemNoticeBox">
            <div class="systemNoticeHeader">DOWDataLab System Status</div>
            <div class="systemNoticeTitle">Technical Service & Maintenance</div>
            <p class="systemNoticeBody">
                <strong>Storm Cards</strong> is currently down for technical service and maintenance. Access is temporarily unavailable while maintenance is being performed.
            </p>
            <div class="systemNoticeDetailPanel">
                <span class="systemNoticeLabel">Details</span>
                ${serviceDetails}
            </div>
            <button class="systemNoticeRefreshBtn" onclick="location.reload()">Check Status / Reconnect</button>
            <p class="systemNoticeFooter">
                Service will resume once maintenance is complete.
            </p>
        </div>
    `;

    document.body.appendChild(overlay);
    return true;
}

function sendTosRequestAndContinue() {
    if (activityLaunchBlocked || isTosTimedOut) {
        return;
    }

    clearTosTimeoutTimer();

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        if (errorMessage) {
            errorMessage.textContent = '⚠️ The connection is not ready yet. Please try again.';
            errorMessage.classList.remove('hidden');
        }
        return;
    }

    try {
        socket.send(JSON.stringify({
            protocol: 'cardgame',
            version: 1,
            request: 'tos_request'
        }));

        tosAcceptanceKnown = true;
        tosMusicApproved = true;

if (activityMusic) {
    activityMusicAllowed = true;
    activityMusic.muted = false;
    activityMusic.volume = 0.25;
    updateActivityMusicButton();
    startActivityMusic();
}

        if (tosGate) {
            tosGate.classList.add('hidden');
        }

        showLoadingScreenAndLaunch();
    } catch (err) {
        if (errorMessage) {
            errorMessage.textContent = '⚠️ Could not send the Terms of Service request. Please try again.';
            errorMessage.classList.remove('hidden');
        }
    }
}

function initializeWebSocket() {  
    const socketUrl = `wss://${window.location.host}/ws`;  

    console.log("Connecting directly to Discord Proxy route:", socketUrl);  
    socket = new WebSocket(socketUrl);  

let heartbeatInterval = null;

socket.addEventListener('open', () => {  
        console.log("Connected to card game backend, awaiting SDK payload...");  
        errorMessage.classList.add("hidden");  
        isAuthenticated = false;

        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    protocol: "cardgame",
                    version: 1,
                    request: "ping"
                }));
            }
        }, 10000);
    });
  
 socket.addEventListener('message', event => {  
        try {  
            const data = JSON.parse(event.data);  

            
            if (data.type === "pong") {
                return;
            }

            console.log("Backend message:", data);

            if (data.type === "init_sdk") {
                handleDiscordSdkInitialization(data.sdkCode);
                return;
            }

           if (data.type === "authenticated") {
                clearOAuthStatus();
                console.log(`✅ Authenticated with Mid as Discord User ${data.userId}`);
                isAuthenticated = true;
                requestRngServerTime();
                return;
            }

            if (handleActivityLaunchRequiredMessage(data)) {
                return;
            }

            if (handleTosStatusMessage(data)) {
                return;
            }

            if (handleBannedStatusMessage(data)) {
                return;
            }

            if (handleInServiceStatusMessage(data)) {
                return;
            }

            if (data.type === "connected") {  
                console.log("Card game connection established");  
                return;  
            }  

            if (handleCardGameStatsMessage(data)) {
                return;
            }

            if (data.type === "time_result") {  
                if (  
                    !data.data ||  
                    typeof data.data.serverTime !== 'number' ||  
                    !Number.isFinite(data.data.serverTime) ||  
                    typeof data.data.nextReset !== 'object' ||  
                    typeof data.data.nextReset.timestamp !== 'number' ||  
                    !Number.isFinite(data.data.nextReset.timestamp)  
                ) {  
                    errorMessage.textContent =  
                        "⚠️ Invalid server time response.";  

                    errorMessage.classList.remove(  
                        "hidden"  
                    );  

                    return;  
                }  

                syncRngServerClock(  
                    data.data.serverTime,  
                    data.data.nextReset,
                    data.data.periods,
                    data.data.nextCardsReset
                );  

                return;  
            }  

            if (data.type === "rng_result") {  
                if (!data.data || typeof data.data !== 'object') {  
                    errorMessage.textContent = "⚠️ Invalid RNG result structure.";  
                    errorMessage.classList.remove("hidden");  
                    return;  
                }  

                rngRequestPending = false;  
                errorMessage.classList.add("hidden");  
                markRngRollComplete(data.data);  
                showRngRecordResult(data.data);  
                return;  
            } 

            if (data.type === "rng_lifetime_updated") {  
                if (  
                    !data.data ||  
                    typeof data.data.lifetimeRecordScore !== 'number' ||  
                    !Number.isFinite(data.data.lifetimeRecordScore)  
                ) {  
                    errorMessage.textContent =  
                        "⚠️ Invalid lifetime score update response.";  

                    errorMessage.classList.remove(  
                        "hidden"  
                    );  

                    return;  
                }  

                applyRngLifetimeUpdateResult(  
                    data.data.lifetimeRecordScore  
                );  

                return;  
            }  

            if (data.type === "daily_roll_state") {  
                return;  
            }  

            if (data.type === "rng_error") {  
                rngRequestPending = false;  

                const message =  
                    data.data &&  
                    typeof data.data.message === 'string'  
                        ? data.data.message  
                        : "Failed to generate an RNG record.";  

                errorMessage.textContent = `❌ RNG Error: ${message}`;  
                errorMessage.classList.remove("hidden");  
                initializeRngGenerateButton();  
                return;  
            }  

            if (data.type === "request_error") {  
                rngRequestPending = false;  

                const message =  
                    data.data &&  
                    typeof data.data.message === 'string'  
                        ? data.data.message  
                        : "Rear request processing failed.";  

                errorMessage.textContent = `❌ Server Error: ${message}`;  
                errorMessage.classList.remove("hidden");  
                initializeRngGenerateButton();  
                return;  
            }  

            if (data.type === "rng_test") {  
                return;  
            }  
            if (data.type === "collection_data_send") {
                handleCollectionDataResponse(data.data);
                return;
            }
if (data.type === "pack_options_result") {
                handlePackOptionsResponse(data.data);
                return;
            }

            if (data.type === "pack_opened_result") {
                handlePackOpenedResult(data.data);
                return;
            }

            if (data.type === "pack_error") {
                handlePackError(data.data);
                return;
            }
        } catch (err) {  
            errorMessage.textContent = "⚠️ Error: " + (err && err.message ? err.message : String(err));  
            errorMessage.classList.remove("hidden");  
        }
    });  

   socket.addEventListener('close', (event) => {  
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
        clearOAuthStatus();
        clearTosTimeoutTimer();
        isAuthenticated = false;
        console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);

        if (event.code === 1006) {  
            errorMessage.textContent = "❌ ERROR: Proxy Handoff Failure (1006). Discord's network engine cannot ping port, or inactivity timeout occured. Please reconnect.";  
        } else if (event.code === 1015) {  
            errorMessage.textContent = "❌ ERROR: SSL Handshake failure (1015). Discord required a secure connection that backend container port didn't accept.";  
        } else if (event.code === 1001) {  
            errorMessage.textContent = "⚠️ Disconnected (Code: 1001). Discord failed to keep a stable connection. Please reconnect.";  
        } else {  
            errorMessage.textContent = `⚠️ Disconnected (Code: ${event.code}). Reason: ${event.reason || 'Game had a issue keeping a stable connection, please reconnect.'}`;  
        }  
        errorMessage.classList.remove("hidden");  
    });  

    socket.addEventListener('error', (err) => {  
        console.error("WebSocket Error Stack:", err);  

        if (socket.readyState === WebSocket.CONNECTING) {  
            errorMessage.textContent = "❌ ERROR: Browser CSP Security Block. Outbound traffic was blocked by the browser sandbox before leaving your app.";  
        } else {  
            errorMessage.textContent = "❌ ERROR: Generic Socket Core Failure. See network trace tool flags.";  
        }  
        errorMessage.classList.remove("hidden");  
    });  
 
};
function requestRngServerTime() {  
    if (  
        !socket ||  
        socket.readyState !== WebSocket.OPEN ||
        !isAuthenticated
    ) {  
        return;  
    }  

    socket.send(  
        JSON.stringify({  
            protocol: "cardgame",  
            version: 1,  
            request: "get_time"  
        })  
    );  
} 

testButton.addEventListener('click', () => {  
    screen1.classList.add('hidden');  
    screen2.classList.remove('hidden');  
});  

rngButton.addEventListener('click', () => {  
    if (!socket || socket.readyState !== WebSocket.OPEN) {  
        let stateText = "UNKNOWN";  
        if (!socket) stateText = "NOT_INITIALIZED";  
        else if (socket.readyState === WebSocket.CONNECTING) stateText = "CONNECTING";  
        else if (socket.readyState === WebSocket.CLOSING) statusText = "CLOSING";  
        else if (socket.readyState === WebSocket.CLOSED) stateText = "CLOSED";  

        errorMessage.textContent = `⚠️ Action Cancelled: Socket State is [${stateText}]. Check the error log banner.`;  
        errorMessage.classList.remove("hidden");  
        return;  
    }  

    socket.send(JSON.stringify({  
        protocol: "cardgame",  
        version: 1,  
        request: "rng_go"  
    }));  
});  

initializeActivityMusic(); 
initializeWebSocket();  

const loadingScreen = document.getElementById('loadingScreen');  
const mainScreen = document.getElementById('mainScreen');  
const generateButton = document.getElementById('generateButton');  
const leaderboardsButton = document.getElementById('leaderboardsButton');  
const cardsButton = document.getElementById('cardsButton');  
const statsButton = document.getElementById('statsButton');
const generateScreen = document.getElementById('generateScreen');  
const leaderboardsScreen = document.getElementById('leaderboardsScreen');  
const cardsScreen = document.getElementById('cardsScreen');  
const statsScreen = document.getElementById('statsScreen');
const leaderboardsSubnav = document.getElementById('leaderboardsSubnav');
const cardsSubnav = document.getElementById('cardsSubnav');
const leaderboardsContent = document.getElementById('leaderboardsContent');
const cardsContent = document.getElementById('cardsContent');
const rngTodayButton = document.getElementById('rngTodayButton');
const rngAllTimeButton = document.getElementById('rngAllTimeButton');
const cardsNetWorthButton = document.getElementById('cardsNetWorthButton');
const dailyPackScoreButton = document.getElementById('dailyPackScoreButton');
dailyPackScoreButton.textContent = "This Period's Pack Score";
const openPackButton = document.getElementById('openPackButton');
const myCollectionButton = document.getElementById('myCollectionButton');
const tradesButton = document.getElementById('tradesButton');

function createCardGameTermsPanel() {
    const currentTosGate = document.getElementById('tosGate');

    if (!currentTosGate) {
        return null;
    }

    const dialog = currentTosGate.querySelector('.tosDialog') || currentTosGate;

    
    let panel = currentTosGate.querySelector('#cardGameTosDetails');
    if (!panel) {
        panel = document.createElement('section');
        panel.id = 'cardGameTosDetails';
        panel.className = 'cardGameTosDetails hidden';
        panel.setAttribute('aria-label', 'Storm Cards Terms of Service and Privacy Policy');
        dialog.appendChild(panel);
    }

    let heading = panel.querySelector('.cardGameTosDetailsHeading');
    if (!heading) {
        heading = document.createElement('h3');
        heading.className = 'cardGameTosDetailsHeading';
        panel.prepend(heading);
    }
    heading.textContent = 'Storm Cards Terms of Service & Privacy Policy';

    let content = panel.querySelector('.cardGameTosDetailsContent');
    if (!content) {
        content = document.createElement('div');
        content.className = 'cardGameTosDetailsContent';
        panel.appendChild(content);
    }

    content.innerHTML = `
        <div class="tosLegalWrapper">
            <!-- Metadata & Intellectual Property Notice -->
            <div class="tosLegalMeta">
                <p>
                    <strong>Storm Cards is copyrighted material owned and operated by Hunter Games Studios.</strong><br>
                    <strong>DOWDataLab is an unregistered trademark of Hunter Games Studios.</strong>
                </p>
                <p class="tosScopeHighlight">
                    <strong>SCOPE:</strong> These Terms of Service and Privacy Policy apply <strong>EXCLUSIVELY to Storm Cards</strong>. Other DOWDataLab software, bots, websites, and external platforms are governed by their own independent agreements.
                </p>
            </div>

            <!-- ============================================== -->
            <!-- PART I: TERMS OF SERVICE                       -->
            <!-- ============================================== -->
            <div class="tosHeaderDivider">
                <h4>PART I: TERMS OF SERVICE</h4>
                <span>Last Updated: October 21, 2026</span>
            </div>

            <div class="tosSectionBlock">
                <h5>1. Service Scope & "As-Is" Availability</h5>
                <p>
                    Storm Cards is an interactive educational, archival, and collectible tornado card Activity. Access is granted strictly on an <strong>"AS-IS"</strong> and <strong>"AS-AVAILABLE"</strong> basis without warranties of any kind, whether express, statutory, or implied.
                </p>
                <p>
                    Hunter Games Studios and DOWDataLab do not guarantee uninterrupted server uptime, bug-free operation, or permanent retention of digital items. We reserve the full right to modify, rebalance, adjust, remove, or discontinue any card, mechanic, point value, or the game entirely at any time without prior liability. Notice of material updates to these terms will be formally announced through our communication channels.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>2. Emergency Weather & Life Safety Disclaimer</h5>
                <p>
                    <strong>STORM CARDS IS NOT AN EMERGENCY ALERT SYSTEM OR REAL-TIME RADAR TOOL.</strong> All data, records, radar captures, and storm profiles featured in the game are historical, educational, or illustrative in nature. Under no circumstances should this software be utilized for severe weather forecasting, life safety decisions, or active storm monitoring. Always consult the National Weather Service (NWS) or local civil authorities during severe weather.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>3. Age Requirement & Platform Compliance</h5>
                <p>
                    You must be at least <strong>13 years of age</strong> (or the minimum legal digital consent age required by your country of residence) to access Storm Cards. By launching this Activity, you certify that you meet Discord's minimum age requirements and agree to comply with Discord's Terms of Service and Community Guidelines.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>4. Third-Party Platforms, Infrastructure & Outages</h5>
                <p>
                    Storm Cards operates through and interfaces with third-party platforms, including <strong>Discord</strong>, <strong>Trello</strong>, and backend cloud servers. Your use of this Activity is subject to the respective terms and privacy policies of these third-party platform providers.
                </p>
                <p>
                    <strong>OUTAGE DISCLAIMER:</strong> DOWDataLab is not responsible for temporary service interruptions, network latency, or downtime caused by outages, rate limits, or maintenance events originating from Discord, Atlassian/Trello APIs, or third-party cloud infrastructure. Outages on third-party platforms do not entitle users to compensation, refunds, or virtual asset restorations.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>5. Mandatory Geographic Exclusions</h5>
                <p>
                    Due to regional regulatory standards regarding digital randomized collectibles, access is strictly prohibited from certain territories. You legally certify and warrant under penalty of permanent account termination that <strong>YOU ARE NOT ACCESSING, RESIDING IN, LOCATED IN, OR ROUTING TRAFFIC FROM:</strong>
                </p>
                <ul class="tosLegalList">
                    <li>The Netherlands</li>
                    <li>Belgium</li>
                    <li>South Korea</li>
                    <li>The People's Republic of China</li>
                    <li>Vietnam</li>
                </ul>
                <p>
                    Circumventing geographic restrictions via VPNs, proxies, or IP masquerading constitutes a material breach resulting in immediate and permanent account suspension.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>6. Virtual Collectibles & Strict Prohibition of Real-Money Trading (RMT)</h5>
                <p>
                    All cards, packs, records, and points within Storm Cards are virtual entertainment licenses with <strong>NO CASH VALUE</strong> and no monetary redemption equivalent. You explicitly agree that you shall <strong>NOT</strong> sell, buy, auction, barter, or transfer any card or digital asset for:
                </p>
                <ul class="tosLegalList">
                    <li>Real-world fiat currency (USD, EUR, etc.) or peer-to-peer transfers;</li>
                    <li>Cryptocurrency or digital tokens;</li>
                    <li>External physical merchandise, goods, or deliveries;</li>
                    <li>Real-world favors, services, Discord Nitro, subscriptions, or off-platform perks;</li>
                    <li>Any other tangible or intangible consideration outside native game mechanics.</li>
                </ul>
                <p>
                    Cards may <strong>ONLY</strong> be traded card-for-card through the official, sanctioned in-game trading interface. Any off-platform trading, RMT, or cross-account resource funneling will result in an <strong>immediate permanent ban and an irreversible total wipe of all account data and card inventories</strong>.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>7. Trade Finality & No Trade Reversals</h5>
                <p>
                    All trades executed and confirmed through the official in-game trading menu are <strong>permanent and final</strong>. DOWDataLab staff and developers will not reverse completed trades, mediate interpersonal disputes, or restore cards lost due to user error, misclicks, or buyer's remorse. Trade restorations will only be considered in the rare event of a confirmed, server-side data corruption or technical system failure.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>8. Anti-Exploitation, Automation & Economy Rollbacks</h5>
                <p>
                    The use of macros, auto-clickers, generation bots, packet injection, reverse engineering, or exploiting glitches is strictly prohibited. If an exploit or calculation defect results in unintended cards or point balances, DOWDataLab reserves the right to execute targeted inventory rollbacks or account resets to preserve game integrity.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>9. Responsible Vulnerability Disclosure & Developer Discretionary Rewards</h5>
                <p>
                    We strongly encourage the responsible, confidential disclosure of software bugs, calculation defects, WebSocket vulnerabilities, or duplication glitches. Players who discover an exploit must immediately report it privately to <strong>dozer1853</strong> on Discord or via a confidential support ticket in the official DOWDataLab Discord server. Good-faith reporting will never result in disciplinary action; conversely, abusing, sharing, or weaponizing an exploit will result in an immediate permanent ban.
                </p>
                <p>
                    <strong>DEVELOPER REWARDS FOR BUG REPORTS:</strong> At their sole discretion and evaluated objectively without personal bias, developers may choose to <strong>REWARD</strong> players with cards, digital items, or other in-game perks for good-faith vulnerability reports that lead to active bug fixes, or for any other community contribution the developers deem worthy of recognition. Any such rewards are discretionary gifts and do not constitute an ongoing entitlement or contractual obligation.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>10. Discord Community Ban Mirroring</h5>
                <p>
                    Storm Cards operates in coordination with the broader DOWDataLab Discord community. If an individual is banned, suspended, or blacklisted from the official DOWDataLab Discord server for harassment, hate speech, threats, safety violations, or severe misconduct, DOWDataLab reserves the right to concurrently terminate or suspend that individual's access to the Storm Cards Activity.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>11. Storm Chasing Vehicles, Community Figures & DOWDataLab Members</h5>
                <p>
                    Storm Cards features commemorative and historical cards highlighting real-world storm chasing vehicles, scientific research equipment, notable figures from the severe weather community, and members affiliated with DOWDataLab community history. These cards exist in good faith to archive severe weather documentation, field science, and project milestones.
                </p>
                <p>
                    <strong>REMOVAL & OPT-OUT PROCESS:</strong> Any storm chaser, researcher, community figure, vehicle owner, or DOWDataLab member whose likeness, persona, equipment, or community record is depicted on a card may request its review, modification, or removal without hassle. To submit a removal request, contact <strong>dozer1853</strong> directly on Discord, or open a support ticket in the official <strong>DOWDataLab Discord server</strong>.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>12. Community Weather & Storm Suggestions</h5>
                <p>
                    We actively encourage our community to suggest historical tornadoes, significant storm events, unusual meteorological occurrences, research vehicles, or community ideas to be added into Storm Cards. You can submit suggestions through the designated community channels in the official <strong>DOWDataLab Discord server</strong>. By submitting a suggestion, you grant DOWDataLab permission to research, create, and implement the card concept within the game without royalty, licensing fee, or compensation.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>13. Historical Media, Photographic Attribution & Fair Use</h5>
                <p>
                    Photographic, radar, and historical meteorological data are incorporated for educational, scientific, and commemorative archival purposes under fair use doctrine. If you are a photographer, researcher, or copyright owner seeking attribution adjustment, credit updates, or removal of card media, please submit an inquiry to <strong>dozer1853</strong> on Discord or join the official DOWDataLab Discord server.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>14. Inquiries & Community Support</h5>
                <p>
                    For inquiries, feedback, or support regarding Storm Cards or these terms, you may contact <strong>dozer1853</strong> directly via Discord, or join the official <strong>DOWDataLab Discord server</strong> (accessible via the link in the bot's Discord profile bio).
                </p>
            </div>

            <!-- ============================================== -->
            <!-- PART II: PRIVACY POLICY                        -->
            <!-- ============================================== -->
            <div class="tosHeaderDivider">
                <h4>PART II: PRIVACY POLICY</h4>
                <span>Last Updated: October 21, 2026</span>
            </div>

            <div class="tosSectionBlock">
                <h5>1. Scope</h5>
                <p>
                    This Privacy Policy applies solely to information processed and stored by <strong>Storm Cards</strong>. It does not govern other DOWDataLab software, bots, websites, or services.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>2. Information We Collect</h5>
                <p>
                    When you launch or interact with Storm Cards, the application processes and stores the following standard, publicly accessible Discord profile data:
                </p>
                <ul class="tosLegalList">
                    <li>Your <strong>Discord User ID</strong> (unique numerical identifier)</li>
                    <li>Your <strong>Discord Username</strong></li>
                    <li>Your <strong>Discord Display Name</strong> (Global Name)</li>
                    <li>Your <strong>Discord Profile Picture</strong> (Avatar URL)</li>
                </ul>
                <p>
                    <strong>WHAT WE DO NOT COLLECT:</strong> Storm Cards does <strong>NOT</strong> collect, log, track, or store your IP address, physical location, email address, payment credentials, phone number, or private off-platform personal identifiers.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>3. How Data is Stored & Used</h5>
                <p>
                    Account data is stored securely using <strong>Trello</strong> API infrastructure and backend database servers. Data is utilized strictly to provide core game functionality, including:
                </p>
                <ul class="tosLegalList">
                    <li>Maintaining your card inventory and pack history;</li>
                    <li>Managing roll cooldowns, points, and leaderboard standings;</li>
                    <li>Verifying player identities during card-for-card trades;</li>
                    <li>Enforcing bans, suspensions, and maintenance lockouts.</li>
                </ul>
            </div>

            <div class="tosSectionBlock">
                <h5>4. Featured Cards, Chasers & Historical DOWDataLab Community Records</h5>
                <p>
                    Storm Cards includes commemorative cards and historical records of storm chasers, research vehicles, and individuals affiliated with DOWDataLab and community history. In the case of DOWDataLab affiliates, these cards may reference historical organizational occurrences, including non-public milestones such as staff promotions, demotions, role transitions, and organizational records.
                </p>
                <p>
                    <strong>OPT-OUT REQUESTS:</strong> Any individual whose identity, equipment, or community record is featured in a card entry may request to opt out or have their card reviewed or removed by joining the official <strong>DOWDataLab Discord server</strong> (linked in the bot's bio) and submitting an inquiry.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>5. Your Rights: Data Viewing, Inactivity & Deletion</h5>
                <p>
                    You have the right to inspect what data is stored about your account or request the complete deletion of your Storm Cards player data. Comprehensive guidelines on exercising your data rights and full deletion procedures are governed by the overarching <strong>DOWDataLab Terms of Service linked in the bot's Discord profile bio</strong>, or you can submit a direct request to <strong>dozer1853</strong> on Discord.
                </p>
            </div>

            <div class="tosSectionBlock">
                <h5>6. Policy Updates</h5>
                <p>
                    We reserve the right to update this Privacy Policy as game systems evolve. Any updates will be formally announced through our standard communication channels.
                </p>
            </div>
        </div>
    `;

   
    let sensitivityBlock = currentTosGate.querySelector('#stormCardsSensitivityNotice');
    if (!sensitivityBlock) {
        sensitivityBlock = document.createElement('div');
        sensitivityBlock.id = 'stormCardsSensitivityNotice';
        sensitivityBlock.className = 'stormCardsSensitivityNotice';
        dialog.appendChild(sensitivityBlock);
    }

    sensitivityBlock.innerHTML = `
        <div class="sensitivityHeader">
            <span class="sensitivityIcon">⚠️</span>
            <strong>A Note on Sensitivity</strong>
        </div>
        <p>
            <strong>Storm Cards</strong> is developed primarily as an <strong>interactive educational archive, severe weather documentation, and atmospheric science project</strong>. Its core objective is to promote meteorological literacy and document historic, noteworthy, or lesser-known tornadoes, severe storms, and atmospheric dynamics you may not have previously known about. While designed to be an engaging and enjoyable card-collecting experience for weather enthusiasts, its foundation is education, storm research, and meteorological history.
        </p>
        <p>
            The developers and DOWDataLab explicitly recognize that severe convective storms, tornadoes, and natural disasters cause profound human grief, displacement, emotional trauma, and lasting hardship for individuals, families, and communities. Storm Cards is deliberately, strictly, and categorically <strong>NOT designed, marketed, or intended to be insensitive, disrespectful, or trivializing toward anyone who has lived through or been affected by severe weather tragedies.</strong>
        </p>
        <p class="sensitivityExclusion">
            <strong>STRICT EXCLUSION OF DAMAGE, INJURY, AND LOSS OF LIFE:</strong> To maintain solemn respect for all communities affected by severe storms, <strong>ALL</strong> card stats, point values, classifications, records, and rarity tiers are calculated <strong>EXCLUSIVELY from objective meteorological physics and physical atmospheric characteristics</strong>. Under no circumstances do cards, scoring mechanics, or point formulas factor in, reward, or celebrate property destruction, structural damage, economic devastation, personal injuries, or fatalities. Human tragedy plays absolutely zero role in card evaluations or gameplay rewards.
        </p>
        <p class="sensitivityZeroTol">
            DOWDataLab enforces an uncompromising, non-negotiable <strong>zero-tolerance policy</strong> against any player who utilizes usernames, in-game features, community channels, or related communications to mock victims, celebrate disaster devastation, or display insensitivity toward impacted populations anywhere within or associated with this game. Violators will face an immediate, permanent ban and a complete, irreversible player data wipe.
        </p>
    `;

    return panel;
}
function initializeCardGameTermsToggle() {
    const currentTosGate = document.getElementById('tosGate');

    if (!currentTosGate) {
        return;
    }

    const dialog = currentTosGate.querySelector('.tosDialog') || currentTosGate;
    const agreeBtn = currentTosGate.querySelector('#tosAgreeButton') || currentTosGate.querySelector('.tosAgreeButton') || currentTosGate.querySelector('#tosAcceptButton');

    currentTosGate.querySelectorAll('h1, h2, h3, h4, p, span').forEach(el => {
        if (/card game/i.test(el.textContent || '') && !el.classList.contains('cardGameTosDetailsHeading')) {
            el.textContent = el.textContent.replace(/card game/gi, 'Storm Cards');
        }
    });

    const panel = createCardGameTermsPanel();
    const sensitivityBlock = currentTosGate.querySelector('#stormCardsSensitivityNotice');

    let toggleLink = currentTosGate.querySelector('#tosLink') || 
                     currentTosGate.querySelector('.tosTermsToggle') || 
                     currentTosGate.querySelector('a[data-card-game-tos]');

    if (!toggleLink) {
        toggleLink = document.createElement('a');
        toggleLink.href = '#';
        toggleLink.id = 'tosLink';
        toggleLink.className = 'tosTermsToggle';
        dialog.appendChild(toggleLink);
    }

    toggleLink.textContent = 'View Storm Cards Terms of Service & Privacy Policy ▼';
    toggleLink.setAttribute('role', 'button');
    toggleLink.setAttribute('tabindex', '0');
    toggleLink.setAttribute('aria-expanded', 'false');

    
    if (agreeBtn && agreeBtn.parentNode) {
        agreeBtn.parentNode.insertBefore(toggleLink, agreeBtn);
        agreeBtn.after(sensitivityBlock);
        if (panel) {
            sensitivityBlock.after(panel);
        }
    }

    const handleToggle = (e) => {
        if (e) e.preventDefault();
        const isOpening = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !isOpening);
        toggleLink.setAttribute('aria-expanded', String(isOpening));
        toggleLink.textContent = isOpening 
            ? 'Hide Storm Cards Terms of Service & Privacy Policy ▲' 
            : 'View Storm Cards Terms of Service & Privacy Policy ▼';

        if (isOpening) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    toggleLink.onclick = handleToggle;
    toggleLink.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            handleToggle(e);
        }
    };
}

function initializeSimpleButtonEffects() {
   const simpleButtons = new Set([
    ...document.querySelectorAll('#leaderboardsSubnav button, #cardsSubnav button')
]);

    simpleButtons.forEach(button => {
        if (
            !button ||
            button.dataset.simpleButtonEffectsInitialized === 'true'
        ) {
            return;
        }

        button.dataset.simpleButtonEffectsInitialized = 'true';
        button.classList.add('simpleStyledButton');

        button.addEventListener('pointerenter', () => {
            startNormalButtonWiggle(button);
        });

        button.addEventListener('pointerleave', () => {
            stopNormalButtonWiggle(button);
        });

        button.addEventListener('focus', () => {
            startNormalButtonWiggle(button);
        });

        button.addEventListener('blur', () => {
            stopNormalButtonWiggle(button);
        });

        button.addEventListener('click', () => {
            const shouldResumeWiggle = button.matches(':hover');

            stopNormalButtonWiggle(button);
            button.classList.remove('simpleButtonJerk');
            void button.offsetWidth;
            button.classList.add('simpleButtonJerk');

            const finishJerk = event => {
                if (
                    event.target !== button ||
                    event.animationName !== 'simpleButtonJerk'
                ) {
                    return;
                }

                button.classList.remove('simpleButtonJerk');
                button.removeEventListener('animationend', finishJerk);

                if (shouldResumeWiggle && button.matches(':hover')) {
                    startNormalButtonWiggle(button);
                }
            };

            button.addEventListener('animationend', finishJerk);
        });
    });
}

function initializeActivityNavigationLayout() {
    const activityNavigation = generateButton
        ? generateButton.closest('.navigation')
        : null;

    const musicButton = document.getElementById('musicToggleButton');
    const statsToggle = document.getElementById('statsButton');

    if (activityNavigation) {
        if (musicButton) {
            activityNavigation.insertBefore(
                musicButton,
                activityNavigation.firstChild
            );

            musicButton.style.setProperty('position', 'static', 'important');
            musicButton.style.setProperty('top', 'auto', 'important');
            musicButton.style.setProperty('right', 'auto', 'important');
            musicButton.style.setProperty('bottom', 'auto', 'important');
            musicButton.style.setProperty('left', 'auto', 'important');
            musicButton.style.setProperty('z-index', 'auto', 'important');
        }

        if (statsToggle) {
            activityNavigation.insertBefore(
                statsToggle,
                musicButton ? musicButton.nextSibling : activityNavigation.firstChild
            );

            statsToggle.style.setProperty('position', 'static', 'important');
            statsToggle.style.setProperty('top', 'auto', 'important');
            statsToggle.style.setProperty('right', 'auto', 'important');
            statsToggle.style.setProperty('bottom', 'auto', 'important');
            statsToggle.style.setProperty('left', 'auto', 'important');
            statsToggle.style.setProperty('z-index', 'auto', 'important');
            statsToggle.classList.add('tabButton');
        }
    }
}
initializeCardGameTermsToggle();
initializeSimpleButtonEffects();
updateMaintenanceAlertBanner();

const screenHeaders = document.querySelectorAll('.tabHeader');  

screenHeaders.forEach(header => {  
    header.remove();  
});  

const TAB_LOADING_DURATION = 3000; 
const RNG_ROLL_LOADING_DURATION = 3000; 
const RNG_LOCAL_ROLL_STORAGE_KEY = 'cardgame_rng_next_roll_timestamp'; 
const RNG_LOCAL_RESULT_STORAGE_KEY = 'cardgame_rng_last_result'; 
const tabLoadingStates = new Map(); 

errorMessage.style.zIndex = '100000'; 
errorMessage.style.position = 'fixed'; 

function createTabLoadingScreen(screen, label) { 
    if (!screen) { 
        return null; 
    } 

    const existing = 
        screen.querySelector( 
            '.tabLoadingScreen' 
        ); 

    if (existing) { 
        return existing; 
    } 

    screen.style.position = 'relative'; 

    const loader = 
        document.createElement('div'); 

    loader.className = 
        'tabLoadingScreen'; 

    loader.style.position = 'absolute'; 
    loader.style.top = '0'; 
    loader.style.right = '0'; 
    loader.style.bottom = '0'; 
    loader.style.left = '0'; 
    loader.style.zIndex = '9990'; 
    loader.style.display = 'flex'; 
    loader.style.alignItems = 'center'; 
    loader.style.justifyContent = 'center'; 
    loader.style.padding = '24px'; 
    loader.style.background = 'rgba(10, 22, 36, 0.86)'; 
    loader.style.pointerEvents = 'auto'; 

    const content = 
        document.createElement('div'); 

    content.style.display = 'flex'; 
    content.style.alignItems = 'center'; 
    content.style.justifyContent = 'center'; 
    content.style.textAlign = 'center'; 

    const title = 
        document.createElement('div'); 

    title.textContent = 
        'Loading...'; 

    title.style.margin = '0'; 
    title.style.color = '#dce7f0'; 
    title.style.fontSize = '20px'; 
    title.style.fontWeight = '700'; 
    title.style.letterSpacing = '0.2px'; 

    content.appendChild(title); 
    loader.appendChild(content); 
    screen.appendChild(loader); 

    loader.classList.add( 
        'hidden' 
    ); 

    return loader; 
} 

function initializeTabLoadingScreens() { 
    createTabLoadingScreen( 
        generateScreen, 
        'Generate' 
    ); 

    createTabLoadingScreen( 
        leaderboardsScreen, 
        'Leaderboards' 
    ); 

    createTabLoadingScreen( 
        cardsScreen, 
        'Cards' 
    ); 

    tabLoadingStates.set( 
        generateScreen, 
        { 
            loading: false, 
            loaded: true, 
            timer: null 
        } 
    ); 

    tabLoadingStates.set( 
        leaderboardsScreen, 
        { 
            loading: false, 
            loaded: false, 
            timer: null 
        } 
    ); 

    tabLoadingStates.set( 
        cardsScreen, 
        { 
            loading: false, 
            loaded: false, 
            timer: null 
        } 
    ); 
} 

function finishTabLoading(screen) { 
    const state = 
        tabLoadingStates.get(screen); 

    if (!state) { 
        return; 
    } 

    state.loading = false; 
    state.loaded = true; 

    if (state.timer) { 
        clearTimeout( 
            state.timer 
        ); 

        state.timer = null; 
    } 

    const loader = 
        screen.querySelector( 
            '.tabLoadingScreen' 
        ); 

    if (loader) { 
        loader.classList.add( 
            'hidden' 
        ); 
    } 
} 

function startTabLoading( 
    screen, 
    label, 
    callback 
) { 
    if (!screen) { 
        return; 
    } 

    let state = 
        tabLoadingStates.get(screen); 

    if (!state) { 
        state = { 
            loading: false, 
            loaded: false, 
            timer: null 
        }; 

        tabLoadingStates.set( 
            screen, 
            state 
        ); 
    } 

    const loader = 
        createTabLoadingScreen( 
            screen, 
            label 
        ); 

    if ( 
        state.loaded 
    ) { 
        if (loader) { 
            loader.classList.add( 
                'hidden' 
            ); 
        } 

        if (callback) { 
            callback(); 
        } 

        return; 
    } 

    if ( 
        state.loading 
    ) { 
        return; 
    } 

    state.loading = true; 

    if (loader) { 
        loader.classList.remove( 
            'hidden' 
        ); 
    } 

    state.timer = 
        setTimeout(() => { 
            finishTabLoading(screen); 

            if (callback) { 
                callback(); 
            } 
        }, TAB_LOADING_DURATION); 
} 

function startRngRollLoading(callback) { 
    const loader = 
        createTabLoadingScreen( 
            generateScreen, 
            'Generate' 
        ); 

    if (loader) { 
        loader.classList.remove( 
            'hidden' 
        ); 
    } 

    setTimeout(() => { 
        if (loader) { 
            loader.classList.add( 
                'hidden' 
            ); 
        } 

        if (callback) { 
            callback(); 
        } 
    }, RNG_ROLL_LOADING_DURATION); 
} 

initializeTabLoadingScreens(); 


function showLoadingScreenAndLaunch() {
    if (activityLaunchBlocked || appLaunchStarted) {
        return;
    }

    appLaunchStarted = true;

    if (tosGate) {
        tosGate.classList.add('hidden');
    }

    loadingScreen.classList.remove('hidden');
    mainScreen.classList.add('hidden');
    if (musicToggleButton) {
    musicToggleButton.classList.add('hidden');
}

if (statsButton) {
  statsButton.classList.remove('hidden');
}

   if (activityMusic) {
    activityMusicAllowed = tosMusicApproved;
    activityMusic.muted = !tosMusicApproved;
    activityMusic.volume = 0.25;
    updateActivityMusicButton();

    if (tosMusicApproved) {
        startActivityMusic();
    }
}

   
    initializeActivityNavigationLayout();

    appLaunchTimer = setTimeout(() => {
        appLaunchTimer = null;

        if (activityLaunchBlocked) {
            return;
        }

        loadingScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        statsScreen.classList.remove('hidden');
        statsButton.classList.add('active');
        if (musicToggleButton) {
    musicToggleButton.classList.remove('hidden');
}

statsButton.classList.remove('hidden');
clearRngRarityTheme();

setTimeout(() => {
    enforceRngThemeForActiveScreen();
}, 150);
        updateScrollRail();
        requestCardGameStats();

        if ( 
            rngStoredResultScrollPending && 
            rngResultPanel 
        ) { 
            rngStoredResultScrollPending = 
                false; 

            scrollRngResultIntoView( 
                rngResultPanel.querySelector( 
                    '.rngRecordCard' 
                ) 
            ); 
        } 

        maybePlayRngLaunchFlash();  
    }, 3000);
}

if (tosAgreeButton) {
    tosAgreeButton.addEventListener('click', sendTosRequestAndContinue);
}



function hideAllMainScreens() {
    [generateScreen, leaderboardsScreen, cardsScreen, statsScreen].forEach(screen => {
        if (screen) {
            screen.classList.add('hidden');
            screen.style.display = 'none'; 
        }
    });
}

function setActiveTopButton(button) {
    generateButton.classList.remove('active');
    leaderboardsButton.classList.remove('active');
    cardsButton.classList.remove('active');
    statsButton.classList.remove('active');

    if (button) {
        button.classList.add('active');
    }
}

function updateSecondaryNavigation(screen) {
    const isLeaderboards = screen === leaderboardsScreen;
    const isCards = screen === cardsScreen;

    if (leaderboardsSubnav) {
        leaderboardsSubnav.classList.toggle('hidden', !isLeaderboards);
        leaderboardsSubnav.style.display = isLeaderboards ? '' : 'none';
    }

    if (cardsSubnav) {
        cardsSubnav.classList.toggle('hidden', !isCards);
        cardsSubnav.style.display = isCards ? '' : 'none';
    }

    if (cardsNavigationRow) {
        cardsNavigationRow.style.display = isCards ? 'flex' : 'none';
        cardsNavigationRow.classList.toggle('hidden', !isCards);
    }

    if (collectionStats) {
        collectionStats.classList.toggle('hidden', !isCards);
        collectionStats.style.display = isCards ? 'flex' : 'none';
    }
}

function switchTab(button, screen) {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    setActiveTopButton(button);
    hideAllMainScreens();
    screen.classList.remove('hidden');
    screen.style.display = ''; // Restore active screen display
    updateSecondaryNavigation(screen);

   if (musicToggleButton) {
        musicToggleButton.classList.remove('hidden');
    }

    if (statsButton) {
        statsButton.classList.remove('hidden');
    }

    setTimeout(() => {
        enforceRngThemeForActiveScreen();
    }, 150);

    if (screen === generateScreen) {
        handleRngGenerateTabActivation();
    } else if (screen === leaderboardsScreen) {
        startTabLoading(
            leaderboardsScreen,
            'Leaderboards'
        );

        clearRngRarityTheme();
    } else if (screen === cardsScreen) {
        startTabLoading(
            cardsScreen,
            'Cards'
        );

        clearRngRarityTheme();
    }

    updateScrollRail();
}

function switchToStats() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    setActiveTopButton(statsButton);
    hideAllMainScreens();
    statsScreen.classList.remove('hidden');
    statsScreen.style.display = ''; // Restore stats display
    updateSecondaryNavigation(statsScreen);
    if (musicToggleButton) {
    musicToggleButton.classList.remove('hidden');
}

if (statsButton) {
    statsButton.classList.remove('hidden');
}

clearRngRarityTheme();

setTimeout(() => {
    enforceRngThemeForActiveScreen();
}, 150);
    requestCardGameStats();
    clearRngRarityTheme();
    updateScrollRail();
}

function setSubnavSelection(button, parent, content, viewName, headingText) {
    if (!button || !parent || !content) {
        return;
    }

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    parent.querySelectorAll('button').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
    });

    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    content.dataset.view = viewName;

    let heading = content.querySelector('.subviewHeading');

    if (!heading) {
        heading = document.createElement('h2');
        heading.className = 'subviewHeading';
        content.prepend(heading);
    }

    heading.textContent = headingText;

    if (content === cardsContent) {
        createCollectionStats();
        collectionStats.classList.remove('hidden');

        if (latestCardGameStatsData) {
            updateCardGameCountDisplays(latestCardGameStatsData);
        }
    }

    updateScrollRail();
}

generateButton.addEventListener('click', () => {
    switchTab(generateButton, generateScreen);
});

leaderboardsButton.addEventListener('click', () => {
    switchTab(leaderboardsButton, leaderboardsScreen);
    setSubnavSelection(
        cardsNetWorthButton,
        leaderboardsSubnav,
        leaderboardsContent,
        'cards-net-worth',
        'Cards Net Worth'
    );
});

cardsButton.addEventListener('click', () => {
    switchTab(cardsButton, cardsScreen);
    setSubnavSelection(
        myCollectionButton,
        cardsSubnav,
        cardsContent,
        'my-collection',
        'My Collection'
    );
    switchCardsSubview('collection');
    triggerCollectionTabRequest();
    requestPackOptions(); 
});

statsButton.addEventListener('click', switchToStats);

rngTodayButton.addEventListener('click', () => {
    setSubnavSelection(
        rngTodayButton,
        leaderboardsSubnav,
        leaderboardsContent,
        'rng-today',
        'RNG Today'
    );
});

rngAllTimeButton.addEventListener('click', () => {
    setSubnavSelection(
        rngAllTimeButton,
        leaderboardsSubnav,
        leaderboardsContent,
        'rng-all-time',
        'RNG All Time'
    );
});

cardsNetWorthButton.addEventListener('click', () => {
    setSubnavSelection(
        cardsNetWorthButton,
        leaderboardsSubnav,
        leaderboardsContent,
        'cards-net-worth',
        'Cards Net Worth'
    );
});

dailyPackScoreButton.addEventListener('click', () => {
    setSubnavSelection(
        dailyPackScoreButton,
        leaderboardsSubnav,
        leaderboardsContent,
        'daily-pack-score',
        "This Period's Pack Score"
    );
});

openPackButton.addEventListener('click', () => {
    setSubnavSelection(
        openPackButton,
        cardsSubnav,
        cardsContent,
        'open-pack',
        'Open Pack'
    );
    switchCardsSubview('pack');
    requestPackOptions();
});

myCollectionButton.addEventListener('click', () => {
    setSubnavSelection(
        myCollectionButton,
        cardsSubnav,
        cardsContent,
        'my-collection',
        'My Collection'
    );
    switchCardsSubview('collection');
    triggerCollectionTabRequest();
});

tradesButton.addEventListener('click', () => {
    setSubnavSelection(
        tradesButton,
        cardsSubnav,
        cardsContent,
        'trades',
        'Trades'
    );
});

const scrollRail = document.querySelector('.scrollRail');  

const statsValueElements = {};
let cardGameStatsRequested = false;
let cardGameStatsReceived = false;
let rngRecordsDiscoveredCount = null;
let collectionStats = null;
let collectionCardsDiscoveredValue = null;
let collectionCardsOwnedValue = null;
let latestCardGameStatsData = null;
let cardsNavigationRow = null;

function createCardsNavigationRow() {
    if (!cardsSubnav) {
        return null;
    }

    const currentParent = cardsSubnav.parentElement;

    if (currentParent && currentParent.classList.contains('cardsNavigationRow')) {
        cardsNavigationRow = currentParent;
        return cardsNavigationRow;
    }

    cardsNavigationRow = document.createElement('div');
    cardsNavigationRow.className = 'cardsNavigationRow';
    cardsNavigationRow.style.position = 'relative';
    cardsNavigationRow.style.display = 'flex';
    cardsNavigationRow.style.flexDirection = 'row';
    cardsNavigationRow.style.alignItems = 'center';
    cardsNavigationRow.style.justifyContent = 'center';
    cardsNavigationRow.style.width = '100%';
    cardsNavigationRow.style.minWidth = '0';
    cardsNavigationRow.style.gap = '10px';
    cardsNavigationRow.style.margin = '0 auto 18px';
    cardsNavigationRow.style.boxSizing = 'border-box';

    cardsSubnav.parentNode.insertBefore(cardsNavigationRow, cardsSubnav);
    cardsNavigationRow.appendChild(cardsSubnav);

    if (collectionStats) {
        cardsNavigationRow.appendChild(collectionStats);
    }

    return cardsNavigationRow;
}

function createRngRecordsDiscoveredCount() {
    if (!generateScreen || rngRecordsDiscoveredCount) {
        return;
    }

    rngRecordsDiscoveredCount = document.createElement('div');
    rngRecordsDiscoveredCount.className = 'rngRecordsDiscoveredCount';
    rngRecordsDiscoveredCount.style.color = '#fff';
    rngRecordsDiscoveredCount.textContent = '— out of — records discovered';
    generateScreen.appendChild(rngRecordsDiscoveredCount);

    if (latestCardGameStatsData) {
        updateCardGameCountDisplays(latestCardGameStatsData);
    }
}

function createCollectionStats() {
    if (!cardsContent || collectionStats) {
        return;
    }

    collectionStats = document.createElement('div');
    collectionStats.className = 'collectionStats';
    collectionStats.style.position = 'absolute';
    collectionStats.style.top = '50%';
    collectionStats.style.right = '0';
    collectionStats.style.display = 'flex';
    collectionStats.style.flexDirection = 'column';
    collectionStats.style.alignItems = 'flex-end';
    collectionStats.style.justifyContent = 'center';
    collectionStats.style.gap = '5px';
    collectionStats.style.width = 'clamp(165px, 22vw, 245px)';
    collectionStats.style.maxWidth = '28%';
    collectionStats.style.margin = '0';
    collectionStats.style.padding = '0 2px 4px 8px';
    collectionStats.style.color = '#fff';
    collectionStats.style.fontSize = '12px';
    collectionStats.style.lineHeight = '1.3';
    collectionStats.style.textAlign = 'right';
    collectionStats.style.transform = 'translateY(-50%)';
    collectionStats.style.pointerEvents = 'none';
    collectionStats.style.boxSizing = 'border-box';

    collectionCardsDiscoveredValue = document.createElement('div');
    collectionCardsDiscoveredValue.className = 'collectionCardsDiscovered';
    collectionCardsDiscoveredValue.textContent = '— out of — cards discovered';

    collectionCardsOwnedValue = document.createElement('div');
    collectionCardsOwnedValue.className = 'collectionCardsOwned';
    collectionCardsOwnedValue.textContent = '— out of — cards owned';

    collectionStats.append(
        collectionCardsDiscoveredValue,
        collectionCardsOwnedValue
    );

    const navigationRow = createCardsNavigationRow();

    if (navigationRow) {
        navigationRow.appendChild(collectionStats);
    } else {
        cardsContent.appendChild(collectionStats);
    }

    if (latestCardGameStatsData) {
        updateCardGameCountDisplays(latestCardGameStatsData);
    }

    initializeActivityNavigationLayout();
}

function updateCardGameCountDisplays(statsData) {
    const recordsDiscovered = statsData
        ? statsData.recordsDiscovered
        : undefined;
    const totalRecords = statsData
        ? statsData.totalRecords
        : undefined;

    if (rngRecordsDiscoveredCount) {
        rngRecordsDiscoveredCount.textContent =
            `${formatStatsValue(recordsDiscovered)} out of ${formatStatsValue(totalRecords)} records discovered`;
    }

    if (collectionCardsDiscoveredValue) {
        collectionCardsDiscoveredValue.textContent =
            `${formatStatsValue(statsData ? statsData.cardsDiscovered : undefined)} out of ${formatStatsValue(statsData ? statsData.totalCards : undefined)} cards discovered`;
    }

    if (collectionCardsOwnedValue) {
        collectionCardsOwnedValue.textContent =
            `${formatStatsValue(statsData ? statsData.cardsOwned : undefined)} out of ${formatStatsValue(statsData ? statsData.totalCards : undefined)} cards owned`;
    }
}

function createStatsScreen() {
    if (!statsScreen || statsScreen.dataset.initialized === 'true') {
        return;
    }

    statsScreen.replaceChildren();

    const header = document.createElement('div');
    header.className = 'statsHeader';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'tabEyebrow';
    eyebrow.textContent = 'PROFILE';

    const title = document.createElement('h1');
    title.textContent = 'Stats';

    header.append(eyebrow, title);

    const profile = document.createElement('div');
    profile.className = 'statsProfile';

    const avatar = document.createElement('img');
    avatar.id = 'statsProfileAvatar';
    avatar.className = 'statsProfileAvatar';
    avatar.alt = 'Profile picture';
    avatar.hidden = true;

    const identity = document.createElement('div');
    identity.className = 'statsProfileIdentity';

    const username = document.createElement('h2');
    username.id = 'statsProfileUsername';
    username.textContent = 'Loading profile...';

    identity.appendChild(username);
    profile.append(avatar, identity);

    const grid = document.createElement('div');
    grid.className = 'statsGrid';

    const stats = [
        ['rolls', 'Rolls'],
        ['recordsDiscovered', 'Records Discovered'],
        ['cardsDiscovered', 'Cards Discovered'],
        ['cardsOwned', 'Cards Owned'],
        ['packsOpened', 'Packs Opened'],
        ['tradesCompleted', 'Trades Completed']
    ];

    stats.forEach(([key, label]) => {
        const item = document.createElement('div');
        item.className = 'statsItem';

        const itemLabel = document.createElement('span');
        itemLabel.className = 'statsItemLabel';
        itemLabel.textContent = label;

        const itemValue = document.createElement('span');
        itemValue.className = 'statsItemValue';
        itemValue.textContent = '—';
        itemValue.dataset.stat = key;
        statsValueElements[key] = itemValue;

        item.append(itemLabel, itemValue);
        grid.appendChild(item);
    });

    const support = document.createElement('section');
    support.className = 'statsSupportHint';
    support.style.marginTop = '24px';
    support.style.padding = '16px 18px';
    support.style.border = '1px solid rgba(138, 166, 191, 0.2)';
    support.style.borderRadius = '14px';
    support.style.background = 'rgba(10, 22, 36, 0.55)';
    support.style.color = '#dce7f0';
    support.style.fontSize = '13px';
    support.style.lineHeight = '1.6';
    support.style.textAlign = 'center';

    const supportMessage = document.createElement('p');
    supportMessage.style.margin = '0';
    supportMessage.textContent = "Report problems, give suggestions, and join our storm-chasing team by joining our Discord server, found in the bot's bio.";

    support.appendChild(supportMessage);
    statsScreen.append(header, profile, grid, support);
    statsScreen.dataset.initialized = 'true';
}

function getFirstDefinedValue(source, keys) {
    if (!source || typeof source !== 'object') {
        return undefined;
    }

    for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null) {
            return source[key];
        }
    }

    return undefined;
}

function formatStatsValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toLocaleString();
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const numericValue = Number(value);
        return Number.isFinite(numericValue)
            ? numericValue.toLocaleString()
            : value;
    }

    return '—';
}

function setStatsProfile(profileData) {
    if (!profileData || typeof profileData !== 'object') {
        return;
    }

    const usernameElement = document.getElementById('statsProfileUsername');
    const avatarElement = document.getElementById('statsProfileAvatar');

    const username = getFirstDefinedValue(profileData, [
        'username'
    ]);

    if (usernameElement && typeof username === 'string' && username.trim()) {
        usernameElement.textContent = username;
    }

    const avatarUrl = getFirstDefinedValue(profileData, [
        'avatarUrl'
    ]);

    if (avatarElement && typeof avatarUrl === 'string') {
        try {
            const parsedAvatarUrl = new URL(avatarUrl, window.location.href);

            if (parsedAvatarUrl.protocol === 'https:' || parsedAvatarUrl.protocol === 'http:') {
                avatarElement.src = parsedAvatarUrl.href;
                avatarElement.hidden = false;
                avatarElement.onerror = () => {
                    avatarElement.hidden = true;
                };
            }
        } catch (err) {
            avatarElement.hidden = true;
        }
    }
}

function applyCardGameStats(payload) {
    if (!payload || typeof payload !== 'object') {
        return;
    }

    const profileData =
        payload.profile && typeof payload.profile === 'object'
            ? payload.profile
            : null;

    const statsData =
        payload.stats && typeof payload.stats === 'object'
            ? payload.stats
            : null;

    latestCardGameStatsData = statsData;
    updateCardGameCountDisplays(statsData);
    setStatsProfile(profileData);

    const statKeys = {
        rolls: 'rolls',
        recordsDiscovered: 'recordsDiscovered',
        cardsDiscovered: 'cardsDiscovered',
        cardsOwned: 'cardsOwned',
        packsOpened: 'packsOpened',
        tradesCompleted: 'tradesCompleted'
    };

    Object.entries(statKeys).forEach(([key, field]) => {
        const value = statsData ? statsData[field] : undefined;

        if (statsValueElements[key] && value !== undefined) {
            statsValueElements[key].textContent = formatStatsValue(value);
        }
    });

    cardGameStatsReceived = true;
    updateScrollRail();
}

function handleCardGameStatsMessage(message) {
    if (
        !message ||
        typeof message !== 'object' ||
        message.type !== 'stats_send'
    ) {
        return false;
    }

    if (message.data && typeof message.data === 'object') {
        applyCardGameStats(message.data);
    }

    return true;
}

function requestCardGameStats() {
    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    cardGameStatsRequested = true;

    socket.send(JSON.stringify({
        protocol: 'cardgame',
        version: 1,
        request: 'get_stats'
    }));
}

createStatsScreen();
createRngRecordsDiscoveredCount();
createCardsNavigationRow();
initializeActivityNavigationLayout();
updateSecondaryNavigation(null);

function updateScrollRail() {  
    document.documentElement.style.minHeight = '';  
    document.body.style.minHeight = ''; 

    if (scrollRail) {
        scrollRail.style.height = '0px';
    }

    const activeScreen = [generateScreen, leaderboardsScreen, cardsScreen, statsScreen].find(
        s => s && !s.classList.contains('hidden') && s.style.display !== 'none'
    ) || mainScreen;

    const nav = document.querySelector('.navigation');
    const navHeight = nav ? nav.offsetHeight : 0;
    const activeContentHeight = (activeScreen ? activeScreen.scrollHeight : 0) + navHeight;
    const windowHeight = window.innerHeight;

    if (!scrollRail) {  
        return;  
    }

    const scrollableDistance = Math.max(0, activeContentHeight - windowHeight);

    if (scrollableDistance <= 0) {
        scrollRail.classList.add('hidden');
        scrollRail.style.height = '0px';
        scrollRail.innerHTML = '';
        return;
    }

    const spacing = 250;  
    const edgeInset = 36;  
    const positions = [];  
    const usableHeight = Math.max(0, activeContentHeight - (edgeInset * 2));  

    const indicatorCount = Math.max(1, Math.floor(usableHeight / spacing) + 1);  

    if (indicatorCount === 1) {  
        positions.push(activeContentHeight / 2);  
    } else {  
        for (let i = 0; i < indicatorCount; i++) {  
            positions.push(edgeInset + (i * spacing));  
        }  
    }  

    scrollRail.classList.remove('hidden');
    scrollRail.style.height = `${activeContentHeight}px`;  
    scrollRail.innerHTML = ''; 

    for (let i = 0; i < positions.length; i++) {  
        const indicator = document.createElement('div');  
        indicator.className = 'scrollIndicator';  
        indicator.innerHTML = '<span>→</span><strong>SCROLL</strong><span>←</span>';  
        indicator.style.top = `${positions[i]}px`;  

        if (positions.length === 1) {  
            indicator.classList.add('singleScrollIndicator');  
        } else if (i === 0) {  
            indicator.classList.add('firstScrollIndicator');  
        } else if (i === positions.length - 1) {  
            indicator.classList.add('lastScrollIndicator');  
        }  

        scrollRail.appendChild(indicator);  
    }  
}  

updateScrollRail();  
window.addEventListener('resize', updateScrollRail);
window.addEventListener('resize', initializeActivityNavigationLayout);  

if (typeof ResizeObserver !== 'undefined') {  
    const scrollResizeObserver = new ResizeObserver(() => {  
        updateScrollRail();  
    });  

    scrollResizeObserver.observe(mainScreen);  
    scrollResizeObserver.observe(document.body);  
}  

const tabButtons = document.querySelectorAll('.navigation > #generateButton, .navigation > #leaderboardsButton, .navigation > #cardsButton');  
const buttonShakeStates = new Map(); 
const TAB_BUTTON_NORMAL_WIGGLE_DURATION = 450;  

function startButtonEarthquake(button) {  
    if (buttonShakeStates.has(button)) {  
        return;  
    }  

    const state = {  
        active: true,  
        animationFrame: null,  
        startedAt: performance.now(),  
        normalWiggleActive: true  
    };  

    buttonShakeStates.set(button, state);  
    button.classList.add('normalButtonWiggle');  

    function shakeFrame(now) {  
        if (!state.active) {  
            return;  
        }  

        const elapsed = now - state.startedAt;  
        let x = 0;  
        let y = 0;  
        let angle = 0;  

        if (elapsed < TAB_BUTTON_NORMAL_WIGGLE_DURATION) {  
            state.animationFrame = requestAnimationFrame(shakeFrame);  
            return;  
        }  

        if (state.normalWiggleActive) {  
            state.normalWiggleActive = false;  
            button.classList.remove('normalButtonWiggle');  
        }  

        const earthquakeElapsed =  
            elapsed - TAB_BUTTON_NORMAL_WIGGLE_DURATION;  

        if (earthquakeElapsed < 5000) {  
            const progress = Math.min(earthquakeElapsed / 5000, 1);  
            const tilt = 0.2 + progress * 1.3;  
            angle = Math.sin(earthquakeElapsed / 140) * tilt;  
        } else {  
            const progress = Math.min((earthquakeElapsed - 5000) / 5000, 1);  
            const intensity = 0.25 + progress * 0.75;  
            x = (Math.random() - 0.5) * 1.35 * intensity;  
            y = (Math.random() - 0.5) * 1.35 * intensity;  
            angle = (Math.random() - 0.5) * 0.3 * intensity;  
        }  

        button.style.transform =  
            `translate(${x}px, ${y}px) rotate(${angle}deg)`;  

        state.animationFrame = requestAnimationFrame(shakeFrame);  
    }  

    state.animationFrame = requestAnimationFrame(shakeFrame);  
}  

function stopButtonEarthquake(button) {  
    const state = buttonShakeStates.get(button);  
    if (!state) {  
        return;  
    }  

    state.active = false;  

    if (state.animationFrame) {  
        cancelAnimationFrame(state.animationFrame);  
    }  

    button.classList.remove('normalButtonWiggle');  
    button.style.transform = '';  
    buttonShakeStates.delete(button);  
}  

function playButtonAnimation(button) {  
    stopButtonEarthquake(button);  

    button.querySelectorAll('.buttonEffectImage').forEach(image => {  
        image.remove();  
    });  

    button.classList.remove('clickJerk');  

    void button.offsetWidth;  

    button.classList.add('clickJerk');  

    const car = document.createElement('img');  
    car.className = 'buttonEffectImage carEffect';  
    car.src = './carvector.png';  
    car.alt = '';  

    const tornado = document.createElement('img');  
    tornado.className = 'buttonEffectImage tornadoEffect';  
    tornado.src = './tornadovector.png';  
    tornado.alt = '';  

    button.appendChild(car);  
    button.appendChild(tornado);  

    button.addEventListener('animationend', () => {  
        button.classList.remove('clickJerk');  
    }, { once: true });  

    tornado.addEventListener('animationend', () => {  
        car.remove();  
        tornado.remove();  
    }, { once: true });  
}  

tabButtons.forEach(button => {  
    button.addEventListener('pointerenter', () => {  
        startButtonEarthquake(button);  
    });  

    button.addEventListener('pointerleave', () => {  
        stopButtonEarthquake(button);  
    });  

    button.addEventListener('click', () => {  
        playButtonAnimation(button);  
    });  
    
});  
function playTopBarButtonJerk(button) {
    button.classList.remove('simpleButtonJerk');
    void button.offsetWidth;
    button.classList.add('simpleButtonJerk');

    button.addEventListener('animationend', event => {
        if (
            event.target === button &&
            event.animationName === 'simpleButtonJerk'
        ) {
            button.classList.remove('simpleButtonJerk');
        }
    }, { once: true });
}

[musicToggleButton, statsButton].forEach(button => {
    if (!button) {
        return;
    }

    button.addEventListener('click', () => {
        playTopBarButtonJerk(button);
    });
});
function startNormalButtonWiggle(button) {  
    if (!button || button.classList.contains('tabButton')) {  
        return;  
    }  

    button.classList.add('normalButtonWiggle');  
}  

function stopNormalButtonWiggle(button) {  
    if (!button) {  
        return;  
    }  

    button.classList.remove('normalButtonWiggle');  
}  

const RNG_RARITY_COLORS = {  
    uncommon: "#94a3b8",      // grey
    common: "#22c55e",        // green
    rare: "#38bdf8",          // light blue
    epic: "#c084fc",          // stealth purple
    legendary: "#facc15",     // gold / yellow
    mythical: "#ef4444",      // red
    celestial: "#60a5fa",     // blue
    divine: "#a3e635",        // lime green
    transcendent: "#ff5599",  // rainbow accent
    cosmic: "#a855f7",        // purple-black
    omnipotent: "#ffffff"     // white-black
};  

const RNG_RARITY_GRADIENTS = { 
    uncommon: `linear-gradient(135deg, #242e3b 0%, #151c24 100%)`,     // visible slate grey
    common: `linear-gradient(135deg, #143522 0%, #0c2014 100%)`,       // rich forest green
    rare: `linear-gradient(135deg, #143554 0%, #0c2035 100%)`,         // deep sapphire blue
    epic: `linear-gradient(135deg, #351c52 0%, #1e0f30 100%)`,         // rich midnight purple
    legendary: `linear-gradient(135deg, #422d0d 0%, #251906 100%)`,    // warm bronze gold
    mythical: `linear-gradient(135deg, #401414 0%, #240909 100%)`,     // deep ruby red
    celestial: `linear-gradient(135deg, #162952 0%, #0d1833 100%)`,    // stellar deep blue
    divine: `linear-gradient(135deg, #283a12 0%, #172208 100%)`,       // deep moss olive
    // Multi-color special tiers:
    transcendent: `linear-gradient(135deg, #ff0055 0%, #ff7700 20%, #ffea00 40%, #00e676 60%, #00b0ff 80%, #aa00ff 100%)`, // Rainbow
    cosmic: `linear-gradient(135deg, #6b21a8 0%, #4c1d95 30%, #2e1065 60%, #13032a 85%, #05000d 100%)`,                     // Purple-Black
    omnipotent: `linear-gradient(135deg, #ffffff 0%, #9ca3af 25%, #374151 55%, #111827 80%, #000000 100%)`                  // White-Black
};
const RNG_RARITY_THEME_CLASSES = [ 
    'rng-rarity-uncommon', 
    'rng-rarity-common', 
    'rng-rarity-rare', 
    'rng-rarity-epic', 
    'rng-rarity-legendary', 
    'rng-rarity-mythical', 
    'rng-rarity-celestial', 
    'rng-rarity-divine', 
    'rng-rarity-transcendent', 
    'rng-rarity-cosmic', 
    'rng-rarity-omnipotent' 
];

const RNG_RANDOM_CHARACTERS = 
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"; 



const RNG_SCRAMBLE_DURATION = 5000; 
const RNG_APPEAR_DURATION = 700; 
const RNG_SCRAMBLE_TICK = 50; 
const RNG_POP_INTERVAL = 400; 
const RNG_POP_DURATION = 650; 
const RNG_LIFETIME_ROLL_DELAY = 3000; 
const RNG_LIFETIME_FADE_DURATION = 260; 
const RNG_LIFETIME_ROLL_DURATION = 2000; 
const RNG_LIFETIME_DIGIT_STAGGER = 0; 
const RNG_LIFETIME_VISIBLE_STEPS = 1; 
const RNG_RECORD_WIGGLE_DURATION = 30000; 
const RNG_RECORD_WIGGLE_AMPLITUDE = 8; 
const RNG_RECORD_WIGGLE_ROTATION = 3; 
const RNG_RECORD_FINISH_FLASH_DELAY = 1000; 

let rngRequestPending = false;  
let rngRollLoadingPending = false;  
let rngResultPanel = null;  
let rngScrambleElement = null; 
let rngScrambleTimer = null;  
let rngScrambleProgressTimer = null;  
let rngCountdownTimer = null;  
let rngDailyStatus = null;  
let rngDailyMessage = null;  
let rngDailyCountdown = null;  
let rngDailyActionArea = null;  
let rngTopControlArea = null; 
let rngControlSlot = null; 
let rngServerTimeBase = null;  
let rngPerformanceTimeBase = null;  
let rngNextResetTimestamp = null;  
let rngLocalRollState = null;  
let rngFrontendInitialized = false;  
let rngLaunchFlashPending = false; 
let rngPendingLifetimeScore = null; 
let rngLifetimeAnimationActive = false; 
let rngLifetimeRollTimer = null; 
let rngLifetimeAnimationFrames = []; 
let rngRecordCardWiggleFrame = null; 
let rngStoredResultScrollPending = false; 
let rngPeriodStatus = "green";
let cardsPeriodStatus = "green";
let nextCardsResetTimestamp = null;
let currentRngPeriodNumber = 1;
let currentCardsPeriodNumber = 1;

function getRandomRngCharacter() {  
    const index = Math.floor(  
        Math.random() * RNG_RANDOM_CHARACTERS.length  
    );  

    return RNG_RANDOM_CHARACTERS[index];  
}  

function syncRngServerClock(  
    serverTime,  
    nextReset,
    periodsData = null,
    nextCardsReset = null
) {  
    if (  
        typeof serverTime !== 'number' ||  
        !Number.isFinite(serverTime) ||  
        !nextReset ||  
        typeof nextReset.timestamp !== 'number' ||  
        !Number.isFinite(nextReset.timestamp)  
    ) {  
        return;  
    }  

    rngServerTimeBase = serverTime;  
    rngPerformanceTimeBase = performance.now();  
    rngNextResetTimestamp = nextReset.timestamp; 

    if (nextCardsReset && typeof nextCardsReset.timestamp === 'number') {
        nextCardsResetTimestamp = nextCardsReset.timestamp;
    }

    if (periodsData && typeof periodsData === 'object') {
        if (periodsData.rng) {
            rngPeriodStatus = String(periodsData.rng.status || 'green').toLowerCase().trim();
            currentRngPeriodNumber = periodsData.rng.currentPeriod || 1;
        }
        if (periodsData.cards) {
            cardsPeriodStatus = String(periodsData.cards.status || 'green').toLowerCase().trim();
            currentCardsPeriodNumber = periodsData.cards.currentPeriod || 1;
        }
    }

    if (!rngFrontendInitialized) {  
        rngLocalRollState = loadLocalRngRollState();  
        initializeRngFrontend();  
    }  

    updateRngDailyCountdown();  
    maybePlayRngLaunchFlash();  
}

function getRngServerNow() {  
    if (  
        typeof rngServerTimeBase !== 'number' ||  
        typeof rngPerformanceTimeBase !== 'number'  
    ) {  
        return null;  
    }  

    return (  
        rngServerTimeBase + 
        ( 
            performance.now() - 
            rngPerformanceTimeBase 
        ) 
    ); 
} 

function formatRngCountdown(milliseconds) { 
    const totalSeconds = Math.max( 
        0, 
        Math.ceil(milliseconds / 1000) 
    ); 

    const hours = Math.floor( 
        totalSeconds / 3600 
    ); 

    const minutes = Math.floor( 
        (totalSeconds % 3600) / 60 
    ); 

    const seconds = 
        totalSeconds % 60; 

    return [ 
        String(hours).padStart(2, '0'), 
        String(minutes).padStart(2, '0'), 
        String(seconds).padStart(2, '0') 
    ].join(':'); 
} 

function sanitizeRngStoredResult(payload) { 
    if ( 
        !payload || 
        typeof payload !== 'object' 
    ) { 
        return null; 
    } 

    return { 
        record: payload.record ?? '', 
        rarity: payload.rarity ?? 'Unknown', 
        finalRarity: payload.finalRarity ?? payload.final_rarity ?? null,
        baseRarity: payload.baseRarity ?? payload.rarity ?? null,
        points: payload.points ?? '0', 
        lifetimeRecordScore: 
            payload.lifetimeRecordScore ?? 
            payload.lifetimeScore ?? 
            payload.lifetime_record_score ?? 
            '0', 
        timesRolled: 
            payload.timesRolled ?? 
            payload.times_rolled ?? 
            1, 
        duplicateRoll: 
            isRngDuplicatePayload(payload), 
        modifiers: payload.modifiers ?? [],
        overallRarityRequirements: payload.overallRarityRequirements ?? null
    }; 
}
function isRngDuplicatePayload(payload) { 
    if ( 
        !payload || 
        typeof payload !== 'object' 
    ) { 
        return false; 
    } 

    const duplicateValue = 
        payload.duplicateRoll ?? 
        payload.duplicate_roll ?? 
        payload.isDuplicate ?? 
        payload.is_duplicate ?? 
        payload.duplicate; 

    return ( 
        duplicateValue === true || 
        duplicateValue === 1 || 
        ( 
            typeof duplicateValue === 'string' && 
            ['true', 'yes', 'duplicate', '1'].includes( 
                duplicateValue.trim().toLowerCase() 
            ) 
        ) 
    ); 
} 

function loadLocalRngRollState() { 
    try { 
        const stored = 
            localStorage.getItem( 
                RNG_LOCAL_ROLL_STORAGE_KEY 
            ); 

        if (!stored) { 
            return null; 
        } 

        const numericTimestamp = 
            Number(stored); 

        if ( 
            Number.isFinite( 
                numericTimestamp 
            ) 
        ) { 
            return { 
                nextRollTimestamp: 
                    numericTimestamp 
            }; 
        } 

        const payload = 
            JSON.parse(stored); 

        if ( 
            !payload || 
            typeof payload !== 'object' 
        ) { 
            localStorage.removeItem( 
                RNG_LOCAL_ROLL_STORAGE_KEY 
            ); 

            return null; 
        } 

        const nextRollTimestamp = 
            Number( 
                payload.nextRollTimestamp 
            ); 

        if ( 
            !Number.isFinite( 
                nextRollTimestamp 
            ) 
        ) { 
            localStorage.removeItem( 
                RNG_LOCAL_ROLL_STORAGE_KEY 
            ); 

            return null; 
        } 

        const lastRollTimestamp = 
            Number( 
                payload.lastRollTimestamp 
            ); 

        if ( 
            Number.isFinite( 
                lastRollTimestamp 
            ) 
        ) { 
            return { 
                nextRollTimestamp, 
                lastRollTimestamp 
            }; 
        } 

        return { 
            nextRollTimestamp 
        }; 
    } catch (err) { 
        return null; 
    } 
} 

function saveLocalRngRollState(payload) { 
    if ( 
        !payload || 
        typeof payload.nextRollTimestamp !== 'number' || 
        !Number.isFinite(payload.nextRollTimestamp) 
    ) { 
        return; 
    } 

    const lastRollTimestamp = 
        typeof payload.lastRollTimestamp === 'number' && 
        Number.isFinite(payload.lastRollTimestamp) 
            ? payload.lastRollTimestamp 
            : ( 
                typeof rngLocalRollState?.lastRollTimestamp === 'number' && 
                Number.isFinite(rngLocalRollState.lastRollTimestamp) 
                    ? rngLocalRollState.lastRollTimestamp 
                    : null 
            ); 

    rngLocalRollState = { 
        nextRollTimestamp: 
            payload.nextRollTimestamp 
    }; 

    if ( 
        lastRollTimestamp !== null 
    ) { 
        rngLocalRollState.lastRollTimestamp = 
            lastRollTimestamp; 
    } 

    try { 
        localStorage.setItem( 
            RNG_LOCAL_ROLL_STORAGE_KEY, 
            JSON.stringify( 
                rngLocalRollState 
            ) 
        ); 
    } catch (err) { 
    } 
} 

function clearLocalRngRollState() { 
    rngLocalRollState = null; 

    try { 
        localStorage.removeItem( 
            RNG_LOCAL_ROLL_STORAGE_KEY 
        ); 
    } catch (err) { 
    } 
} 

function loadLocalRngResult() { 
    try { 
        const stored = 
            localStorage.getItem( 
                RNG_LOCAL_RESULT_STORAGE_KEY 
            ); 

        if (!stored) { 
            return null; 
        } 

        const payload = 
            JSON.parse(stored); 

        return sanitizeRngStoredResult( 
            payload 
        ); 
    } catch (err) { 
        return null; 
    } 
} 

function saveLocalRngResult(payload) { 
    const sanitized = 
        sanitizeRngStoredResult( 
            payload 
        ); 

    if (!sanitized) { 
        return; 
    } 

    try { 
        localStorage.setItem( 
            RNG_LOCAL_RESULT_STORAGE_KEY, 
            JSON.stringify( 
                sanitized 
            ) 
        ); 
    } catch (err) { 
    } 
} 

function clearLocalRngResult() { 
    try { 
        localStorage.removeItem( 
            RNG_LOCAL_RESULT_STORAGE_KEY 
        ); 
    } catch (err) { 
    } 
} 

function getRngNextRollTimestamp() { 
    return rngLocalRollState?.nextRollTimestamp ?? 
        null; 
} 

function isRngCooldownActive() { 
  
    if (rngPeriodStatus === "red") {
        const serverNow = getRngServerNow();
        if (
            typeof serverNow === 'number' &&
            typeof rngNextResetTimestamp === 'number' &&
            serverNow >= rngNextResetTimestamp
        ) {
            return false;
        }
        return true;
    }

    return false;
}

function createRngTopControlArea() { 
    if (rngTopControlArea) { 
        return; 
    } 

    rngTopControlArea = 
        document.createElement('div'); 

    rngTopControlArea.className = 
        'rngTopControlArea'; 

    rngTopControlArea.style.height = 
        'auto'; 

    rngTopControlArea.style.minHeight = 
        '86px'; 

    rngTopControlArea.style.display = 
        'flex'; 

    rngTopControlArea.style.flexDirection = 
        'column'; 

    rngTopControlArea.style.alignItems = 
        'center'; 

    rngTopControlArea.style.justifyContent = 
        'flex-start'; 

    rngTopControlArea.style.overflow = 
        'visible'; 

    rngControlSlot = 
        document.createElement('div'); 

    rngControlSlot.className = 
        'rngControlSlot'; 

    rngControlSlot.style.width = 
        '350px'; 

    rngControlSlot.style.minWidth = 
        '350px'; 

    rngControlSlot.style.maxWidth = 
        '350px'; 

    rngControlSlot.style.height = 
        '86px'; 

    rngControlSlot.style.minHeight = 
        '86px'; 

    rngControlSlot.style.display = 
        'flex'; 

    rngControlSlot.style.alignItems = 
        'center'; 

    rngControlSlot.style.justifyContent = 
        'center'; 

    rngControlSlot.style.flexShrink = 
        '0'; 

    rngTopControlArea.appendChild( 
        rngControlSlot 
    ); 

    generateScreen.appendChild( 
        rngTopControlArea 
    );

    createRngRecordsDiscoveredCount();
} 

function createRngDailyStatus() {  
    if (rngDailyStatus) {  
        return;  
    }  

    createRngTopControlArea(); 

    rngDailyStatus =  
        document.createElement('div');  

    rngDailyStatus.className =  
        'rngDailyStatus';  

    rngDailyStatus.style.color = 
        '#8a8f94'; 

    rngDailyMessage =  
        document.createElement('div');  

    rngDailyMessage.className =  
        'rngDailyMessage';  

    rngDailyMessage.style.color = 
        '#8a8f94'; 

    rngDailyMessage.textContent =  
        'You have already rolled for this period';  

    rngDailyCountdown =  
        document.createElement('div');  

    rngDailyCountdown.className =  
        'rngDailyCountdown';  

    rngDailyCountdown.style.color = 
        '#8a8f94'; 

    rngDailyStatus.appendChild(  
        rngDailyMessage  
    );  

    rngDailyStatus.appendChild(  
        rngDailyCountdown  
    );  

    rngControlSlot.appendChild(  
        rngDailyStatus  
    );  
}  

function updateRngDailyCountdown() {  
    const serverNow = getRngServerNow(); 

    if ( 
        typeof serverNow !== 'number' || 
        !Number.isFinite(serverNow) 
    ) { 
        stopRngDailyCountdown(); 
        hideRngDailyStatus(); 
        return false; 
    } 

    if (!isRngCooldownActive()) { 
        stopRngDailyCountdown(); 
        hideRngDailyStatus(); 

        if (rngResultPanel && rngPeriodStatus === "green") { 
            clearRngLifetimeAnimation(); 
            clearRngRecordCardWiggle(); 
            rngResultPanel.remove(); 
            rngResultPanel = null; 
        } 

        if (rngScrambleElement) { 
            rngScrambleElement.remove(); 
            rngScrambleElement = null; 
        } 

        clearLocalRngResult(); 
        clearLocalRngRollState(); 
        clearRngRarityTheme(); 

        if ( 
            !rngRequestPending && 
            !rngRollLoadingPending 
        ) { 
            initializeRngGenerateButton(); 
        } 

        return false; 
    } 

    const remaining = 
        typeof rngNextResetTimestamp === 'number'
            ? rngNextResetTimestamp - serverNow
            : 0; 

    if (remaining <= 0) { 
        stopRngDailyCountdown(); 

        rngPeriodStatus = "green";
        requestRngServerTime();

        clearLocalRngRollState(); 
        clearLocalRngResult(); 
        hideRngDailyStatus(); 
        clearRngRarityTheme(); 

        if (rngResultPanel) { 
            clearRngLifetimeAnimation(); 
            clearRngRecordCardWiggle(); 
            rngResultPanel.remove(); 
            rngResultPanel = null; 
        } 

        if (rngScrambleElement) { 
            rngScrambleElement.remove(); 
            rngScrambleElement = null; 
        } 

        if ( 
            !rngRequestPending && 
            !rngRollLoadingPending 
        ) { 
            initializeRngGenerateButton(); 
        } 

        return false; 
    } 

    createRngDailyStatus(); 

    rngDailyMessage.textContent = 
        'You have already rolled for this period'; 

    rngDailyCountdown.textContent = 
        `Next roll in ${formatRngCountdown(remaining)}`; 

    rngDailyMessage.style.color = '#8a8f94'; 
    rngDailyCountdown.style.color = '#8a8f94'; 

    showRngDailyStatus(); 
    startRngDailyCountdown(); 

    return true; 
}

function startRngDailyCountdown() {  
    stopRngDailyCountdown(); 

    rngCountdownTimer = 
        setInterval(() => { 
            updateRngDailyCountdown(); 
        }, 1000); 
}  

function stopRngDailyCountdown() {  
    if (!rngCountdownTimer) {  
        return;  
    }  

    clearInterval(  
        rngCountdownTimer  
    );  

    rngCountdownTimer = null;  
}  

function hideRngDailyStatus() {  
    if (!rngDailyStatus) {  
        return;  
    }  

    rngDailyStatus.classList.add(  
        'hidden'  
    );  
}  

function showRngDailyStatus() {  
    if (!rngDailyStatus) { 
        return; 
    } 

    rngDailyStatus.classList.remove( 
        'hidden' 
    ); 
}  

function clearRngRarityTheme() { 
    if (!document.body) { 
        return; 
    } 

    RNG_RARITY_THEME_CLASSES.forEach(className => { 
        document.body.classList.remove(className); 
    }); 

    document.body.style.background = ''; 
} 

function enforceRngThemeForActiveScreen() {
    if (
        !generateScreen ||
        generateScreen.classList.contains('hidden')
    ) {
        clearRngRarityTheme();
    }
}

function normalizeRngRarity(rarity) { 
    if (typeof rarity !== 'string') { 
        return 'unknown'; 
    } 

    const normalized = rarity.trim().toLowerCase(); 

    if (!RNG_RARITY_COLORS[normalized]) { 
        return 'unknown'; 
    } 

    return normalized; 
} 

function getRngDisplayRarity(payload) { 
    if (!payload || typeof payload !== 'object') {
        return 'unknown';
    }

    if (payload.finalRarity && typeof payload.finalRarity === 'string') {
        return normalizeRngRarity(payload.finalRarity);
    }
    if (payload.final_rarity && typeof payload.final_rarity === 'string') {
        return normalizeRngRarity(payload.final_rarity);
    }

    if (Array.isArray(payload.overallRarityRequirements) && payload.overallRarityRequirements.length > 0) {
        const basePts = Number(payload.points) || 0;
        const modPts = Number(payload.modifierPoints) || (
            Array.isArray(payload.modifiers)
                ? payload.modifiers.reduce((sum, m) => sum + (Number(m.points) || 0), 0)
                : 0
        );
        const totalPoints = basePts + modPts;

        let computed = 'common';
        for (const tier of payload.overallRarityRequirements) {
            if (totalPoints >= (tier.minPoints ?? 0)) {
                computed = tier.rarity;
            }
        }
        return normalizeRngRarity(computed);
    }

    return 'common';
}

function applyRngRarityTheme(rarity) { 
    if (
    !generateScreen ||
    generateScreen.classList.contains('hidden')
) {
    clearRngRarityTheme();
    return 'unknown';
}
    clearRngRarityTheme(); 

    const normalized = normalizeRngRarity(rarity); 

    if ( 
        normalized !== 'unknown' 
    ) { 
        document.body.classList.add( 
            `rng-rarity-${normalized}` 
        ); 

        if ( 
            RNG_RARITY_GRADIENTS[normalized] 
        ) { 
            document.body.style.background = 
                RNG_RARITY_GRADIENTS[normalized]; 
        } 
    } 

    return normalized; 
} 

function getRngRarityGradient(rarity) { 
    const normalized = 
        normalizeRngRarity( 
            rarity 
        ); 

    return ( 
        RNG_RARITY_GRADIENTS[normalized] ?? 
        '' 
    ); 
} 

function playRngLaunchFlash() {  
    const existingFlash =  
        document.querySelector(  
            '.rngLaunchFlash'  
        );  

    if (existingFlash) {  
        existingFlash.remove();  
    }  

    const flash =  
        document.createElement('div');  

    flash.className =  
        'rngLaunchFlash';  

    document.body.appendChild(  
        flash  
    );  

    flash.addEventListener(  
        'animationend',  
        () => {  
            flash.remove();  
        },  
        { once: true }  
    );  
}  

function requestRngLaunchFlash() { 
    rngLaunchFlashPending = true; 
    maybePlayRngLaunchFlash(); 
} 

function maybePlayRngLaunchFlash() {  
    if (  
        !rngLaunchFlashPending ||  
        !mainScreen ||  
        mainScreen.classList.contains('hidden')  
    ) {  
        return;  
    }  

    rngLaunchFlashPending = false;  
    playRngLaunchFlash();  
} 

function scrollRngResultIntoView(element) { 
    if (!element) { 
        return; 
    } 

    requestAnimationFrame(() => { 
        element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start', 
            inline: 'nearest'
        }); 
    }); 
} 

function clearRngRecordCardWiggle() { 
    if ( 
        rngRecordCardWiggleFrame 
    ) { 
        cancelAnimationFrame( 
            rngRecordCardWiggleFrame 
        ); 

        rngRecordCardWiggleFrame = 
            null; 
    } 
} 

function startRngRecordCardWiggle( 
    card 
) { 
    if (!card) { 
        return; 
    } 

    clearRngRecordCardWiggle(); 

    const startedAt = 
        performance.now(); 

    function wiggleFrame(now) { 
        if ( 
            !card.isConnected 
        ) { 
            rngRecordCardWiggleFrame = 
                null; 

            return; 
        } 

        const elapsed = 
            now - 
            startedAt; 

        const cycleAngle = 
            (elapsed / 
                RNG_RECORD_WIGGLE_DURATION) * 
            Math.PI * 
            2; 

        const wave = 
            Math.sin( 
                cycleAngle 
            ); 

        const secondaryWave = 
            Math.sin( 
                cycleAngle * 
                    2 + 
                    Math.PI / 
                        2 
            ); 

        const x = 
            wave * 
            RNG_RECORD_WIGGLE_AMPLITUDE; 

        const y = 
            secondaryWave * 
            1.8; 

        const rotation = 
            wave * 
            RNG_RECORD_WIGGLE_ROTATION; 

        card.style.transform = 
            `translate(${x}px, ${y}px) rotate(${rotation}deg)`; 

        rngRecordCardWiggleFrame = 
            requestAnimationFrame( 
                wiggleFrame 
            ); 
    } 

    rngRecordCardWiggleFrame = 
        requestAnimationFrame( 
            wiggleFrame 
        ); 
} 

function handleRngGenerateTabActivation() { 
    if ( 
        !generateScreen || 
        generateScreen.classList.contains('hidden') 
    ) { 
        return; 
    } 

    if ( 
        rngResultPanel 
    ) { 
        const card = 
            rngResultPanel.querySelector( 
                '.rngRecordCard' 
            ); 

        if (card) { 
            const activeTheme = RNG_RARITY_THEME_CLASSES.find(cls => card.classList.contains(cls));
            if (activeTheme) {
                applyRngRarityTheme(activeTheme.replace('rng-rarity-', ''));
            } else {
                applyRngRarityTheme('unknown');
            }
        } 

        return; 
    } 

    if (rngScrambleElement) { 
        return; 
    } 

    updateRngDailyCountdown(); 

    if ( 
        !rngRequestPending && 
        !rngRollLoadingPending 
    ) { 
        initializeRngGenerateButton(); 
    } 
}

function startRngCardFinishEffects(card) {
    if (
        !card ||
        !card.isConnected ||
        card.dataset.rngCardFinishStarted === 'true'
    ) {
        return;
    }

    card.dataset.rngCardFinishStarted = 'true';

    card.classList.remove(
        'rngResultPopIn'
    );

    card.style.opacity =
        '1';

    card.style.transform =
        'none';

    void card.offsetWidth;

    startRngRecordCardWiggle(
        card
    );

    window.setTimeout(
        () => {
            if (
                !card.isConnected
            ) {
                return;
            }

            playRngLaunchFlash();

            card.classList.remove(
                'rngRecordCardFinalPop'
            );

            void card.offsetWidth;

            const finishPopHandler = event => {
                if (
                    event.animationName !==
                    'rngRecordCardFinalPop'
                ) {
                    return;
                }

                card.classList.remove(
                    'rngRecordCardFinalPop'
                );

                card.style.opacity =
                    '1';

                card.removeEventListener(
                    'animationend',
                    finishPopHandler
                );
            };

            card.addEventListener(
                'animationend',
                finishPopHandler
            );

            card.classList.add(
                'rngRecordCardFinalPop'
            );
        },
        RNG_RECORD_FINISH_FLASH_DELAY
    );
}

function scheduleRngDuplicateReveal(card) {
    if (!card) {
        return;
    }

    const duplicateOverlay =
        card.querySelector(
            '.rngDuplicateOverlay'
        );

    const modifiersTitle =
        card.querySelector(
            '.rngModifiersTitle'
        );

    const modifierCards =
        card.querySelectorAll(
            '.rngModifier'
        );

    const lastModifier =
        modifierCards.length > 0
            ? modifierCards[modifierCards.length - 1]
            : null;

    const revealTrigger =
        lastModifier || modifiersTitle;

    if (
        !duplicateOverlay ||
        card.dataset.rngDuplicateRevealScheduled === 'true'
    ) {
        return;
    }

    card.dataset.rngDuplicateRevealScheduled = 'true';

    const duplicateText =
        duplicateOverlay.querySelector(
            '.rngDuplicateText'
        );

    const startDuplicateRevealTimer = () => {
        if (
            card.dataset.rngDuplicateRevealTimerStarted === 'true'
        ) {
            return;
        }

        card.dataset.rngDuplicateRevealTimerStarted = 'true';

        window.setTimeout(
            () => {
                if (
                    !duplicateOverlay.isConnected
                ) {
                    return;
                }

                const handleDuplicatePopInFinished = event => {
                    if (
                        event.animationName !==
                        'rngDuplicateStampPopIn'
                    ) {
                        return;
                    }

                    duplicateText.removeEventListener(
                        'animationend',
                        handleDuplicatePopInFinished
                    );

                    startRngCardFinishEffects(
                        card
                    );
                };

                if (duplicateText) {
                    duplicateText.addEventListener(
                        'animationend',
                        handleDuplicatePopInFinished
                    );
                } else {
                    window.setTimeout(
                        () => {
                            startRngCardFinishEffects(
                                card
                            );
                        },
                        1000
                    );
                }

                duplicateOverlay.classList.add(
                    'rngDuplicateVisible'
                );
            },
            4000
        );
    };

    if (!revealTrigger) {
        startDuplicateRevealTimer();
        return;
    }

    revealTrigger.addEventListener(
        'animationend',
        event => {
            if (
                event.animationName !==
                'rngResultPopIn'
            ) {
                return;
            }

            startDuplicateRevealTimer();
        }
    );
}
let discoverAudioCtx = null;
let discoverGainNode = null;

function setupDiscoverSoundVolumeBoost() {
    if (!discoverSound || discoverGainNode) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        discoverAudioCtx = new AudioCtx();
        const source = discoverAudioCtx.createMediaElementSource(discoverSound);
        discoverGainNode = discoverAudioCtx.createGain();
        discoverGainNode.gain.value = 1.5;
        source.connect(discoverGainNode);
        discoverGainNode.connect(discoverAudioCtx.destination);
    } catch (err) {
    }
}

function fadeAudioVolume(audio, targetVolume, durationMs, onComplete) {
    if (!audio) return;
    const startVolume = audio.volume;
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        audio.volume = Math.max(0, Math.min(1, startVolume + (targetVolume - startVolume) * progress));

        if (progress < 1) {
            requestAnimationFrame(step);
        } else if (onComplete) {
            onComplete();
        }
    }
    requestAnimationFrame(step);
}



function setupDiscoverSoundVolumeBoost() {
    if (!discoverSound || discoverGainNode) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        discoverAudioCtx = new AudioCtx();
        const source = discoverAudioCtx.createMediaElementSource(discoverSound);
        discoverGainNode = discoverAudioCtx.createGain();
        discoverGainNode.gain.value = 1.6; 
        source.connect(discoverGainNode);
        discoverGainNode.connect(discoverAudioCtx.destination);
    } catch (err) {}
}

function fadeAudioVolume(audio, targetVolume, durationMs, onComplete) {
    if (!audio) return;
    const startVolume = audio.volume;
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        audio.volume = Math.max(0, Math.min(1, startVolume + (targetVolume - startVolume) * progress));

        if (progress < 1) {
            requestAnimationFrame(step);
        } else if (onComplete) {
            onComplete();
        }
    }
    requestAnimationFrame(step);
}

function showNewRecordDiscoveredBanner() {
    const existing = document.querySelector('.rngNewDiscoveryBanner');
    if (existing) {
        existing.remove();
    }

    const banner = document.createElement('div');
    banner.className = 'rngNewDiscoveryBanner';
    banner.textContent = '★ NEW RECORD DISCOVERED! ★';
    generateScreen.appendChild(banner);

    const isMuted = !activityMusic || activityMusic.muted;

    if (!isMuted && activityMusicStarted) {
        fadeAudioVolume(activityMusic, 0, 150);
    }

    setTimeout(() => {
        if (discoverSound) {
            setupDiscoverSoundVolumeBoost();
            if (discoverAudioCtx && discoverAudioCtx.state === 'suspended') {
                discoverAudioCtx.resume();
            }

            discoverSound.playbackRate = 0.88; 

            if (isMuted || (activityMusic && activityMusic.muted)) {
                discoverSound.muted = true;
                discoverSound.volume = 0;
            } else {
                discoverSound.muted = false;
                discoverSound.volume = 1.0;
            }

            discoverSound.currentTime = 0;
            const playPromise = discoverSound.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }

            discoverSound.onended = () => {
                setTimeout(() => {
                    if (activityMusic && !activityMusic.muted && activityMusicStarted) {
                        fadeAudioVolume(activityMusic, 0.25, 400);
                    }
                }, 500); 
            };
        }
    }, 450);

    setTimeout(() => {
        if (activityMusic && !activityMusic.muted && activityMusicStarted && activityMusic.volume === 0) {
            fadeAudioVolume(activityMusic, 0.25, 400);
        }
    }, 4500);

    setTimeout(() => {
        banner.classList.add('rngNewDiscoveryFadeOut');
        banner.addEventListener('animationend', () => {
            banner.remove();
        }, { once: true });
    }, 5000);
}
function animateRngRecordCard( 
    card, 
    onLifetimeLabelShown = null, 
    onRevealFinished = null 
) {  
    if (!card) {  
        return;  
    }  

    clearRngRecordCardWiggle(); 

    const childElements =  
        card.querySelectorAll(  
            '.rngRecordLabel, .rngRecordValue, .rngStat, .rngStatLabel, .rngStatValue:not(.rngRarityValue), .rngModifiersTitle, .rngModifiersDescription, .rngModifier, .rngNoModifiers'  
        );  

    const fullRarityPlaceholder =
        card.querySelector(
            '.rngFullRarityPlaceholder'
        );

    const elements = [ 
        card, 
        ...childElements 
    ];

    if (fullRarityPlaceholder) {
        elements.push(
            fullRarityPlaceholder
        );
    }

    const modifierElements =
        elements.filter(
            element => element.classList.contains('rngModifier')
        );

    const firstModifierIndex =
        elements.findIndex(
            element => element.classList.contains('rngModifier')
        );

    const modifierPopInterval =
        (RNG_POP_DURATION + 100) / 1000;

    const finalElement = 
        elements[ 
            elements.length - 1 
        ]; 

    elements.forEach(  
        (element, index) => {  

            if (element && element.classList && element.classList.contains('rngModifier')) {
                element.addEventListener(
                    'animationend',
                    event => {
                        if (event.animationName !== 'rngResultPopIn') return;
                        const pointsAttr = element.getAttribute('data-modifier-points');
                        const modPoints = Number(pointsAttr) || 0;
                        if (modPoints !== 0 && card) {
                            const pointsEl = card.querySelector('.rngPointsStatValue') || 
                 card.querySelector('.rngStat:nth-child(2) .rngStatValue');
                          if (pointsEl) {
                                const currentPts = Number(pointsEl.textContent) || 0;
                                pointsEl.textContent = String(currentPts + modPoints);

                                pointsEl.classList.remove('rngResultPopIn');
                                pointsEl.style.opacity = '1';
                                pointsEl.style.transform = 'none';

                                pointsEl.classList.remove('rngPointsBump');
                                void pointsEl.offsetWidth;
                                pointsEl.classList.add('rngPointsBump');
                            }
                        }
                    },
                    { once: true }
                );
            }
            if ( 
                onLifetimeLabelShown && 
                element.classList.contains( 
                    'rngStatLabel' 
                ) && 
                element.textContent === 
                    'Lifetime Score' 
            ) { 
                element.addEventListener( 
                    'animationend', 
                    event => { 
                        if ( 
                            event.animationName === 
                            'rngResultPopIn' 
                        ) { 
                            onLifetimeLabelShown(); 
                        } 
                    }, 
                    { once: true } 
                ); 
                
            
     
            }
            const cardHasDuplicate = Boolean(
                card.querySelector(
                    '.rngDuplicateOverlay'
                )
            );

            const contentLoadTrigger =
                modifierElements.length > 0
                    ? modifierElements[modifierElements.length - 1]
                    : elements.find(element => element.classList.contains('rngNoModifiers')) ||
                        elements.find(element => element.classList.contains('rngModifiersDescription')) ||
                        finalElement;

            if (
                element === contentLoadTrigger
            ) {
                element.addEventListener(
                    'animationend',
                    event => {
                        if (
                            event.animationName !==
                            'rngResultPopIn'
                        ) {
                            return;
                        }

                        if (!cardHasDuplicate) {
                            startRngCardFinishEffects(
                                card
                            );
                        }
                    },
                    { once: true }
                );
            }

            if (
                element === finalElement &&
                onRevealFinished
            ) {
                element.addEventListener(
                    'animationend',
                    event => {
                        if (
                            event.animationName !==
                            'rngResultPopIn'
                        ) {
                            return;
                        }

                        onRevealFinished();
                    },
                    { once: true }
                );
            }

            let popDelay =
                index * (RNG_POP_INTERVAL / 1000);

            if (
                element.classList.contains('rngModifier') &&
                firstModifierIndex !== -1
            ) {
                const modifierIndex =
                    modifierElements.indexOf(element);

                popDelay =
                    firstModifierIndex * (RNG_POP_INTERVAL / 1000) +
                    modifierIndex * modifierPopInterval;
            } else if (
                fullRarityPlaceholder &&
                element === fullRarityPlaceholder &&
                modifierElements.length > 0 &&
                firstModifierIndex !== -1
            ) {
                popDelay =
                    firstModifierIndex * (RNG_POP_INTERVAL / 1000) +
                    modifierElements.length * modifierPopInterval;
            }

            element.style.setProperty(
                '--rng-pop-delay',
                `${popDelay}s`
            );

            element.style.animationDuration = 
                `${RNG_POP_DURATION}ms`; 

            element.classList.remove(  
                'rngResultPopIn'  
            );  

            element.style.opacity =  
                '0';  

            element.style.transform =  
                'translateY(12px) scale(0.88)';  

            void element.offsetWidth;  

            element.classList.add(  
                'rngResultPopIn'  
            );  
        }  
    );  
}  

function clearRngLifetimeAnimation() { 
    if ( 
        rngLifetimeRollTimer 
    ) { 
        clearTimeout( 
            rngLifetimeRollTimer 
        ); 

        rngLifetimeRollTimer = 
            null; 
    } 

    rngLifetimeAnimationFrames.forEach( 
        frameId => { 
            cancelAnimationFrame( 
                frameId 
            ); 
        } 
    ); 

    rngLifetimeAnimationFrames = 
        []; 

    rngLifetimeAnimationActive = 
        false; 

    if (rngResultPanel) { 
        rngResultPanel 
            .querySelectorAll( 
                '.rngLifetimeStat.rngLifetimeUpdating' 
            ) 
            .forEach(stat => { 
                stat.classList.remove( 
                    'rngLifetimeUpdating' 
                ); 
            }); 
    } 
} 

function resetDailyRngFrontend() {  
    stopRngDailyCountdown();  
    clearLocalRngRollState();  
    clearLocalRngResult(); 
    clearRngRarityTheme(); 

    clearRngLifetimeAnimation(); 
    clearRngRecordCardWiggle(); 
    rngPendingLifetimeScore = null; 

    if (rngScrambleProgressTimer) { 
        clearInterval( 
            rngScrambleProgressTimer 
        ); 

        rngScrambleProgressTimer = null; 
    } 

    if (rngScrambleTimer) { 
        clearInterval( 
            rngScrambleTimer 
        ); 

        rngScrambleTimer = null; 
    } 

    if (rngScrambleElement) { 
        rngScrambleElement.remove(); 
        rngScrambleElement = null; 
    } 

    if (rngResultPanel) {  
        rngResultPanel.remove();  
        rngResultPanel = null;  
    }  

    hideRngDailyStatus();  

    if (rngDailyActionArea) {  
        rngDailyActionArea.remove();  
        rngDailyActionArea = null;  
    }  

    requestRngServerTime();  
    initializeRngGenerateButton(); 
    updateScrollRail();  
}  

function markRngRollComplete(payload) {  
    rngPeriodStatus = "red"; 
    
    saveLocalRngResult( 
        payload 
    ); 

   

    if ( 
        typeof rngNextResetTimestamp === 'number' && 
        Number.isFinite(rngNextResetTimestamp) 
    ) { 
        const serverNow = 
            getRngServerNow(); 

        const statePayload = { 
            nextRollTimestamp: 
                rngNextResetTimestamp 
        }; 

        if ( 
            typeof serverNow === 'number' && 
            Number.isFinite(serverNow) 
        ) { 
            statePayload.lastRollTimestamp = 
                serverNow; 
        } 

        saveLocalRngRollState( 
            statePayload 
        ); 
    } 

    rngLocalRollState = 
        loadLocalRngRollState(); 

    updateRngDailyCountdown(); 

    sendRngLifetimeUpdate( 
        payload 
    ); 

    if (rngDailyActionArea) {  
        rngDailyActionArea.remove();  
        rngDailyActionArea = null;  
    }  
} 

function getRngLifetimePayloadScore(payload) { 
    if ( 
        !payload || 
        typeof payload !== 'object' 
    ) { 
        return null; 
    } 

    const value = 
        Number( 
            payload.lifetimeRecordScore ?? 
            payload.lifetimeScore ?? 
            payload.lifetime_record_score 
        ); 

    if ( 
        !Number.isFinite(value) 
    ) { 
        return null; 
    } 

    return Math.round( 
        value 
    ); 
} 

function getRngLifetimeStatValueElement() { 
    if ( 
        !rngResultPanel 
    ) { 
        return null; 
    } 

    const statLabels = 
        rngResultPanel.querySelectorAll( 
            '.rngStatLabel' 
        ); 

    for ( 
        const statLabel of statLabels 
    ) { 
        if ( 
            !statLabel.textContent 
                .toLowerCase() 
                .includes( 
                    'lifetime' 
                ) 
        ) { 
            continue; 
        } 

        const stat = 
            statLabel.parentElement; 

        if (!stat) { 
            return null; 
        } 

        return stat.querySelector( 
            '.rngStatValue' 
        ); 
    } 

    return null; 
} 

function createRngLifetimeDigitFace( 
    digit 
) { 
    const face = 
        document.createElement('span'); 

    face.className = 
        'rngLifetimeDigitFace'; 

    face.textContent = 
        String( 
            ( 
                Number(digit) + 
                10 
            ) % 
            10 
        ); 

    return face; 
} 

function getRngLifetimeReelDigit( 
    baseDigit, 
    offset 
) { 
    return ( 
        ( 
            baseDigit + 
            offset 
        ) % 
        10 + 
        10 
    ) % 10; 
} 

function createRngLifetimeDigitReel( 
    oldDigit, 
    targetDigit, 
    delay, 
    onFinished 
) { 
    const digitFrame = 
        document.createElement('span'); 

    digitFrame.className = 
        'rngLifetimeDigit'; 

    const strip = 
        document.createElement('span'); 

    strip.className = 
        'rngLifetimeDigitStrip'; 

    const numericOldDigit = 
        Number( 
            oldDigit 
        ); 

    const numericTargetDigit = 
        Number( 
            targetDigit 
        ); 

    const forwardSteps = 
        ( 
            numericTargetDigit - 
            numericOldDigit + 
            10 
        ) % 
        10; 

    const totalFaces = 
        forwardSteps + 
        3; 

    for ( 
        let index = 0; 
        index < totalFaces; 
        index++ 
    ) { 
        const digit = 
            getRngLifetimeReelDigit( 
                numericOldDigit, 
                index - 
                    RNG_LIFETIME_VISIBLE_STEPS 
            ); 

        strip.appendChild( 
            createRngLifetimeDigitFace( 
                digit 
            ) 
        ); 
    } 

    digitFrame.appendChild( 
        strip 
    ); 

    return { 
        digitFrame, 
        strip, 
        oldDigit: 
            numericOldDigit, 
        targetDigit: 
            numericTargetDigit, 
        forwardSteps, 
        delay, 
        onFinished 
    }; 
} 

function updateRngLifetimeDigitFaces( 
    reel, 
    translateY, 
    faceHeight, 
    frameHeight 
) { 
    const centerY = 
        frameHeight / 
        2; 

    const faces = 
        reel.strip.children; 

    for ( 
        let index = 0; 
        index < faces.length; 
        index++ 
    ) { 
        const face = 
            faces[index]; 

        const faceTop = 
            translateY + 
            ( 
                index * 
                faceHeight 
            ); 

        const faceCenter = 
            faceTop + 
            ( 
                faceHeight / 
                2 
            ); 

        const distance = 
            Math.abs( 
                faceCenter - 
                centerY 
            ); 

        const fadeStart = 
            faceHeight * 
            1.2; 

        const fadeEnd = 
            faceHeight * 
            2; 

        let opacity = 1; 

        if ( 
            distance > 
            fadeStart 
        ) { 
            opacity = 
                Math.max( 
                    0, 
                    1 - 
                        ( 
                            ( 
                                distance - 
                                fadeStart 
                            ) / 
                            ( 
                                fadeEnd - 
                                fadeStart 
                            ) 
                        ) 
                ); 
        } 

        face.style.opacity = 
            String( 
                opacity 
            ); 
    } 
} 

function easeRngLifetimeRoll( 
    progress 
) { 
    const clamped = 
        Math.max( 
            0, 
            Math.min( 
                1, 
                progress 
            ) 
        ); 

    return ( 
        1 - 
        Math.pow( 
            1 - 
                clamped, 
            3 
        ) 
    ); 
} 

function startRngLifetimeDigitReel( 
    reel, 
    faceHeight, 
    frameHeight, 
    onGlobalFrame 
) { 
    const centerOffset = 
        ( 
            frameHeight - 
            faceHeight 
        ) / 2; 

    const startIndex = 
        RNG_LIFETIME_VISIBLE_STEPS; 

    const endIndex = 
        startIndex + 
        reel.forwardSteps; 

    const startTranslate = 
        centerOffset - 
        ( 
            startIndex * 
            faceHeight 
        ); 

    const endTranslate = 
        centerOffset - 
        ( 
            endIndex * 
            faceHeight 
        ); 

    reel.strip.style.transform = 
        `translateY(${startTranslate}px)`; 

    updateRngLifetimeDigitFaces( 
        reel, 
        startTranslate, 
        faceHeight, 
        frameHeight 
    ); 

    let startedAt = 
        null; 

    let frameId = 
        null; 

    function complete() { 
        if ( 
            frameId 
        ) { 
            cancelAnimationFrame( 
                frameId 
            ); 
        } 

        reel.strip.style.transform = 
            `translateY(${endTranslate}px)`; 

        updateRngLifetimeDigitFaces( 
            reel, 
            endTranslate, 
            faceHeight, 
            frameHeight 
        ); 

        reel.onFinished(); 
    } 

    function animate(now) { 
        if ( 
            startedAt === null 
        ) { 
            startedAt = 
                now; 
        } 

        const elapsed = 
            now - 
            startedAt; 

        if ( 
            elapsed < 
            reel.delay 
        ) { 
            frameId = 
                requestAnimationFrame( 
                    animate 
                ); 

            rngLifetimeAnimationFrames.push( 
                frameId 
            ); 

            return; 
        } 

        if ( 
            reel.forwardSteps === 
            0 
        ) { 
            complete(); 
            return; 
        } 

        const localElapsed = 
            elapsed - 
            reel.delay; 

        const duration = 
            RNG_LIFETIME_ROLL_DURATION; 

        const progress = 
            Math.min( 
                localElapsed / 
                    duration, 
                1 
            ); 

        const eased = 
            easeRngLifetimeRoll( 
                progress 
            ); 

        const currentTranslate = 
            startTranslate + 
            ( 
                ( 
                    endTranslate - 
                    startTranslate 
                ) * 
                eased 
            ); 

        reel.strip.style.transform = 
            `translateY(${currentTranslate}px)`; 

        updateRngLifetimeDigitFaces( 
            reel, 
            currentTranslate, 
            faceHeight, 
            frameHeight 
        ); 

        if ( 
            onGlobalFrame 
        ) { 
            onGlobalFrame(); 
        } 

        if ( 
            progress >= 1 
        ) { 
            complete(); 
            return; 
        } 

        frameId = 
            requestAnimationFrame( 
                animate 
            ); 

        rngLifetimeAnimationFrames.push( 
            frameId 
        ); 
    } 

    frameId = 
        requestAnimationFrame( 
            animate 
        ); 

    rngLifetimeAnimationFrames.push( 
        frameId 
    ); 
} 

function animateRngLifetimeScore( 
    element, 
    oldScore, 
    newScore 
) { 
    if ( 
        !element || 
        typeof oldScore !== 'number' || 
        !Number.isFinite(oldScore) || 
        typeof newScore !== 'number' || 
        !Number.isFinite(newScore) 
    ) { 
        return; 
    } 

    const normalizedOldScore = 
        Math.max( 
            0, 
            Math.round( 
                oldScore 
            ) 
        ); 

    const normalizedNewScore = 
        Math.max( 
            0, 
            Math.round( 
                newScore 
            ) 
        ); 

    const oldText = 
        String( 
            normalizedOldScore 
        ); 

    const newText = 
        String( 
            normalizedNewScore 
        ); 

    const lifetimeStat = 
        element.closest( 
            '.rngLifetimeStat' 
        ); 

    if ( 
        oldText === newText 
    ) { 
        if (lifetimeStat) { 
            lifetimeStat.classList.remove( 
                'rngLifetimeUpdating' 
            ); 
        } 

        const normalValue = 
            element.querySelector( 
                '.rngLifetimeNormalValue' 
            ); 

        if (normalValue) { 
            normalValue.textContent = 
                newText; 

            normalValue.style.opacity = 
                '1'; 
        } else { 
            element.textContent = 
                newText; 
        } 

        element.setAttribute( 
            'data-rng-lifetime-score', 
            newText 
        ); 

        element.setAttribute( 
            'aria-label', 
            newText 
        ); 

        return; 
    } 

    clearRngLifetimeAnimation(); 

    if (lifetimeStat) { 
        lifetimeStat.classList.add( 
            'rngLifetimeUpdating' 
        ); 
    } 

    element.classList.add( 
        'rngLifetimeScoreValue' 
    ); 

    let normalValue = 
        element.querySelector( 
            '.rngLifetimeNormalValue' 
        ); 

    if (!normalValue) { 
        element.textContent = 
            ''; 

        normalValue = 
            document.createElement('span'); 

        normalValue.className = 
            'rngLifetimeNormalValue'; 

        element.appendChild( 
            normalValue 
        ); 
    } 

    normalValue.textContent = 
        oldText; 

    normalValue.style.opacity = 
        '0'; 

    element.setAttribute( 
        'data-rng-lifetime-score', 
        oldText 
    ); 

    element.setAttribute( 
        'data-rng-lifetime-old-score', 
        oldText 
    ); 

    element.setAttribute( 
        'data-rng-lifetime-target-score', 
        newText 
    ); 

    element.setAttribute( 
        'aria-label', 
        newText 
    ); 

    const wheel = 
        document.createElement('span'); 

    wheel.className = 
        'rngLifetimeWheel'; 

    wheel.setAttribute( 
        'aria-hidden', 
        'true' 
    ); 

    const wheelLength = 
        Math.max( 
            oldText.length, 
            newText.length 
        ); 

    const oldPadded = 
        oldText.padStart( 
            wheelLength, 
            '0' 
        ); 

    const newPadded = 
        newText.padStart( 
            wheelLength, 
            '0' 
        ); 

    let completedDigits = 
        0; 

    const digitReels = []; 

    function finishDigit() { 
        completedDigits++; 

        if ( 
            completedDigits < 
            digitReels.length 
        ) { 
            return; 
        } 

        normalValue.textContent = 
            newText; 

        element.setAttribute( 
            'data-rng-lifetime-score', 
            newText 
        ); 

        element.setAttribute( 
            'aria-label', 
            newText 
        ); 

        wheel.style.opacity = 
            '0'; 

        window.setTimeout( 
            () => { 
                if ( 
                    wheel.parentElement 
                ) { 
                    wheel.remove(); 
                } 

                normalValue.style.opacity = 
                    '1'; 

                if (lifetimeStat) { 
                    lifetimeStat.classList.remove( 
                        'rngLifetimeUpdating' 
                    ); 
                } 

                rngLifetimeAnimationFrames = 
                    []; 

                rngLifetimeAnimationActive = 
                    false; 
            }, 
            RNG_LIFETIME_FADE_DURATION 
        ); 
    } 

    for ( 
        let index = 0; 
        index < wheelLength; 
        index++ 
    ) { 
        const oldDigit = 
            Number( 
                oldPadded[index] 
            ); 

        const targetDigit = 
            Number( 
                newPadded[index] 
            ); 

        const delay = 
            ( 
                wheelLength - 
                1 - 
                index 
            ) * 
            RNG_LIFETIME_DIGIT_STAGGER; 

        const reel = 
            createRngLifetimeDigitReel( 
                oldDigit, 
                targetDigit, 
                delay, 
                finishDigit 
            ); 

        wheel.appendChild( 
            reel.digitFrame 
        ); 

        digitReels.push( 
            reel 
        ); 

    } 

    element.appendChild( 
        wheel 
    ); 

    rngLifetimeAnimationActive = 
        true; 

    requestAnimationFrame(() => { 
        wheel.style.opacity = 
            '1'; 
    }); 

    window.setTimeout( 
        () => { 
            if ( 
                !wheel.parentElement 
            ) { 
                return; 
            } 

            const sampleDigit = 
                wheel.querySelector( 
                    '.rngLifetimeDigit' 
                ); 

            const sampleFace = 
                wheel.querySelector( 
                    '.rngLifetimeDigitFace' 
                ); 

            if ( 
                !sampleDigit || 
                !sampleFace 
            ) { 
                return; 
            } 

            const faceHeight = 
                sampleFace.getBoundingClientRect().height; 

            const frameHeight = 
                sampleDigit.getBoundingClientRect().height; 

            if ( 
                !Number.isFinite( 
                    faceHeight 
                ) || 
                faceHeight <= 0 || 
                !Number.isFinite( 
                    frameHeight 
                ) || 
                frameHeight <= 0 
            ) { 
                normalValue.textContent = 
                    newText; 

                wheel.style.opacity = 
                    '0'; 

                window.setTimeout( 
                    () => { 
                        wheel.remove(); 

                        normalValue.style.opacity = 
                            '1'; 

                        if (lifetimeStat) { 
                            lifetimeStat.classList.remove( 
                                'rngLifetimeUpdating' 
                            ); 
                        } 

                        rngLifetimeAnimationActive = 
                            false; 
                    }, 
                    RNG_LIFETIME_FADE_DURATION 
                ); 

                return; 
            } 

            digitReels.forEach( 
                reel => { 
                    startRngLifetimeDigitReel( 
                        reel, 
                        faceHeight, 
                        frameHeight 
                    ); 
                } 
            ); 
        }, 
        270 
    ); 
} 

function scheduleRngLifetimeScoreAnimation( 
    payload 
) { 
    if ( 
        typeof rngPendingLifetimeScore !== 'number' || 
        !Number.isFinite( 
            rngPendingLifetimeScore 
        ) 
    ) { 
        return; 
    } 

    if ( 
        rngLifetimeRollTimer 
    ) { 
        clearTimeout( 
            rngLifetimeRollTimer 
        ); 

        rngLifetimeRollTimer = 
            null; 
    } 

    const targetScore = 
        rngPendingLifetimeScore; 

    rngLifetimeRollTimer = 
        setTimeout(() => { 
            rngLifetimeRollTimer = 
                null; 

            if ( 
                !rngResultPanel 
            ) { 
                return; 
            } 

            const lifetimeValueElement = 
                getRngLifetimeStatValueElement(); 

            if ( 
                !lifetimeValueElement 
            ) { 
                return; 
            } 

            const currentScore = 
                getRngLifetimePayloadScore( 
                    payload 
                ); 

            if ( 
                currentScore === null 
            ) { 
                return; 
            } 

            rngPendingLifetimeScore = 
                null; 

            animateRngLifetimeScore( 
                lifetimeValueElement, 
                currentScore, 
                targetScore 
            ); 
        }, RNG_LIFETIME_ROLL_DELAY); 
} 

function sendRngLifetimeUpdate(payload) { 
    if ( 
        !payload || 
        typeof payload !== 'object' 
    ) { 
        return; 
    } 

    const currentLifetime = 
        getRngLifetimePayloadScore( 
            payload 
        ); 

    const basePoints = Number(payload.points) || 0;
    
    let modifierBonus = 0;
    if (typeof payload.modifierPoints === 'number' && Number.isFinite(payload.modifierPoints)) {
        modifierBonus = payload.modifierPoints;
    } else if (Array.isArray(payload.modifiers)) {
        modifierBonus = payload.modifiers.reduce((sum, mod) => {
            return sum + (Number(mod.points) || 0);
        }, 0);
    }

    const totalPoints = basePoints + modifierBonus;

    if ( 
        currentLifetime === null || 
        !Number.isFinite(totalPoints) 
    ) { 
        console.error( 
            "❌ Could not calculate new RNG lifetime score." 
        ); 

        return; 
    } 

    const newLifetimeScore = 
        currentLifetime + 
        totalPoints;

    if ( 
        !Number.isFinite(newLifetimeScore) 
    ) { 
        console.error( 
            "❌ Could not calculate new RNG lifetime score." 
        ); 

        return; 
    } 

    rngPendingLifetimeScore = 
        Math.round( 
            newLifetimeScore 
        ); 

    if ( 
        !socket || 
        socket.readyState !== 
            WebSocket.OPEN 
    ) { 
        rngPendingLifetimeScore = 
            null; 

        console.error( 
            "❌ Could not send RNG lifetime update because socket is not open." 
        ); 

        return; 
    } 

    socket.send( 
        JSON.stringify({ 
            protocol: "cardgame", 
            version: 1, 
            request: "rng_lifetime_update", 
            info: { 
                score: 
                    newLifetimeScore 
            } 
        }) 
    ); 

    console.log( 
        `📈 RNG lifetime score update sent: ${currentLifetime} + ${totalPoints} = ${newLifetimeScore}` 
    ); 
}

function applyRngLifetimeUpdateResult(score) { 
    const storedResult = 
        loadLocalRngResult(); 

    if ( 
        storedResult 
    ) { 
        storedResult.lifetimeRecordScore = 
            score; 

        saveLocalRngResult( 
            storedResult 
        ); 
    } 

    const lifetimeValueElement = 
        getRngLifetimeStatValueElement(); 

    if ( 
        !lifetimeValueElement 
    ) { 
        return; 
    } 

    lifetimeValueElement.setAttribute( 
        'data-rng-lifetime-confirmed-score', 
        String( 
            Math.round( 
                score 
            ) 
        ) 
    ); 
} 

function applyDailyRollState(state) {  
    return;  
}  

function renderStoredRngResult(payload) {  
    if ( 
        !payload || 
        typeof payload !== 'object' || 
        payload.record === undefined 
    ) { 
        return; 
    } 

    if (rngScrambleElement) { 
        rngScrambleElement.remove(); 
        rngScrambleElement = null; 
    } 

    clearRngRecordCardWiggle(); 

    if (rngResultPanel) {  
        rngResultPanel.remove();  
        rngResultPanel = null;  
    }  

    const displayRarity = 
        getRngDisplayRarity( 
            payload 
        ); 

    applyRngRarityTheme( 
        displayRarity 
    ); 

    rngResultPanel =  
        document.createElement('div');  

    rngResultPanel.className =  
        'rngResultPanel';  

    generateScreen.appendChild(  
        rngResultPanel  
    );  

    const card = createRngRecordCard(
        payload,
        String(payload.record ?? '')
    );

    rngResultPanel.appendChild(card);
    scheduleRngDuplicateReveal(card); 

    animateRngRecordCard( 
        card, 
        null, 
        () => { 
            scheduleRngDuplicateReveal(card); 
        } 
    ); 

    if ( 
        mainScreen.classList.contains( 
            'hidden' 
        ) 
    ) { 
        rngStoredResultScrollPending = 
            true; 
    } else { 
        scrollRngResultIntoView(card); 
    } 

    updateScrollRail();  
}  

function normalizeRngModifiers(modifiers) {  
    const normalizeModifierObject = (modifier, fallbackLabel) => {
        const label =
            modifier.displayName ??
            modifier.name ??
            modifier.modifier ??
            modifier.type ??
            modifier.id ??
            fallbackLabel;

        const description =
            modifier.description ??
            modifier.shortDescription ??
            modifier.short_description ??
            modifier.desc ??
            modifier.details ??
            '';

        const rawPoints =
            modifier.points ??
            modifier.pointBonus ??
            modifier.point_bonus ??
            modifier.pointsBonus ??
            modifier.points_bonus ??
            modifier.pointValue ??
            modifier.point_value ??
            0;

        const numericPoints = Number(rawPoints);

        return {
            label: String(label),
            value: description,
            description: description,
            rarity:
                modifier.rarity ??
                modifier.tier ??
                modifier.rank ??
                'common',
            points: Number.isFinite(numericPoints) ? numericPoints : 0
        };
    };

    if (Array.isArray(modifiers)) {  
        return modifiers.map((modifier, index) => {  
            if (  
                modifier &&  
                typeof modifier === 'object' &&  
                !Array.isArray(modifier)  
            ) {  
                return normalizeModifierObject(
                    modifier,
                    `Modifier ${index + 1}`
                );
            }  

            const value = formatRngValue(modifier);

            return {  
                label: `Modifier ${index + 1}`,  
                value,
                description: value,
                rarity: 'common',
                points: 0
            };  
        });  
    }  

    return []; 
}

function formatRngValue(value) {  
    if (value === null || value === undefined) {  
        return '';  
    }  

    if (typeof value === 'string') {  
        return value;  
    }  

    if (  
        typeof value === 'number' ||  
        typeof value === 'boolean' 
    ) { 
        return String(value);  
    }  

    try {  
        return JSON.stringify(value);  
    } catch (err) {  
        return String(value);  
    }  
}  

function getRngRarityColor(rarity) {  
    if (typeof rarity !== 'string') {  
        return '#edf6fb';  
    }  

    return RNG_RARITY_COLORS[  
        rarity.trim().toLowerCase() 
    ] ?? '#edf6fb';  
}  

function createRngStat(label, value, valueColor = null) {  
    const stat = document.createElement('div');  
    stat.className = 'rngStat';  

    const statLabel = document.createElement('div');  
    statLabel.className = 'rngStatLabel';  
    statLabel.textContent = label;  

    if ( 
        String(label).toLowerCase().includes( 
            'lifetime' 
        ) 
    ) { 
        stat.classList.add( 
            'rngLifetimeStat' 
        ); 

        stat.style.position = 
            'relative'; 

        statLabel.classList.add( 
            'rngLifetimeStatLabel' 
        ); 
    } 

    const statValue = document.createElement('div');  
    statValue.className = 'rngStatValue';  

    statValue.style.overflowWrap = 
        'anywhere'; 

    statValue.style.wordBreak = 
        'break-word'; 

    if ( 
        String(label).toLowerCase().includes( 
            'lifetime' 
        ) 
    ) { 
        statValue.classList.add( 
            'rngLifetimeScoreValue' 
        ); 

        const normalValue = 
            document.createElement('span'); 

        normalValue.className = 
            'rngLifetimeNormalValue'; 

        const initialLifetime = 
            Number( 
                value 
            ); 

        if ( 
            Number.isFinite( 
                initialLifetime 
            ) 
        ) { 
            normalValue.textContent = 
                String( 
                    Math.round( 
                        initialLifetime 
                    ) 
                ); 

            statValue.setAttribute( 
                'data-rng-lifetime-score', 
                String( 
                    Math.round( 
                        initialLifetime 
                    ) 
                ) 
            ); 

            statValue.setAttribute( 
                'aria-label', 
                String( 
                    Math.round( 
                        initialLifetime 
                    ) 
                ) 
            ); 
        } else { 
            normalValue.textContent = 
                formatRngValue( 
                    value 
                ); 
        } 

        statValue.appendChild( 
            normalValue 
        ); 
    } else { 
        statValue.textContent = 
            formatRngValue( 
                value 
            ); 
    } 

    if (valueColor) {  
        statValue.style.color = valueColor;  
        statValue.style.textShadow =  
            `0 0 8px ${valueColor}55`;  
    }  

    stat.appendChild(  
        statLabel  
    );  

    stat.appendChild(  
        statValue  
    );  

    return stat;  
}  

function createRngRecordCard(payload, recordText) {  
    const card = document.createElement('div');  
    card.className = 'rngRecordCard';

    const finalRarity = getRngDisplayRarity(payload);
    const normalizedFinalRarity = normalizeRngRarity(finalRarity);

    if (normalizedFinalRarity !== 'unknown') { 
        card.classList.add(`rng-rarity-${normalizedFinalRarity}`); 
        card.setAttribute('data-rarity', normalizedFinalRarity);
    } 

    const baseRollPool = normalizeRngRarity(payload.baseRarity || payload.rarity || 'common');
    card.setAttribute('data-roll-pool', baseRollPool);

    const recordHeader = document.createElement('div');  
    recordHeader.className = 'rngRecordHeader';  

    const recordLabel = document.createElement('div');  
    recordLabel.className = 'rngRecordLabel';  
    recordLabel.textContent = 'Record';  
    recordLabel.style.fontSize = '28px'; 

    const recordValue = document.createElement('div');  
    recordValue.className = 'rngRecordValue';  
    recordValue.textContent = recordText;  

    const basePts = Number(payload.points) || 0;
    const modPts = Number(payload.modifierPoints) || (
        Array.isArray(payload.modifiers)
            ? payload.modifiers.reduce((sum, m) => sum + (Number(m.points) || 0), 0)
            : 0
    );
    const totalEarnedPoints = basePts + modPts;

    const displayRarityName = finalRarity;
    const normalizedDisplayRarity = normalizedFinalRarity;

    const fullRarityContainer = document.createElement('div');
    fullRarityContainer.className = 'rngFullRarityPlaceholder';

    const fullRarityHeader = document.createElement('div');
    fullRarityHeader.className = 'rngFullRarityHeader';
    fullRarityHeader.textContent = 'RECORD RARITY';

    const fullRarityTitle = document.createElement('div');
    fullRarityTitle.className = 'rngFullRarityTitle';
    fullRarityTitle.textContent = displayRarityName.toUpperCase();
    fullRarityTitle.setAttribute('data-rarity', normalizedDisplayRarity);

    if (RNG_RARITY_COLORS[normalizedDisplayRarity]) {
        fullRarityTitle.style.color = RNG_RARITY_COLORS[normalizedDisplayRarity];
    }
    const fullRarityPointsSubtitle = document.createElement('div');
    fullRarityPointsSubtitle.className = 'rngFullRaritySubtitle';
    fullRarityPointsSubtitle.textContent = `${totalEarnedPoints} points earned`;

    fullRarityContainer.appendChild(fullRarityHeader);
    fullRarityContainer.appendChild(fullRarityTitle);
    fullRarityContainer.appendChild(fullRarityPointsSubtitle);

    recordHeader.appendChild(recordLabel);  
    recordHeader.appendChild(recordValue);  
    recordHeader.appendChild(fullRarityContainer);
    card.appendChild(recordHeader); 

    const stats = document.createElement('div');  
    stats.className = 'rngStats';  

    const rarityStat = createRngStat(  
        'Roll Pool',  
        baseRollPool.toUpperCase(),  
        getRngRarityColor(baseRollPool)  
    );

    const rarityValue =
        rarityStat.querySelector(
            '.rngStatValue'
        );

    if (rarityValue) {
        const rarityText =
            document.createElement('span');

        rarityText.className =
            'rngRarityText';

        rarityText.textContent =
            rarityValue.textContent.trim();
            rarityText.setAttribute('data-rarity', baseRollPool);

        rarityText.setAttribute(
            'data-rng-shine-text',
            rarityText.textContent
        );

        rarityValue.textContent = '';

        rarityValue.classList.add(
            'rngRarityValue'
        );

        rarityValue.appendChild(
            rarityText
        );
    }

   stats.appendChild( 
        rarityStat 
    );  

    const initialPoints = (payload && payload.points !== undefined && payload.points !== null)
        ? payload.points
        : 0;

    const pointsStat = createRngStat(  
        'Points',  
        initialPoints  
    );
    const pointsValueEl = pointsStat.querySelector('.rngStatValue');
    if (pointsValueEl) {
        pointsValueEl.classList.add('rngPointsStatValue');
    }
    stats.appendChild(pointsStat);  

    stats.appendChild( 
        createRngStat( 
            'Lifetime Score', 
            payload.lifetimeRecordScore ?? 
                payload.lifetimeScore ?? 
                payload.lifetime_record_score ?? 
                '0' 
        ) 
    ); 

    stats.appendChild( 
        createRngStat( 
            'Times Rolled', 
            payload.timesRolled ?? 
                payload.times_rolled ?? 
                1 
        ) 
    );  

    card.appendChild(stats);  

    const modifiersSection = document.createElement('div');  
    modifiersSection.className = 'rngModifiersSection';  

    const modifiersTitle = document.createElement('div');  
    modifiersTitle.className = 'rngModifiersTitle';  
    modifiersTitle.textContent = 'Modifiers';  

    modifiersSection.appendChild(  
        modifiersTitle  
    );  

   const modifiersDescription = document.createElement('div');
    modifiersDescription.className = 'rngModifiersDescription';
modifiersDescription.textContent = 'Roll Pool sets the base drop chance. Modifiers grant bonus points that upgrade your Record Rarity.';
    modifiersSection.appendChild(
        modifiersDescription
    );

    const modifiersGrid = document.createElement('div');  
    modifiersGrid.className = 'rngModifiers';  

    const modifiers = normalizeRngModifiers(  
        payload.modifiers 
    );

    if (modifiers.length === 0) {  
        const none = document.createElement('div');  
        none.className = 'rngNoModifiers';  
        none.textContent = 'No modifiers';  
        modifiersGrid.appendChild(none);  
    } else {  
        modifiers.forEach(modifier => {  
            const modifierCard = document.createElement('div');  
            modifierCard.className = 'rngModifier';
            modifierCard.dataset.modifierPoints = String(modifier.points || 0);

            const modifierRarity =
                normalizeRngRarity(
                    modifier.rarity || displayRarity
                );

            const finalModifierRarity =
                modifierRarity !== 'unknown'
                    ? modifierRarity
                    : (normalizedRarity !== 'unknown' ? normalizedRarity : 'common');

            modifierCard.setAttribute(
                'data-rarity',
                finalModifierRarity
            );
            modifierCard.setAttribute(
                'data-modifier-points',
                String(modifier.points || 0)
            );

            const modifierHeader = document.createElement('div');
            modifierHeader.className = 'rngModifierHeader';

            const modifierRarityLabel = document.createElement('span');
            modifierRarityLabel.className = 'rngModifierRarity';
            modifierRarityLabel.textContent = `[${finalModifierRarity.toUpperCase()}]`;

            const modifierName = document.createElement('span');
            modifierName.className = 'rngModifierName';
            modifierName.textContent = modifier.label;

            modifierHeader.appendChild(modifierRarityLabel);
            modifierHeader.appendChild(modifierName);

            if (
                modifier.points !== null &&
                modifier.points !== undefined &&
                modifier.points !== 0
            ) {
                const numericPoints = Number(modifier.points);
                const pointsText = Number.isFinite(numericPoints)
                    ? `(${numericPoints >= 0 ? '+' : ''}${numericPoints})`
                    : `(${String(modifier.points).trim()})`;

                const modifierPoints = document.createElement('span');
                modifierPoints.className = 'rngModifierPoints';
                modifierPoints.textContent = pointsText;
                modifierHeader.appendChild(modifierPoints);
            }

            const modifierDescription = document.createElement('div');
            modifierDescription.className = 'rngModifierDescription';
            modifierDescription.textContent =
                modifier.description ||
                modifier.value ||
                'Modifier details unavailable.';

            modifierCard.appendChild(modifierHeader);
            modifierCard.appendChild(modifierDescription);
            modifiersGrid.appendChild(modifierCard);  
        });  
    }

    modifiersSection.appendChild(modifiersGrid);  
    card.appendChild(modifiersSection);  

    if (isRngDuplicatePayload(payload)) {
        const duplicateOverlay =
            document.createElement('div');

        duplicateOverlay.className =
            'rngDuplicateOverlay';

        duplicateOverlay.setAttribute(
            'aria-label',
            'Duplicate roll'
        );

        const duplicateText =
            document.createElement('span');

        duplicateText.className =
            'rngDuplicateText';

        duplicateText.textContent =
            'DUPLICATE';

        duplicateText.setAttribute(
            'data-rng-shine-text',
            'DUPLICATE'
        );

        duplicateText.setAttribute(
            'aria-hidden',
            'true'
        );

        duplicateOverlay.appendChild(
            duplicateText
        );

        card.appendChild(
            duplicateOverlay
        );
    }

    return card;  
}  

function showRngRecordResult(payload) {  
    if (rngScrambleTimer) {  
        clearInterval(rngScrambleTimer);  
        rngScrambleTimer = null;  
    }  

    if (rngScrambleProgressTimer) {  
        clearInterval(rngScrambleProgressTimer);  
        rngScrambleProgressTimer = null;  
    }  

    if (rngScrambleElement) { 
        rngScrambleElement.remove(); 
        rngScrambleElement = null; 
    } 

    if (rngResultPanel) {  
        rngResultPanel.remove();  
        rngResultPanel = null;  
    }  

    if (  
        !payload ||  
        typeof payload !== 'object' ||  
        payload.record === undefined 
    ) { 
        errorMessage.textContent = 
            "⚠️ Invalid RNG result structure."; 
        errorMessage.classList.remove("hidden"); 
        initializeRngGenerateButton(); 
        return; 
    } 

    const displayRarity = 
        getRngDisplayRarity( 
            payload 
        ); 

    applyRngRarityTheme( 
        displayRarity 
    ); 

    createRngTopControlArea(); 

    const scramble =  
        document.createElement('div');  

    scramble.className =  
        'rngScramble';  

    scramble.style.display = 
        'flex'; 

    scramble.style.alignItems = 
        'center'; 

    scramble.style.justifyContent = 
        'center'; 

    scramble.style.visibility = 
        'visible'; 

    scramble.style.opacity = 
        '1'; 

    scramble.style.background = 
        'transparent'; 

    scramble.style.border = 
        '0'; 

    scramble.style.boxShadow = 
        'none'; 

    scramble.style.position = 
        'relative'; 

    scramble.style.zIndex = 
        '2'; 

    scramble.style.width = 
        '350px'; 

    scramble.style.minWidth = 
        '350px'; 

    scramble.style.maxWidth = 
        '350px'; 

    scramble.style.minHeight = 
        '58px'; 

    scramble.style.margin = 
        '0 auto'; 

    scramble.style.flexShrink = 
        '0'; 

    rngScrambleElement = 
        scramble; 

    rngTopControlArea.appendChild( 
        scramble 
    ); 

    void scramble.offsetWidth; 

    updateScrollRail(); 

    const recordText = String(payload.record);  

    if (recordText.length === 0) {  
        scramble.textContent = '';  

        rngResultPanel = 
            document.createElement('div'); 

        rngResultPanel.className = 
            'rngResultPanel'; 

        generateScreen.appendChild( 
            rngResultPanel 
        ); 

        const card =  
            createRngRecordCard(  
                payload,  
                recordText  
            );  

        rngResultPanel.appendChild(card);
        scheduleRngDuplicateReveal(card);
           if (!isRngDuplicatePayload(payload)) {
            showNewRecordDiscoveredBanner();
        }
        scrollRngResultIntoView(card); 

        animateRngRecordCard( 
            card, 
            () => { 
                scheduleRngLifetimeScoreAnimation( 
                    payload 
                ); 
            }, 
            () => { 
                scheduleRngDuplicateReveal(card); 
            } 
        ); 

        updateScrollRail();  
        initializeRngGenerateButton(); 
        rngScrambleElement = null; 
        scramble.remove(); 
        return;  
    }  

    const scrambleCharacters =  
        new Array(  
            recordText.length  
        ).fill('');  

    let appearedCount = 0;  
    let lockedCount = 0;  

    function renderScramble() {  
        let output = '';  

        for (  
            let i = 0;  
            i < recordText.length;  
            i++  
        ) {  
            if (i < lockedCount) {  
                output += recordText[i];  
            } else if (i < appearedCount) {  
                output += scrambleCharacters[i];  
            } else {  
                output += '\u00A0';  
            }  
        }  

        scramble.textContent = output;  
    }  

    function rapidlyScramble() {  
        for (  
            let i = lockedCount;  
            i < appearedCount;  
            i++  
        ) {  
            scrambleCharacters[i] =  
                getRandomRngCharacter();  
        }  

        renderScramble();  
    } 

    function finishRngScramble() { 
        if (rngScrambleProgressTimer) { 
            clearInterval( 
                rngScrambleProgressTimer 
            ); 

            rngScrambleProgressTimer = null; 
        } 

        if (rngScrambleTimer) { 
            clearInterval( 
                rngScrambleTimer 
            ); 

            rngScrambleTimer = null; 
        } 

        lockedCount = 
            recordText.length; 

        appearedCount = 
            recordText.length; 

        scramble.textContent = 
            recordText; 

        rngResultPanel = 
            document.createElement('div'); 

        rngResultPanel.className = 
            'rngResultPanel'; 

        generateScreen.appendChild( 
            rngResultPanel 
        ); 

        const card = 
            createRngRecordCard( 
                payload, 
                recordText 
            ); 

        rngResultPanel.appendChild(card);

        scheduleRngDuplicateReveal(card);
         if (!isRngDuplicatePayload(payload)) {
            showNewRecordDiscoveredBanner();
        }

        scrollRngResultIntoView(card); 

        animateRngRecordCard( 
            card, 
            () => { 
                scheduleRngLifetimeScoreAnimation( 
                    payload 
                ); 
            }, 
            () => { 
                scheduleRngDuplicateReveal(card); 
            } 
        ); 

        updateRngDailyCountdown(); 
        updateScrollRail(); 

        rngScrambleElement = null; 

        scramble.remove(); 
    } 

    appearedCount = 
        1; 

    for ( 
        let i = 0; 
        i < appearedCount; 
        i++ 
    ) { 
        scrambleCharacters[i] = 
            getRandomRngCharacter(); 
    } 

    renderScramble(); 

    const scrambleStartTime = 
        performance.now(); 

    rngScrambleProgressTimer = 
        setInterval(() => { 
            const elapsed = 
                performance.now() - 
                scrambleStartTime; 

            const totalProgress = 
                Math.min( 
                    elapsed / 
                        RNG_SCRAMBLE_DURATION, 
                    1 
                ); 

            if ( 
                elapsed < 
                RNG_APPEAR_DURATION 
            ) { 
                const appearanceProgress = 
                    Math.min( 
                        elapsed / 
                            RNG_APPEAR_DURATION, 
                        1 
                    ); 

                appearedCount = 
                    Math.min( 
                        recordText.length, 
                        Math.max( 
                            1, 
                            Math.ceil( 
                                appearanceProgress * 
                                    recordText.length 
                            ) 
                        ) 
                    ); 

                lockedCount = 0; 

            } else { 
                appearedCount = 
                    recordText.length; 

                const unscrambleDuration = 
                    RNG_SCRAMBLE_DURATION - 
                    RNG_APPEAR_DURATION; 

                const unscrambleElapsed = 
                    Math.min( 
                        elapsed - 
                            RNG_APPEAR_DURATION, 
                        unscrambleDuration 
                    ); 

                const unscrambleProgress = 
                    Math.min( 
                        unscrambleElapsed / 
                            unscrambleDuration, 
                        1 
                    ); 

                lockedCount = 
                    Math.floor( 
                        unscrambleProgress * 
                            recordText.length 
                    ); 
            } 

            rapidlyScramble(); 

            if ( 
                totalProgress >= 1 
            ) { 
                finishRngScramble(); 
            } 
        }, RNG_SCRAMBLE_TICK); 
}  

function initializeRngGenerateButton() {  
    if (!generateScreen) {  
        return;  
    }  

    if ( 
        isRngCooldownActive() 
    ) { 
        return; 
    } 

    if (rngDailyActionArea) {  
        return;  
    }  

    if (rngRequestPending) {  
        return;  
    }  

    if (rngRollLoadingPending) { 
        return; 
    } 

    createRngTopControlArea(); 

    const actionArea =  
        document.createElement('div');  

    actionArea.className =  
        'rngActionArea';  

    const button =  
        document.createElement('button');  

    button.id =  
        'generateRecordButton';  

    button.className =  
        'rngGenerateButton';  

    button.type =  
        'button';  

    button.textContent =  
        'Generate Record';  

    actionArea.appendChild(  
        button  
    );  

    rngControlSlot.appendChild(  
        actionArea  
    );  

    rngDailyActionArea =  
        actionArea;  

    button.addEventListener(  
        'pointerenter',  
        () => {  
            startNormalButtonWiggle(  
                button  
            );  
        }  
    );  

    button.addEventListener(  
        'pointerleave',  
        () => {  
            stopNormalButtonWiggle(  
                button  
            );  
        }  
    );  

    button.addEventListener(  
        'focus',  
        () => {  
            startNormalButtonWiggle(  
                button  
            );  
        }  
    );  

    button.addEventListener(  
        'blur',  
        () => {  
            stopNormalButtonWiggle(  
                button  
            );  
        }  
    );  

    button.addEventListener(  
        'click',  
        () => {  
            actionArea.remove();  
            rngDailyActionArea = null;  

            rngRollLoadingPending = true; 
            errorMessage.classList.add( 
                "hidden" 
            ); 

            startRngRollLoading(() => { 
                rngRollLoadingPending = false; 
                beginRngRollRequest(); 
            }); 
        }  
    );  
}  

function beginRngRollRequest() { 
    const nextRollTimestamp = 
        getRngNextRollTimestamp(); 

    const serverNow = 
        getRngServerNow(); 

    if ( 
        typeof nextRollTimestamp !== 'number' || 
        !Number.isFinite(nextRollTimestamp) || 
        typeof serverNow !== 'number' || 
        !Number.isFinite(serverNow) 
    ) { 
        if ( 
            typeof serverNow !== 'number' || 
            !Number.isFinite(serverNow) 
        ) { 
            rngRequestPending = false; 

            errorMessage.textContent = 
                "⚠️ Action Cancelled: Server time has not been synchronized yet."; 

            errorMessage.classList.remove( 
                "hidden" 
            ); 

            initializeRngGenerateButton(); 
            return; 
        } 
    } 

    if ( 
        isRngCooldownActive() 
    ) { 
        updateRngDailyCountdown(); 
        return; 
    } 

    rngRequestPending = true; 

    if (  
        !socket ||  
        socket.readyState !==  
            WebSocket.OPEN 
    ) {  
        rngRequestPending = false;  

        errorMessage.textContent =  
            "⚠️ Action Cancelled: Socket State is [NOT_OPEN]. Check the error log banner.";  

        errorMessage.classList.remove(  
            "hidden"  
        );  

        initializeRngGenerateButton();  
        return;  
    }  

    socket.send(  
        JSON.stringify({  
            protocol: "cardgame",  
            version: 1,  
            request: "rng_go"  
        })  
    );  
} 

function initializeRngFrontend() {  
    if ( 
        !generateScreen ||  
        rngFrontendInitialized 
    ) { 
        return; 
    } 

    rngFrontendInitialized = true; 

    if (!rngLocalRollState) { 
        rngLocalRollState = 
            loadLocalRngRollState(); 
    } 

    createRngTopControlArea();  
    createRngDailyStatus();  
    hideRngDailyStatus();  
    clearRngRarityTheme();  

    const storedResult = 
        loadLocalRngResult(); 

    if ( 
        storedResult && 
        isRngCooldownActive() 
    ) { 
        renderStoredRngResult( 
            storedResult 
        ); 
    } else if ( 
        storedResult 
    ) { 
        clearLocalRngResult(); 
    } 

    updateRngDailyCountdown();  

    if ( 
        !rngResultPanel && 
        !rngRequestPending && 
        !rngRollLoadingPending 
    ) { 
        initializeRngGenerateButton(); 
    } 

    maybePlayRngLaunchFlash();  
} 



const myCollectionView = document.getElementById('myCollectionView');
const openPackView = document.getElementById('openPackView');
const tradesView = document.getElementById('tradesView');

const collectionSearchInput = document.getElementById('collectionSearchInput');
const collectionSortSelect = document.getElementById('collectionSortSelect');
const collectionOwnedCheckbox = document.getElementById('collectionOwnedCheckbox');
const collectionRosterCount = document.getElementById('collectionRosterCount');
const collectionCardsGrid = document.getElementById('collectionCardsGrid');

let collectionSearchQuery = '';
let collectionSortOrder = 'rarity_desc';
let collectionOwnedOnly = false;
let collectionSearchDebounceTimer = null;
let collectionSortCooldownUntil = 0;
let collectionSortCooldownInterval = null;

let totalCatalogCardCount = 1000;
let totalOwnedCardCount = 0;
let currentRosterFilteredCount = 1000;

function updateCollectionRosterText() {
    if (!collectionRosterCount) return;

    if (collectionHasPendingSearch) {
        collectionRosterCount.textContent = "Searching Trello...";
        return;
    }

    const isSearching = Boolean(collectionSearchQuery.trim());
    const isOwned = Boolean(collectionOwnedOnly);

    const formattedMatch = Number(currentRosterFilteredCount || 0).toLocaleString();

    if (!isSearching && !isOwned) {
        collectionRosterCount.textContent = `${formattedMatch} cards in roster`;
    } else if (!isSearching && isOwned) {
        collectionRosterCount.textContent = `${formattedMatch} cards owned in roster`;
    } else if (isSearching && !isOwned) {
        collectionRosterCount.textContent = `${formattedMatch} cards in roster matching "${collectionSearchQuery}"`;
    } else if (isSearching && isOwned) {
        collectionRosterCount.textContent = `${formattedMatch} cards owned in roster matching "${collectionSearchQuery}"`;
    }
}



function handleCollectionSortChange(e) {
    collectionSortOrder = collectionSortSelect.value;
    triggerCollectionSearchOrFilter();
}
function switchCardsSubview(targetView) {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    if (myCollectionView) myCollectionView.classList.add('hidden');
    if (openPackView) openPackView.classList.add('hidden');
    if (tradesView) tradesView.classList.add('hidden');

   if (targetView === 'collection' && myCollectionView) {
        myCollectionView.classList.remove('hidden');
    } else if (targetView === 'pack' && openPackView) {
        openPackView.classList.remove('hidden');
        renderPackViewContainer();
    } else if (targetView === 'trades' && tradesView) {
        tradesView.classList.remove('hidden');
    }

    updateScrollRail();
}
function setupCollectionControls() {
    if (collectionSearchInput) {
        collectionSearchInput.addEventListener('input', (e) => {
            clearTimeout(collectionSearchDebounceTimer);
            const val = e.target.value;

            collectionSearchDebounceTimer = setTimeout(() => {
                collectionSearchQuery = val.trim();
                triggerCollectionSearchOrFilter();
            }, 600);
        });
    }

    if (collectionSortSelect) {
        collectionSortSelect.addEventListener('change', handleCollectionSortChange);
    }

    if (collectionOwnedCheckbox) {
        collectionOwnedCheckbox.addEventListener('change', (e) => {
            collectionOwnedOnly = e.target.checked;
            triggerCollectionSearchOrFilter();
        });
    }

    const myColBtn = document.getElementById('myCollectionButton');
    const openPackBtn = document.getElementById('openPackButton');
    const tradesBtn = document.getElementById('tradesButton');

    if (myColBtn) {
        myColBtn.addEventListener('click', () => switchCardsSubview('collection'));
    }
    if (openPackBtn) {
        openPackBtn.addEventListener('click', () => switchCardsSubview('pack'));
    }
    if (tradesBtn) {
        tradesBtn.addEventListener('click', () => switchCardsSubview('trades'));
    }

    updateCollectionRosterText();
}

document.addEventListener('DOMContentLoaded', () => {
    setupCollectionControls();
    switchCardsSubview('collection');
});

let allCollectionCards = [];
let currentCollectionPage = 1;
const CARDS_PER_PAGE = 30; 
const STATS_COOLDOWN_MS = 30 * 1000;              // 30s cooldown for stats
const COLLECTION_TAB_COOLDOWN_MS = 30 * 1000;     // 30s cooldown when clicking Cards or My Collection
const COLLECTION_SEARCH_COOLDOWN_MS = 8 * 1000;   // 8s cooldown for search / filter changes

let lastStatsRequestTime = 0;
let lastCollectionTabRequestTime = 0;
let lastCollectionSearchRequestTime = 0;

let collectionPendingSearchTimer = null;
let collectionHasPendingSearch = false;

function sendCollectionFilterWebSocket() {
    console.log(`📡 [COLLECTION FILTER] Query: "${collectionSearchQuery}", Sort: ${collectionSortOrder}, OwnedOnly: ${collectionOwnedOnly}`);

    if (collectionRosterCount) {
        collectionRosterCount.textContent = "Loading cards from Trello...";
    }

    if (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            protocol: "cardgame",
            version: 1,
            request: "collection_filter_requested",
            info: {
                query: collectionSearchQuery,
                sort: collectionSortOrder,
                ownedOnly: collectionOwnedOnly
            }
        }));
    } else {
        console.warn("⚠️ WebSocket not open, cannot request collection data.");
    }
}

function triggerCollectionTabRequest() {
    const now = Date.now();
    if (now - lastCollectionTabRequestTime < COLLECTION_TAB_COOLDOWN_MS) {
        console.log("⏳ [THROTTLE] Collection tab on 30s cooldown, ignoring spam.");
        return;
    }

    lastCollectionTabRequestTime = now;
    lastCollectionSearchRequestTime = now;

    if (collectionPendingSearchTimer) {
        clearTimeout(collectionPendingSearchTimer);
        collectionPendingSearchTimer = null;
        collectionHasPendingSearch = false;
    }

    sendCollectionFilterWebSocket();
}

function triggerCollectionSearchOrFilter() {
    const now = Date.now();
    const elapsed = now - lastCollectionSearchRequestTime;

    if (elapsed >= COLLECTION_SEARCH_COOLDOWN_MS) {
        if (collectionPendingSearchTimer) {
            clearTimeout(collectionPendingSearchTimer);
            collectionPendingSearchTimer = null;
        }
        collectionHasPendingSearch = false;
        lastCollectionSearchRequestTime = now;
        sendCollectionFilterWebSocket();
    } else {
        collectionHasPendingSearch = true;
        if (collectionRosterCount) {
            collectionRosterCount.textContent = "Searching Trello...";
        }

        const remaining = COLLECTION_SEARCH_COOLDOWN_MS - elapsed;
        if (!collectionPendingSearchTimer) {
            collectionPendingSearchTimer = setTimeout(() => {
                collectionPendingSearchTimer = null;
                if (collectionHasPendingSearch) {
                    collectionHasPendingSearch = false;
                    lastCollectionSearchRequestTime = Date.now();
                    sendCollectionFilterWebSocket();
                }
            }, remaining);
        }
    }
}

function triggerCollectionFilterRequest() {
    triggerCollectionSearchOrFilter();
}

function requestCardGameStats() {
    const now = Date.now();
    if (now - lastStatsRequestTime < STATS_COOLDOWN_MS) {
        console.log("⏳ [THROTTLE] Stats request on 30s cooldown, ignoring spam.");
        return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
    }

    lastStatsRequestTime = now;
    cardGameStatsRequested = true;

    socket.send(JSON.stringify({
        protocol: 'cardgame',
        version: 1,
        request: 'get_stats'
    }));
}

function handleCollectionDataResponse(payload) {
    if (!payload || typeof payload !== 'object') return;

    allCollectionCards = payload.cards || [];
    currentCollectionPage = 1; 

    const counts = payload.counts || {};
    currentRosterFilteredCount = counts.currentFiltered ?? allCollectionCards.length;
    totalOwnedCardCount = counts.totalOwned ?? 0;
    totalCatalogCardCount = counts.totalCatalog ?? allCollectionCards.length;

    updateCollectionRosterText();
    renderCollectionCardGrid();
}

function renderCollectionCardGrid() {
    if (!collectionCardsGrid) return;
    collectionCardsGrid.innerHTML = '';

    const existingPaginationBar = document.querySelector('.collectionPaginationBar');
    if (existingPaginationBar) {
        existingPaginationBar.remove();
    }

    if (allCollectionCards.length === 0) {
        collectionCardsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 24px; font-size: 14px;">
                No cards found matching your criteria.
            </div>
        `;
        return;
    }

    const totalPages = Math.max(1, Math.ceil(allCollectionCards.length / CARDS_PER_PAGE));
    const startIndex = (currentCollectionPage - 1) * CARDS_PER_PAGE;
    const pageCards = allCollectionCards.slice(startIndex, startIndex + CARDS_PER_PAGE);

    const fragment = document.createDocumentFragment();

        const RNG_GRADIENT_RARITIES = ['transcendent', 'cosmic', 'omnipotent'];

        pageCards.forEach(card => {
            const isOwned = Boolean(card.owned);
            const rarityKey = (card.rarity || 'common').toLowerCase();
            const hasGradient = RNG_GRADIENT_RARITIES.includes(rarityKey);

            const cardBox = document.createElement('div');
            cardBox.className = `collectionCardBox ${isOwned ? 'owned' : 'locked'}`;
            cardBox.dataset.rarity = rarityKey;

            if (hasGradient) {
                cardBox.dataset.hasGradient = "true";
            }

            if (!isOwned) {
                cardBox.innerHTML = `
                    <div class="cardUndiscoveredQuestion">?</div>
                    <div class="cardUndiscoveredRarity">${rarityKey}</div>
                `;
            } else {
                cardBox.innerHTML = `
                    <div class="collectionCardName">${card.name}</div>
                    <div class="collectionCardRarity">${rarityKey}</div>
                `;
            }

            fragment.appendChild(cardBox);
        });

    collectionCardsGrid.appendChild(fragment);

    const paginationBar = document.createElement('div');
    paginationBar.className = 'collectionPaginationBar';

    const isFirstPage = currentCollectionPage <= 1;
    const isLastPage = currentCollectionPage >= totalPages;

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'collectionPageBtn';
    prevBtn.textContent = '◀ Prev';
    prevBtn.disabled = isFirstPage;
    prevBtn.addEventListener('click', () => {
        if (currentCollectionPage > 1) {
            currentCollectionPage--;
            renderCollectionCardGrid();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    const pageIndicator = document.createElement('span');
    pageIndicator.className = 'collectionPageIndicator';
    pageIndicator.textContent = `Page ${currentCollectionPage} of ${totalPages}`;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'collectionPageBtn';
    nextBtn.textContent = 'Next ▶';
    nextBtn.disabled = isLastPage;
    nextBtn.addEventListener('click', () => {
        if (currentCollectionPage < totalPages) {
            currentCollectionPage++;
            renderCollectionCardGrid();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    paginationBar.appendChild(prevBtn);
    paginationBar.appendChild(pageIndicator);
    paginationBar.appendChild(nextBtn);

    collectionCardsGrid.after(paginationBar);
}
const PACK_LOCAL_RESULT_STORAGE_KEY = 'cardgame_pack_last_result';

let cachedPackOptions = [];
let packCountdownTimer = null;
let currentPackRevealCards = [];
let currentPackRevealIndex = 0;
let isOpeningPack = false;

function saveLocalPackResult(payload) {
    try {
        localStorage.setItem(PACK_LOCAL_RESULT_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}
}

function loadLocalPackResult() {
    try {
        const stored = localStorage.getItem(PACK_LOCAL_RESULT_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
}

function clearLocalPackResult() {
    try {
        localStorage.removeItem(PACK_LOCAL_RESULT_STORAGE_KEY);
    } catch (e) {}
}

function isCardsCooldownActive() {
    if (cardsPeriodStatus === "red") {
        const serverNow = getRngServerNow();
        if (
            typeof serverNow === 'number' &&
            typeof nextCardsResetTimestamp === 'number' &&
            serverNow >= nextCardsResetTimestamp
        ) {
            return false;
        }
        return true;
    }
    return false;
}

function requestPackOptions() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
        protocol: "cardgame",
        version: 1,
        request: "get_pack_options"
    }));
}

function handlePackOptionsResponse(data) {
    if (!data) return;
    if (data.cardsPeriod) {
        cardsPeriodStatus = String(data.cardsPeriod).toLowerCase().trim();
    }
    cachedPackOptions = data.packs || [];
    renderPackViewContainer();
}
let packModalOverlayElement = null;

function renderPackViewContainer() {
    if (!openPackView) return;
    openPackView.innerHTML = '';

    const cooldownActive = isCardsCooldownActive();

    const topControlArea = document.createElement('div');
    topControlArea.className = 'packTopControlArea';

    if (cooldownActive) {
        const dailyStatus = document.createElement('div');
        dailyStatus.className = 'packDailyStatus';

        const dailyMessage = document.createElement('div');
        dailyMessage.className = 'packDailyMessage';
        dailyMessage.textContent = 'You have already opened your pack for this period';

        const dailyCountdown = document.createElement('div');
        dailyCountdown.id = 'packResetCountdownDisplay';
        dailyCountdown.className = 'packDailyCountdown';

        dailyStatus.appendChild(dailyMessage);
        dailyStatus.appendChild(dailyCountdown);
        topControlArea.appendChild(dailyStatus);
        openPackView.appendChild(topControlArea);

        const lastPackData = loadLocalPackResult();
        if (lastPackData && Array.isArray(lastPackData.cards) && lastPackData.cards.length > 0) {
            const showcase = document.createElement('div');
            showcase.className = 'packLastResultShowcase';

            const title = document.createElement('div');
            title.className = 'packLastResultTitle';
            title.textContent = `Last Pack Pull: ${lastPackData.displayName || 'Historical Pack'}`;
            showcase.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'packLastResultGrid';

            const RNG_GRADIENT_RARITIES = ['transcendent', 'cosmic', 'omnipotent'];

            lastPackData.cards.forEach(card => {
                const cardEl = document.createElement('div');
                const rarityKey = (card.rarity || 'common').toLowerCase();
                cardEl.className = 'collectionCardBox owned packLastResultCard';
                cardEl.dataset.rarity = rarityKey;
                if (RNG_GRADIENT_RARITIES.includes(rarityKey)) {
                    cardEl.dataset.hasGradient = "true";
                }

                cardEl.innerHTML = `
                    <div class="collectionCardName">${card.name}</div>
                    <div class="collectionCardRarity">${card.rarity}</div>
                    ${!card.duplicate ? '<div class="packLastResultBadgeNew">★ NEW ★</div>' : ''}
                `;
                grid.appendChild(cardEl);
            });

            showcase.appendChild(grid);
            openPackView.appendChild(showcase);
        }

        startCardsPackCountdown();
        return;
    }

    stopCardsPackCountdown();

    const actionArea = document.createElement('div');
    actionArea.className = 'packActionArea';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'rngGenerateButton';
    openBtn.textContent = 'Open Pack';
    openBtn.addEventListener('click', () => {
        showPackSelectionModal();
    });

    actionArea.appendChild(openBtn);
    topControlArea.appendChild(actionArea);
    openPackView.appendChild(topControlArea);
}

function closePackSelectionModal() {
    if (packModalOverlayElement) {
        packModalOverlayElement.remove();
        packModalOverlayElement = null;
    }
}

function showPackSelectionModal() {
    closePackSelectionModal();

    const overlay = document.createElement('div');
    overlay.className = 'packModalOverlay';

    const modalBox = document.createElement('div');
    modalBox.className = 'packModalBox';

    const header = document.createElement('div');
    header.className = 'packModalHeader';

    const title = document.createElement('h3');
    title.textContent = 'Select a Pack';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'packModalCloseBtn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', closePackSelectionModal);

    header.appendChild(title);
    header.appendChild(closeBtn);
    modalBox.appendChild(header);

    const list = document.createElement('div');
    list.className = 'packModalList';

    if (!cachedPackOptions || cachedPackOptions.length === 0) {
        const loading = document.createElement('div');
        loading.style.textAlign = 'center';
        loading.style.padding = '20px';
        loading.style.color = '#94a3b8';
        loading.textContent = 'Loading packs from Trello...';
        list.appendChild(loading);
    } else {
        cachedPackOptions.forEach(pack => {
            const item = document.createElement('div');
            item.className = 'packModalItem';

            const info = document.createElement('div');
            info.className = 'packModalInfo';

            const name = document.createElement('div');
            name.className = 'packModalName';
            name.textContent = pack.displayName;

            const stats = document.createElement('div');
            stats.className = 'packModalStats';
            stats.innerHTML = `
                <div>${Number(pack.discovered || 0).toLocaleString()} of ${Number(pack.totalCards || 0).toLocaleString()} discovered</div>
                <div>${Number(pack.owned || 0).toLocaleString()} of ${Number(pack.totalCards || 0).toLocaleString()} owned</div>
            `;

            info.appendChild(name);
            info.appendChild(stats);

            const openPackBtn = document.createElement('button');
            openPackBtn.type = 'button';
            openPackBtn.className = 'packModalItemOpenBtn';
            openPackBtn.textContent = 'Open';
            openPackBtn.addEventListener('click', () => {
                closePackSelectionModal();
                triggerOpenPack(pack.id, pack.displayName);
            });

            item.appendChild(info);
            item.appendChild(openPackBtn);
            list.appendChild(item);
        });
    }

    modalBox.appendChild(list);
    overlay.appendChild(modalBox);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closePackSelectionModal();
        }
    });

    document.body.appendChild(overlay);
    packModalOverlayElement = overlay;
}

function startCardsPackCountdown() {
    stopCardsPackCountdown();
    updateCardsPackCountdownText();
    packCountdownTimer = setInterval(updateCardsPackCountdownText, 1000);
}

function stopCardsPackCountdown() {
    if (packCountdownTimer) {
        clearInterval(packCountdownTimer);
        packCountdownTimer = null;
    }
}

function updateCardsPackCountdownText() {
    const el = document.getElementById('packResetCountdownDisplay');
    if (!el) {
        stopCardsPackCountdown();
        return;
    }

    const serverNow = getRngServerNow();
    if (!serverNow || !nextCardsResetTimestamp) {
        el.textContent = 'Calculating reset time...';
        return;
    }

    const remaining = nextCardsResetTimestamp - serverNow;
    if (remaining <= 0) {
        stopCardsPackCountdown();
        cardsPeriodStatus = 'green';
        clearLocalPackResult();
        requestRngServerTime();
        requestPackOptions();
        renderPackViewContainer();
        return;
    }

    el.textContent = `Next pack in ${formatRngCountdown(remaining)}`;
}

function triggerOpenPack(packId, displayName) {
    if (isOpeningPack) return;
    isOpeningPack = true;

    openPackView.innerHTML = `
        <div class="packOpeningLoadingBox">
            <div class="loadingSpinner"></div>
            <div style="font-size: 18px; font-weight: 800; color: #38bdf8;">Opening ${displayName}...</div>
            <div style="font-size: 13px; color: #94a3b8;">Rolling 20 cards from the archives...</div>
        </div>
    `;

    socket.send(JSON.stringify({
        protocol: "cardgame",
        version: 1,
        request: "open_pack",
        info: { packName: packId }
    }));
}

function handlePackError(data) {
    isOpeningPack = false;
    const msg = data?.message || "Failed to open pack.";
    alert(`❌ Pack Error: ${msg}`);
    requestPackOptions();
    renderPackViewContainer();
}

function handlePackOpenedResult(data) {
    isOpeningPack = false;
    cardsPeriodStatus = "red";
    currentPackRevealCards = data.cards || [];
    currentPackRevealIndex = 0;

    saveLocalPackResult({
        displayName: data.displayName,
        cards: currentPackRevealCards,
        timestamp: Date.now()
    });

    requestCardGameStats();
    if (typeof triggerCollectionTabRequest === 'function') {
        triggerCollectionTabRequest();
    }

    startPackCardReveal(data.displayName);
}

const RARITY_LADDER_ORDER = [
    'omnipotent',
    'cosmic',
    'transcendent',
    'divine',
    'celestial',
    'mythical',
    'legendary',
    'epic',
    'rare',
    'uncommon',
    'common'
];

const RARITY_FLASH_COLORS = {
    common: '#22c55e',
    uncommon: '#94a3b8',
    rare: '#38bdf8',
    epic: '#c084fc',
    legendary: '#facc15',
    mythical: '#ef4444',
    celestial: '#60a5fa',
    divine: '#a3e635',
    transcendent: '#ff5599',
    cosmic: '#a855f7',
    omnipotent: '#ffffff'
};

function getHighestRarityInPack(cards) {
    if (!Array.isArray(cards) || cards.length === 0) return 'common';
    let highestIndex = RARITY_LADDER_ORDER.length - 1;
    for (const c of cards) {
        const r = (c.rarity || 'common').toLowerCase();
        const idx = RARITY_LADDER_ORDER.indexOf(r);
        if (idx !== -1 && idx < highestIndex) {
            highestIndex = idx;
        }
    }
    return RARITY_LADDER_ORDER[highestIndex];
}

function playPackCardFlash(rarity) {
    const rKey = (rarity || 'common').toLowerCase();
    const flashColor = RARITY_FLASH_COLORS[rKey] || '#38bdf8';

    const oldFlash = document.getElementById('packRarityFlashOverlay');
    if (oldFlash) oldFlash.remove();

    const flashEl = document.createElement('div');
    flashEl.id = 'packRarityFlashOverlay';
    flashEl.className = 'packRarityFlashActive';
    flashEl.style.setProperty('background', flashColor, 'important');
    flashEl.style.setProperty('box-shadow', `inset 0 0 160px ${flashColor}, 0 0 100px ${flashColor}`, 'important');

    document.body.appendChild(flashEl);

    setTimeout(() => {
        if (flashEl && flashEl.parentNode) {
            flashEl.remove();
        }
    }, 550);
}

function startPackCardReveal(packDisplayName) {
    if (!openPackView) return;
    openPackView.innerHTML = '';

    const stageWrapper = document.createElement('div');
    stageWrapper.className = 'packRevealStageWrapper';

    const leftStack = document.createElement('div');
    leftStack.id = 'packSideCardsLeft';
    leftStack.className = 'packSideCardsLeft';

    const rightStack = document.createElement('div');
    rightStack.id = 'packSideCardsRight';
    rightStack.className = 'packSideCardsRight';

    const centerContainer = document.createElement('div');
    centerContainer.className = 'packRevealContainer';

    const header = document.createElement('div');
    header.className = 'packRevealHeader';
    header.innerHTML = `
        <div class="packRevealTitle">${packDisplayName}</div>
        <div id="packRevealCounter" class="packRevealCounter">Card 1 of ${currentPackRevealCards.length}</div>
    `;
    centerContainer.appendChild(header);

    const cardSlot = document.createElement('div');
    cardSlot.id = 'packRevealCardSlot';
    cardSlot.className = 'packRevealCardSlot';
    centerContainer.appendChild(cardSlot);

    const nextBtn = document.createElement('button');
    nextBtn.id = 'packRevealNextBtn';
    nextBtn.type = 'button';
    nextBtn.className = 'packRevealNextBtn';
    nextBtn.textContent = 'Next Card ▶';
    nextBtn.addEventListener('click', () => {
        advancePackCardReveal(packDisplayName);
    });
    centerContainer.appendChild(nextBtn);

    stageWrapper.appendChild(leftStack);
    stageWrapper.appendChild(centerContainer);
    stageWrapper.appendChild(rightStack);

    openPackView.appendChild(stageWrapper);

    renderCurrentRevealCard(packDisplayName);
}

let isCardRevealSpinning = false;

function renderCurrentRevealCard(packDisplayName) {
    const slot = document.getElementById('packRevealCardSlot');
    const counter = document.getElementById('packRevealCounter');
    const nextBtn = document.getElementById('packRevealNextBtn');
    let detailsBox = document.getElementById('packCardDetailsBox');

    if (!slot || !counter) return;

    const total = currentPackRevealCards.length;
    counter.textContent = `Card ${currentPackRevealIndex + 1} of ${total}`;

    const card = currentPackRevealCards[currentPackRevealIndex];
    if (!card) return;

    slot.innerHTML = '';
    if (detailsBox) detailsBox.remove();

    isCardRevealSpinning = true;
    if (nextBtn) {
        nextBtn.disabled = true;
    }

    const startCardSpinAndRip = () => {
        slot.innerHTML = '';

        const mysteryBox = document.createElement('div');
        mysteryBox.className = 'collectionCardBox packCardMystery packCardSpin1s';
        mysteryBox.innerHTML = `
            <div class="packCardMysteryPattern">? ? ? ? ? ? ? ? ? ?</div>
            <div class="packCardMysteryMainQ">?</div>
        `;
        slot.appendChild(mysteryBox);

        setTimeout(() => {
            if (!slot.contains(mysteryBox)) return;

            slot.innerHTML = '';

            const ripContainer = document.createElement('div');
            ripContainer.className = 'packMysteryRippingContainer';
            ripContainer.innerHTML = `
                <div class="packMysteryRipHalf packMysteryRipHalfTop">
                    <div class="packCardMysteryPattern">? ? ? ? ?</div>
                </div>
                <div class="packMysteryRipHalf packMysteryRipHalfBottom">
                    <div class="packCardMysteryPattern">? ? ? ? ?</div>
                </div>
            `;
            slot.appendChild(ripContainer);

            setTimeout(() => {
                playPackCardFlash(card.rarity);

                slot.innerHTML = '';

                const cardBox = document.createElement('div');
                cardBox.className = `collectionCardBox owned packRevealedCardAnim`;
                cardBox.dataset.rarity = (card.rarity || 'common').toLowerCase();

                const RNG_GRADIENT_RARITIES = ['transcendent', 'cosmic', 'omnipotent'];
                if (RNG_GRADIENT_RARITIES.includes((card.rarity || '').toLowerCase())) {
                    cardBox.dataset.hasGradient = "true";
                }

                cardBox.innerHTML = `
                    <div class="collectionCardName">${card.name}</div>
                    <div class="collectionCardRarity">${card.rarity}</div>
                `;
                slot.appendChild(cardBox);

                const centerContainer = document.querySelector('.packRevealContainer');
                if (centerContainer) {
                    const textDetails = document.createElement('div');
                    textDetails.id = 'packCardDetailsBox';
                    textDetails.className = 'packCardTextDetails packRevealedCardAnim';
                    textDetails.innerHTML = `
                        <div class="packCardTextName">${card.name}</div>
                        <div class="packCardTextLine">Edition: N/A</div>
                        ${!card.duplicate ? '<div class="packCardTextNew">★ NEW ★</div>' : ''}
                        <div class="packCardTextLine">Total Points: N/A</div>
                        <div class="packCardTextLine">Modifiers: None</div>
                        <div class="packCardTextLine">Pull Rarity: <span class="packCardTextRarity" data-rarity="${(card.rarity || 'common').toLowerCase()}">${(card.rarity || 'common').toUpperCase()}</span></div>
                    `;

                    const nextBtnEl = document.getElementById('packRevealNextBtn');
                    centerContainer.insertBefore(textDetails, nextBtnEl);
                }

                isCardRevealSpinning = false;
                if (nextBtn) {
                    nextBtn.disabled = false;
                    if (currentPackRevealIndex >= total - 1) {
                        nextBtn.textContent = 'Finish Opening ✔';
                        nextBtn.classList.add('finishBtn');
                    } else {
                        nextBtn.textContent = 'Next Card ▶';
                        nextBtn.classList.remove('finishBtn');
                    }
                }
            }, 380);
        }, 1000);
    };

    if (currentPackRevealIndex === 0) {
        const highestRarity = getHighestRarityInPack(currentPackRevealCards);
        const highestColor = RARITY_FLASH_COLORS[highestRarity] || '#38bdf8';

        const foilWrapper = document.createElement('div');
        foilWrapper.className = 'packFoilWrapper packFoilClickable';
        foilWrapper.innerHTML = `
            <div class="packFoilTopPrompt">✦ CLICK TO OPEN PACK ✦</div>
            <div class="packFoilTopPart">
                <div class="packFoilCrimpHeader"></div>
                <div class="packFoilGameTitle">STORM CARDS</div>
                <div class="packFoilSubBadge">OFFICIAL ARCHIVE</div>
            </div>
            <div class="packFoilBottomPart">
                <div class="packFoilPackName">${packDisplayName || 'Historical Pack'}</div>
                <div class="packFoilCenterSeal">⚡</div>
                <div class="packFoilDetailsText">20 CARDS • SERIES 1</div>
                <div class="packFoilRaritySquare" style="background-color: ${highestColor}; box-shadow: 0 0 10px ${highestColor};" title="Highest Card Rarity: ${highestRarity.toUpperCase()}"></div>
                <div class="packFoilCrimpFooter"></div>
            </div>
        `;
        slot.appendChild(foilWrapper);

        let hasTorn = false;
        foilWrapper.addEventListener('click', () => {
            if (hasTorn) return;
            hasTorn = true;
            foilWrapper.classList.remove('packFoilClickable');
            foilWrapper.classList.add('ripping');

            setTimeout(() => {
                startCardSpinAndRip();
            }, 800);
        });
    } else {
        startCardSpinAndRip();
    }
}

function advancePackCardReveal(packDisplayName) {
    if (isCardRevealSpinning) return;

    const card = currentPackRevealCards[currentPackRevealIndex];
    if (card) {
        const leftStack = document.getElementById('packSideCardsLeft');
        const rightStack = document.getElementById('packSideCardsRight');

        const targetStack = (currentPackRevealIndex % 2 === 0) ? leftStack : rightStack;
        if (targetStack) {
            const sideCard = document.createElement('div');
            const rarityKey = (card.rarity || 'common').toLowerCase();
            sideCard.className = 'collectionCardBox owned packSideCardItem';
            sideCard.dataset.rarity = rarityKey;

            const RNG_GRADIENT_RARITIES = ['transcendent', 'cosmic', 'omnipotent'];
            if (RNG_GRADIENT_RARITIES.includes(rarityKey)) {
                sideCard.dataset.hasGradient = "true";
            }

            sideCard.innerHTML = `
                <div class="collectionCardName">${card.name}</div>
                <div class="collectionCardRarity">${card.rarity}</div>
            `;

            targetStack.appendChild(sideCard);
        }
    }

    if (currentPackRevealIndex < currentPackRevealCards.length - 1) {
        currentPackRevealIndex++;
        renderCurrentRevealCard(packDisplayName);
    } else {
        renderPackSummaryScreen(packDisplayName);
    }
}

function renderPackSummaryScreen(packDisplayName) {
    if (!openPackView) return;
    openPackView.innerHTML = '';

    const summaryBox = document.createElement('div');
    summaryBox.className = 'packSummaryBox';

    const newCardsCount = currentPackRevealCards.filter(c => !c.duplicate).length;

    summaryBox.innerHTML = `
        <h2 style="color: #38bdf8; margin: 0 0 10px 0;">Pack Opening Complete!</h2>
        <p style="color: #cbd5e1; margin: 0 0 20px 0;">You opened the <strong>${packDisplayName}</strong> and pulled 20 cards (${newCardsCount} newly discovered).</p>
        <button id="packSummaryDoneBtn" type="button" class="packSummaryReturnBtn">Return to Packs</button>
    `;

    openPackView.appendChild(summaryBox);

    document.getElementById('packSummaryDoneBtn')?.addEventListener('click', () => {
        requestPackOptions();
        renderPackViewContainer();
    });
}