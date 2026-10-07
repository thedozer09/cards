const screen1 = document.getElementById('screen1'); 
const screen2 = document.getElementById('screen2'); 
const testButton = document.getElementById('testButton'); 
const rngButton = document.getElementById('rngButton'); 
const errorMessage = document.getElementById('errorMessage'); 
const activityMusic = document.getElementById('activityMusic');
const musicToggleButton = document.getElementById('musicToggleButton'); 
	 
let socket = null; 
let activityMusicStarted = false;
	 
function updateActivityMusicButton() {
    if (!musicToggleButton) {
        return;
    }

    if (
        activityMusic &&
        activityMusic.muted
    ) {
        musicToggleButton.textContent = '🔇';
        musicToggleButton.setAttribute(
            'aria-label',
            'Unmute music'
        );
        musicToggleButton.setAttribute(
            'title',
            'Unmute music'
        );
    } else {
        musicToggleButton.textContent = '🔊';
        musicToggleButton.setAttribute(
            'aria-label',
            'Mute music'
        );
        musicToggleButton.setAttribute(
            'title',
            'Mute music'
        );
    }
}

function startActivityMusic() {
    if (!activityMusic) {
        return;
    }

    activityMusic.volume = 0.5;
    activityMusic.loop = true;

    if (
        activityMusic.muted
    ) {
        return;
    }

    const playPromise =
        activityMusic.play();

    if (
        playPromise &&
        typeof playPromise.catch === 'function'
    ) {
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

    activityMusic.volume = 0.5;
    activityMusic.loop = true;

    updateActivityMusicButton();
    startActivityMusic();

    const startFromInteraction = () => {
        if (
            !activityMusicStarted &&
            !activityMusic.muted
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

function initializeWebSocket() { 
    const socketUrl = `wss://${window.location.host}/ws`; 
     
    console.log("Connecting directly to Discord Proxy route:", socketUrl); 
    socket = new WebSocket(socketUrl); 
	 
    socket.addEventListener('open', () => { 
        console.log("Connected to card game backend"); 
        errorMessage.classList.add("hidden"); 
         
        requestRngServerTime(); 
    }); 
	 
    socket.addEventListener('message', event => { 
        try { 
            const data = JSON.parse(event.data); 
            console.log("Backend message:", data); 
	 
            if (data.type === "connected") { 
                console.log("Card game connection established"); 
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
                    data.data.nextReset 
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
	 
        } catch (err) { 
            errorMessage.textContent = "⚠️ Invalid game response structural frame."; 
            errorMessage.classList.remove("hidden"); 
        } 
    }); 
	 
    socket.addEventListener('close', (event) => { 
        console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`); 
         
        if (event.code === 1006) { 
            errorMessage.textContent = "❌ ERROR: Proxy Handoff Failure (1006). Discord's network engine cannot ping port, or inactivity timeout occured."; 
        } else if (event.code === 1015) { 
            errorMessage.textContent = "❌ ERROR: SSL Handshake failure (1015). Discord required a secure connection that backend container port didn't accept."; 
        } else { 
            errorMessage.textContent = `⚠️ Disconnected (Code: ${event.code}). Reason: ${event.reason || 'None'}`; 
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
} 
	 
function requestRngServerTime() { 
    if ( 
        !socket || 
        socket.readyState !== 
            WebSocket.OPEN 
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
        request: "rng_test" 
    })); 
}); 
	 
initializeActivityMusic();
initializeWebSocket(); 
	 
const loadingScreen = document.getElementById('loadingScreen'); 
const mainScreen = document.getElementById('mainScreen'); 
const generateButton = document.getElementById('generateButton'); 
const leaderboardsButton = document.getElementById('leaderboardsButton'); 
const cardsButton = document.getElementById('cardsButton'); 
const generateScreen = document.getElementById('generateScreen'); 
const leaderboardsScreen = document.getElementById('leaderboardsScreen'); 
const cardsScreen = document.getElementById('cardsScreen'); 
	 
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
	 
setTimeout(() => { 
    loadingScreen.classList.add('hidden'); 
    mainScreen.classList.remove('hidden'); 
    updateScrollRail();
    startActivityMusic();

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
	 
function switchTab(button, screen) { 
    generateButton.classList.remove('active'); 
    leaderboardsButton.classList.remove('active'); 
    cardsButton.classList.remove('active'); 
    generateScreen.classList.add('hidden'); 
    leaderboardsScreen.classList.add('hidden'); 
    cardsScreen.classList.add('hidden'); 
    button.classList.add('active'); 
    screen.classList.remove('hidden'); 

    if (screen === generateScreen) {
        handleRngGenerateTabActivation();
    } else if (screen === leaderboardsScreen) {
        startTabLoading(
            leaderboardsScreen,
            'Leaderboards'
        );

        clearRngRarityTheme();
    } else {
        startTabLoading(
            cardsScreen,
            'Cards'
        );

        clearRngRarityTheme();
    }

    updateScrollRail();
} 
	 
generateButton.addEventListener('click', () => { 
    switchTab(generateButton, generateScreen); 
}); 
	 
leaderboardsButton.addEventListener('click', () => { 
    switchTab(leaderboardsButton, leaderboardsScreen); 
}); 
	 
cardsButton.addEventListener('click', () => { 
    switchTab(cardsButton, cardsScreen); 
}); 
	 
const scrollRail = document.querySelector('.scrollRail'); 
	 
function updateScrollRail() { 
    document.documentElement.style.minHeight = ''; 
    document.body.style.minHeight = ''; 

    const pageHeight = Math.max( 
        document.documentElement.scrollHeight, 
        document.body.scrollHeight, 
        mainScreen.scrollHeight, 
        window.innerHeight 
    ); 

    document.documentElement.style.minHeight = `${pageHeight}px`; 
    document.body.style.minHeight = `${pageHeight}px`; 

    if (!scrollRail) { 
        return; 
    } 
	 
    const spacing = 250; 
    const edgeInset = 36; 
    const positions = []; 
	 
    const usableHeight = Math.max( 
        0, 
        pageHeight - (edgeInset * 2) 
    ); 
	 
    const indicatorCount = Math.max( 
        1, 
        Math.floor(usableHeight / spacing) + 1 
    ); 
	 
    if (indicatorCount === 1) { 
        positions.push(pageHeight / 2); 
    } else { 
        for (let i = 0; i < indicatorCount; i++) { 
            positions.push(edgeInset + (i * spacing)); 
        } 
    } 
	 
    scrollRail.style.height = `${pageHeight}px`; 
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
	 
if (typeof ResizeObserver !== 'undefined') { 
    const scrollResizeObserver = new ResizeObserver(() => { 
        updateScrollRail(); 
    }); 
	 
    scrollResizeObserver.observe(mainScreen); 
    scrollResizeObserver.observe(document.body); 
} 
	 
const tabButtons = document.querySelectorAll('.tabButton'); 
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
    common: "#dce7f0", 
    uncommon: "#4fd1c5", 
    rare: "#4da6ff", 
    legendary: "#ffd84d" 
}; 

const RNG_RARITY_GRADIENTS = {
    common:
        `linear-gradient(
            135deg,
            #557590 0%,
            #4a6981 28%,
            #435d70 55%,
            #3d5363 78%,
            #374a58 100%
        )`,
    uncommon:
        `linear-gradient(
            135deg,
            #247b79 0%,
            #286f72 28%,
            #2d626b 55%,
            #315664 78%,
            #344b59 100%
        )`,
    rare:
        `linear-gradient(
            135deg,
            #2468a3 0%,
            #285f97 28%,
            #2e587f 55%,
            #334f6e 78%,
            #37485b 100%
        )`,
    legendary:
        `linear-gradient(
            135deg,
            #7b671f 0%,
            #6c5d2c 28%,
            #5d5234 55%,
            #4e4839 78%,
            #41403d 100%
        )`
};

const RNG_RANDOM_CHARACTERS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

const RNG_RARITY_THEME_CLASSES = [
    'rng-rarity-common',
    'rng-rarity-uncommon',
    'rng-rarity-rare',
    'rng-rarity-legendary'
];

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
const RNG_RECORD_WIGGLE_DURATION = 1350;
const RNG_RECORD_WIGGLE_AMPLITUDE = 8;
const RNG_RECORD_WIGGLE_ROTATION = 3.5;
	 
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
	 
function getRandomRngCharacter() { 
    const index = Math.floor( 
        Math.random() * RNG_RANDOM_CHARACTERS.length 
    ); 
	 
    return RNG_RANDOM_CHARACTERS[index]; 
} 
	 
function syncRngServerClock( 
    serverTime, 
    nextReset 
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
	 
    rngServerTimeBase = 
        serverTime; 
	 
    rngPerformanceTimeBase = 
        performance.now(); 
	 
    rngNextResetTimestamp = 
        nextReset.timestamp; 

    if (!rngFrontendInitialized) { 
        rngLocalRollState = 
            loadLocalRngRollState(); 
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
        modifiers: payload.modifiers ?? [] 
    }; 
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
    const nextRollTimestamp =
        getRngNextRollTimestamp();

    const serverNow =
        getRngServerNow();

    if (
        typeof nextRollTimestamp !== 'number' ||
        !Number.isFinite(nextRollTimestamp) ||
        typeof rngNextResetTimestamp !== 'number' ||
        !Number.isFinite(rngNextResetTimestamp) ||
        typeof serverNow !== 'number' ||
        !Number.isFinite(serverNow)
    ) {
        return false;
    }

    if (
        nextRollTimestamp !==
        rngNextResetTimestamp
    ) {
        return false;
    }

    if (
        nextRollTimestamp <=
        serverNow
    ) {
        return false;
    }

    const lastRollTimestamp =
        Number(
            rngLocalRollState?.lastRollTimestamp
        );

    if (
        Number.isFinite(
            lastRollTimestamp
        )
    ) {
        return (
            lastRollTimestamp <=
            serverNow
        );
    }

    return Boolean(
        loadLocalRngResult()
    );
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
        'Next roll in'; 
	 
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
    const nextRollTimestamp =
        getRngNextRollTimestamp();

    const serverNow =
        getRngServerNow();

    if (
        typeof serverNow !== 'number' ||
        !Number.isFinite(serverNow)
    ) {
        stopRngDailyCountdown();
        hideRngDailyStatus();
        return false;
    }

    if (
        typeof nextRollTimestamp !== 'number' ||
        !Number.isFinite(nextRollTimestamp) ||
        !isRngCooldownActive()
    ) {
        stopRngDailyCountdown();
        hideRngDailyStatus();

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
        nextRollTimestamp -
        serverNow;

    if (
        remaining <= 0
    ) {
        stopRngDailyCountdown();

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
        'Next roll in';

    rngDailyCountdown.textContent =
        formatRngCountdown(
            remaining
        );

    rngDailyMessage.style.color =
        '#8a8f94';

    rngDailyCountdown.style.color =
        '#8a8f94';

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
    const baseRarity =
        normalizeRngRarity(
            payload &&
            payload.rarity
        );

    /*
    // FUTURE MODIFIER-BASED RARITY PROCESSING

    let rarityTier =
        baseRarity === 'common'
            ? 0
            : baseRarity === 'uncommon'
                ? 1
                : baseRarity === 'rare'
                    ? 2
                    : baseRarity === 'legendary'
                        ? 3
                        : -1;

    if (
        rarityTier >= 0 &&
        Array.isArray(payload?.modifiers)
    ) {
        payload.modifiers.forEach(modifier => {
            // Future modifier processing will determine
            // whether a modifier increases rarity here.
        });
    }

    const rarityByTier = [
        'common',
        'uncommon',
        'rare',
        'legendary'
    ];

    if (rarityTier >= 0) {
        return rarityByTier[
            Math.min(
                rarityTier,
                rarityByTier.length - 1
            )
        ];
    }
    */

    return baseRarity;
}

function applyRngRarityTheme(rarity) {
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
            block: 'center',
            inline: 'center'
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
            !card.parentElement
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

            applyRngRarityTheme(
                card.classList.contains('rng-rarity-common')
                    ? 'common'
                    : card.classList.contains('rng-rarity-uncommon')
                        ? 'uncommon'
                        : card.classList.contains('rng-rarity-rare')
                            ? 'rare'
                            : card.classList.contains('rng-rarity-legendary')
                                ? 'legendary'
                                : 'unknown'
            );

            if (!rngRecordCardWiggleFrame) {
                startRngRecordCardWiggle(card);
            }

            requestRngLaunchFlash();
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
	 
function animateRngRecordCard(
    card,
    onLifetimeLabelShown = null
) { 
    if (!card) { 
        return; 
    } 

    clearRngRecordCardWiggle();
	 
    const childElements = 
        card.querySelectorAll( 
            '.rngRecordLabel, .rngRecordValue, .rngStat, .rngStatLabel, .rngStatValue, .rngModifiersTitle, .rngModifier, .rngModifierName, .rngModifierValue, .rngNoModifiers' 
        ); 

    const elements = [
        card,
        ...childElements
    ];

    const finalElement =
        elements[
            elements.length - 1
        ];

    elements.forEach( 
        (element, index) => { 

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

            if (
                element ===
                finalElement
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

                        card.classList.remove(
                            'rngResultPopIn'
                        );

                        card.classList.remove(
                            'rngRecordCardFinalPop'
                        );

                        card.style.opacity =
                            '1';

                        card.style.transform =
                            'none';

                        playRngLaunchFlash();

                        void card.offsetWidth;

                        card.classList.add(
                            'rngRecordCardFinalPop'
                        );

                        card.addEventListener(
                            'animationend',
                            finalPopEvent => {
                                if (
                                    finalPopEvent.animationName !==
                                    'rngRecordCardFinalPop'
                                ) {
                                    return;
                                }

                                startRngRecordCardWiggle(
                                    card
                                );
                            },
                            { once: true }
                        );
                    },
                    { once: true }
                );
            }

            element.style.setProperty( 
                '--rng-pop-delay', 
                `${index * (RNG_POP_INTERVAL / 1000)}s` 
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

    if (
        oldText === newText
    ) {
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

    const points =
        Number(
            payload.points
        );

    if (
        currentLifetime === null ||
        !Number.isFinite(points)
    ) {
        console.error(
            "❌ Could not calculate new RNG lifetime score."
        );

        return;
    }

    const newLifetimeScore =
        currentLifetime +
        points;

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
        `📈 RNG lifetime score update sent: ${currentLifetime} + ${points} = ${newLifetimeScore}`
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
	 
    rngResultPanel.appendChild( 
        createRngRecordCard( 
            payload, 
            String( 
                payload.record ?? '' 
            ) 
        ) 
    ); 
	 
    const card = 
        rngResultPanel.querySelector( 
            '.rngRecordCard' 
        ); 
	 
    animateRngRecordCard(card);

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
    if (Array.isArray(modifiers)) { 
        return modifiers.map((modifier, index) => { 
            if ( 
                modifier && 
                typeof modifier === 'object' && 
                !Array.isArray(modifier) 
            ) { 
                const label = 
                    modifier.name ?? 
                    modifier.modifier ?? 
                    modifier.type ?? 
                    modifier.id ?? 
                    `Modifier ${index + 1}`; 
	 
                const detailEntries = Object.entries(modifier) 
                    .filter(([key]) => { 
                        return !['name', 'modifier', 'type', 'id'].includes(key); 
                    }); 
	 
                let detail = ''; 
	 
                if (detailEntries.length === 1) { 
                    detail = formatRngValue(detailEntries[0][1]); 
                } else if (detailEntries.length > 1) { 
                    detail = detailEntries 
                        .map(([key, value]) => { 
                            return `${key}: ${formatRngValue(value)}`; 
                        }) 
                        .join(' • '); 
                } 
	 
                return { 
                    label: String(label), 
                    value: detail 
                }; 
            } 
	 
            return { 
                label: `Modifier ${index + 1}`, 
                value: formatRngValue(modifier) 
            }; 
        }); 
    } 
	 
    if ( 
        modifiers && 
        typeof modifiers === 'object' && 
        !Array.isArray(modifiers) 
    ) { 
        return Object.entries(modifiers).map(([key, value]) => { 
            if ( 
                value && 
                typeof value === 'object' && 
                !Array.isArray(value) 
            ) { 
                const entries = Object.entries(value); 
	 
                const detail = entries 
                    .map(([entryKey, entryValue]) => { 
                        return `${entryKey}: ${formatRngValue(entryValue)}`; 
                    }) 
                    .join(' • '); 
	 
                return { 
                    label: key, 
                    value: detail 
                }; 
            } 
	 
            return { 
                label: key, 
                value: formatRngValue(value) 
            }; 
        }); 
    } 
	 
    if ( 
        modifiers !== undefined && 
        modifiers !== null && 
        modifiers !== '' 
    ) { 
        return [{ 
            label: 'Modifier', 
            value: formatRngValue(modifiers) 
        }]; 
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
	 
    const displayRarity =
        getRngDisplayRarity(
            payload
        );

    const normalizedRarity =
        normalizeRngRarity(
            displayRarity
        );

    if (normalizedRarity !== 'unknown') {
        card.classList.add(
            `rng-rarity-${normalizedRarity}`
        );

        const rarityGradient =
            getRngRarityGradient(
                normalizedRarity
            );

        if (
            rarityGradient
        ) {
            card.style.background =
                rarityGradient;
        }
    }
	 
    const recordHeader = document.createElement('div'); 
    recordHeader.className = 'rngRecordHeader'; 
	 
    const recordLabel = document.createElement('div'); 
    recordLabel.className = 'rngRecordLabel'; 
    recordLabel.textContent = 'Record'; 

    recordLabel.style.fontSize =
        '28px';
	 
    const recordValue = document.createElement('div'); 
    recordValue.className = 'rngRecordValue'; 
    recordValue.textContent = recordText; 
	 
    recordHeader.appendChild(recordLabel); 
    recordHeader.appendChild(recordValue); 
    card.appendChild(recordHeader); 
	 
    const stats = document.createElement('div'); 
    stats.className = 'rngStats'; 
	 
    const rarityStat =
        createRngStat( 
            'Rarity', 
            displayRarity !== 'unknown'
                ? displayRarity
                : payload.rarity ?? 'Unknown', 
            getRngRarityColor(displayRarity) 
        );

    const rarityValue =
        rarityStat.querySelector(
            '.rngStatValue'
        );

    if (rarityValue) {
        rarityValue.classList.add(
            'rngRarityValue'
        );
    }

    stats.appendChild(
        rarityStat
    ); 
	 
    stats.appendChild( 
        createRngStat( 
            'Points', 
            payload.points ?? '0' 
        ) 
    ); 

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
	 
            const modifierName = document.createElement('div'); 
            modifierName.className = 'rngModifierName'; 
            modifierName.textContent = modifier.label; 
	 
            const modifierValue = document.createElement('div'); 
            modifierValue.className = 'rngModifierValue'; 
            modifierValue.textContent = modifier.value; 
	 
            modifierCard.appendChild(modifierName); 
            modifierCard.appendChild(modifierValue); 
            modifiersGrid.appendChild(modifierCard); 
        }); 
    } 
	 
    modifiersSection.appendChild(modifiersGrid); 
    card.appendChild(modifiersSection); 
	 
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
        scrollRngResultIntoView(card);
        requestRngLaunchFlash();

        animateRngRecordCard(
            card,
            () => {
                scheduleRngLifetimeScoreAnimation(
                    payload
                );
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

        rngResultPanel.appendChild(
            card
        );

        scrollRngResultIntoView(card);
        requestRngLaunchFlash();

        animateRngRecordCard(
            card,
            () => {
                scheduleRngLifetimeScoreAnimation(
                    payload
                );
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


/*
============================================================
===== TEMP RNG COOLDOWN BYPASS - START REMOVE HERE =====
============================================================

REMOVE EVERYTHING FROM THE START MARKER ABOVE
THROUGH THE END MARKER BELOW.

PRESS CTRL + SHIFT + R TO ROLL DURING COOLDOWN.
*/

document.addEventListener(
    'keydown',
    event => {

        if (
            !event.ctrlKey ||
            !event.shiftKey ||
            event.key.toLowerCase() !== 'r'
        ) {
            return;
        }

        event.preventDefault();

        if (
            rngRequestPending ||
            rngRollLoadingPending
        ) {
            return;
        }

        if (
            !socket ||
            socket.readyState !==
                WebSocket.OPEN
        ) {
            errorMessage.textContent =
                "⚠️ Temporary RNG bypass failed: Socket is not open.";

            errorMessage.classList.remove(
                "hidden"
            );

            return;
        }

        console.log(
            "⚠️ TEMP RNG COOLDOWN BYPASS ACTIVE"
        );

        if (rngDailyActionArea) {
            rngDailyActionArea.remove();
            rngDailyActionArea = null;
        }

        rngRollLoadingPending =
            true;

        errorMessage.classList.add(
            "hidden"
        );

        startRngRollLoading(() => {

            rngRollLoadingPending =
                false;

            rngRequestPending =
                true;

            socket.send(
                JSON.stringify({
                    protocol: "cardgame",
                    version: 1,
                    request: "rng_go"
                })
            );

        });

    }
);


/*
============================================================
===== TEMP RNG COOLDOWN BYPASS - END MARKER =====
============================================================

EVERYTHING ABOVE THIS END MARKER IS TEMPORARY.
EVERYTHING BELOW/OUTSIDE THIS BLOCK IS REAL CODE.
============================================================
*/