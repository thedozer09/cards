const screen1 = document.getElementById('screen1'); 
const screen2 = document.getElementById('screen2'); 
const testButton = document.getElementById('testButton'); 
const rngButton = document.getElementById('rngButton'); 
const errorMessage = document.getElementById('errorMessage'); 
	 
let socket = null; 
	 
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
	 
initializeWebSocket(); 


const loadingScreen = document.getElementById('loadingScreen');
const mainScreen = document.getElementById('mainScreen');
const generateButton = document.getElementById('generateButton');
const leaderboardsButton = document.getElementById('leaderboardsButton');
const cardsButton = document.getElementById('cardsButton');
const generateScreen = document.getElementById('generateScreen');
const leaderboardsScreen = document.getElementById('leaderboardsScreen');
const cardsScreen = document.getElementById('cardsScreen');


document.querySelectorAll('.tabHeader').forEach(
    element => {
        element.remove();
    }
);


const TAB_LOADING_DURATION = 3000;
const RNG_ROLL_LOADING_DURATION = 3000;
const RNG_LOCAL_ROLL_STORAGE_KEY = 'cardgame_rng_next_roll_timestamp';
const RNG_LOCAL_RESULT_STORAGE_KEY = 'cardgame_rng_last_result';


const tabLoadingStates = new Map();


errorMessage.style.zIndex = '100000';
errorMessage.style.position = 'fixed';


let currentTab = 'generate';
let tabLoadingScreen = null;


function createTabLoadingScreen() {

    if (tabLoadingScreen) {
        return tabLoadingScreen;
    }

    tabLoadingScreen = document.createElement('div');
    tabLoadingScreen.className = 'tabLoadingScreen';
    tabLoadingScreen.style.width = '350px';
    tabLoadingScreen.style.minWidth = '350px';
    tabLoadingScreen.style.maxWidth = '350px';
    tabLoadingScreen.style.minHeight = '86px';
    tabLoadingScreen.style.height = '86px';
    tabLoadingScreen.style.display = 'flex';
    tabLoadingScreen.style.alignItems = 'center';
    tabLoadingScreen.style.justifyContent = 'center';
    tabLoadingScreen.style.margin = '0 auto';
    tabLoadingScreen.style.boxSizing = 'border-box';
    tabLoadingScreen.style.background = 'transparent';
    tabLoadingScreen.style.color = '#dce7f0';
    tabLoadingScreen.style.fontSize = '15px';
    tabLoadingScreen.style.fontWeight = '800';
    tabLoadingScreen.style.letterSpacing = '0.8px';
    tabLoadingScreen.style.textAlign = 'center';

    return tabLoadingScreen;
}


function startTabLoading(tabName) {

    const existingState = tabLoadingStates.get(tabName);

    if (existingState) {
        clearTimeout(existingState.timer);
    }

    const loadingElement = createTabLoadingScreen();

    loadingElement.textContent = `Loading ${tabName}...`;

    const targetScreen =
        tabName === 'generate'
            ? generateScreen
            : tabName === 'leaderboards'
                ? leaderboardsScreen
                : cardsScreen;

    targetScreen.prepend(loadingElement);

    const timer = setTimeout(() => {
        finishTabLoading(tabName);
    }, TAB_LOADING_DURATION);

    tabLoadingStates.set(
        tabName,
        {
            timer,
            loadingElement
        }
    );
}


function finishTabLoading(tabName) {

    const state = tabLoadingStates.get(tabName);

    if (!state) {
        return;
    }

    clearTimeout(state.timer);

    if (state.loadingElement) {
        state.loadingElement.remove();
    }

    tabLoadingStates.delete(tabName);
}


function startRngRollLoading(onComplete) {

    const loadingElement = createTabLoadingScreen();

    loadingElement.textContent = 'Generating Record...';

    generateScreen.prepend(loadingElement);

    setTimeout(() => {

        loadingElement.remove();

        if (typeof onComplete === 'function') {
            onComplete();
        }

    }, RNG_ROLL_LOADING_DURATION);
}


setTimeout(() => {

    loadingScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');

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


function switchTab(tabName) {

    if (tabName === currentTab) {
        return;
    }

    currentTab = tabName;

    generateButton.classList.toggle(
        'active',
        tabName === 'generate'
    );

    leaderboardsButton.classList.toggle(
        'active',
        tabName === 'leaderboards'
    );

    cardsButton.classList.toggle(
        'active',
        tabName === 'cards'
    );

    generateScreen.classList.toggle(
        'hidden',
        tabName !== 'generate'
    );

    leaderboardsScreen.classList.toggle(
        'hidden',
        tabName !== 'leaderboards'
    );

    cardsScreen.classList.toggle(
        'hidden',
        tabName !== 'cards'
    );

    if (tabName === 'generate') {

        handleRngGenerateTabActivation();

        return;
    }

    clearRngRarityTheme();

    startTabLoading(tabName);

    updateScrollRail();
}


generateButton.addEventListener(
    'click',
    () => {
        switchTab('generate');
    }
);


leaderboardsButton.addEventListener(
    'click',
    () => {
        switchTab('leaderboards');
    }
);


cardsButton.addEventListener(
    'click',
    () => {
        switchTab('cards');
    }
);


const scrollRail = document.querySelector('.scrollRail');


function updateScrollRail() {

    if (!scrollRail) {
        return;
    }

    const pageHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        mainScreen ? mainScreen.scrollHeight : 0,
        window.innerHeight
    );

    const spacing = 250;
    const edgeInset = 36;

    scrollRail.innerHTML = '';

    if (pageHeight <= window.innerHeight + 10) {
        return;
    }

    const availableHeight =
        Math.max(
            window.innerHeight -
                (edgeInset * 2),
            0
        );

    const count = Math.max(
        2,
        Math.ceil(
            (
                pageHeight -
                window.innerHeight
            ) / spacing
        ) + 1
    );

    for (let i = 0; i < count; i++) {

        const indicator = document.createElement('div');

        indicator.className = 'scrollIndicator';

        if (count === 1) {
            indicator.classList.add('single');
        } else if (i === 0) {
            indicator.classList.add('first');
        } else if (i === count - 1) {
            indicator.classList.add('last');
        }

        const ratio =
            count === 1
                ? 0
                : i / (count - 1);

        indicator.style.top =
            `${edgeInset + (availableHeight * ratio)}px`;

        const arrow =
            document.createElement('span');

        arrow.textContent =
            i === 0
                ? '↑'
                : i === count - 1
                    ? '↓'
                    : '↕';

        const label =
            document.createElement('strong');

        label.textContent = 'SCROLL';

        indicator.appendChild(arrow);
        indicator.appendChild(label);

        scrollRail.appendChild(indicator);
    }
}


window.addEventListener(
    'resize',
    updateScrollRail
);


if (typeof ResizeObserver !== 'undefined') {

    const scrollResizeObserver =
        new ResizeObserver(() => {
            updateScrollRail();
        });

    if (mainScreen) {
        scrollResizeObserver.observe(mainScreen);
    }

    scrollResizeObserver.observe(document.body);
}


updateScrollRail();


const tabButtons =
    document.querySelectorAll('.tabButton');


const normalButtons =
    document.querySelectorAll(
        'button:not(.tabButton)'
    );


const earthquakeStates =
    new Map();


function startButtonEarthquake(button) {

    if (earthquakeStates.has(button)) {
        return;
    }

    const startTime = performance.now();

    function animate(now) {

        if (!earthquakeStates.has(button)) {
            return;
        }

        const elapsed =
            now -
            startTime;

        if (elapsed >= 10000) {
            stopButtonEarthquake(button);
            return;
        }

        let x = 0;
        let y = 0;
        let rotation = 0;

        if (elapsed < 5000) {

            const progress =
                elapsed /
                5000;

            const intensity =
                progress *
                progress;

            const wave =
                Math.sin(
                    elapsed *
                    0.03
                );

            x =
                wave *
                1.3 *
                intensity;

            y =
                Math.cos(
                    elapsed *
                    0.037
                ) *
                1.1 *
                intensity;

            rotation =
                wave *
                0.45 *
                intensity;

        } else {

            const intensity =
                1;

            x =
                (
                    Math.random() -
                    0.5
                ) *
                5 *
                intensity;

            y =
                (
                    Math.random() -
                    0.5
                ) *
                4 *
                intensity;

            rotation =
                (
                    Math.random() -
                    0.5
                ) *
                1.5 *
                intensity;
        }

        button.style.transform =
            `translate(${x}px, ${y}px) rotate(${rotation}deg)`;

        const frame =
            requestAnimationFrame(
                animate
            );

        earthquakeStates.set(
            button,
            frame
        );
    }

    const frame =
        requestAnimationFrame(
            animate
        );

    earthquakeStates.set(
        button,
        frame
    );
}


function stopButtonEarthquake(button) {

    const frame =
        earthquakeStates.get(button);

    if (frame) {
        cancelAnimationFrame(frame);
    }

    earthquakeStates.delete(button);

    button.style.transform = '';
}


function playButtonAnimation(button) {

    stopButtonEarthquake(button);

    button
        .querySelectorAll(
            '.buttonEffectImage'
        )
        .forEach(
            element => element.remove()
        );

    button.classList.remove(
        'clickJerk'
    );

    void button.offsetWidth;

    button.classList.add(
        'clickJerk'
    );

    const car =
        document.createElement('img');

    car.src =
        './carvector.png';

    car.className =
        'buttonEffectImage carEffect';

    const tornado =
        document.createElement('img');

    tornado.src =
        './tornadovector.png';

    tornado.className =
        'buttonEffectImage tornadoEffect';

    button.appendChild(car);
    button.appendChild(tornado);

    setTimeout(() => {

        car.remove();
        tornado.remove();

    }, 4500);
}


tabButtons.forEach(
    button => {

        button.addEventListener(
            'pointerenter',
            () => {
                startButtonEarthquake(button);
            }
        );

        button.addEventListener(
            'pointerleave',
            () => {
                stopButtonEarthquake(button);
            }
        );

        button.addEventListener(
            'click',
            () => {
                playButtonAnimation(button);
            }
        );
    }
);


function startNormalButtonWiggle(button) {

    if (
        button.classList.contains(
            'tabButton'
        )
    ) {
        return;
    }

    button.classList.add(
        'normalButtonWiggle'
    );
}


function stopNormalButtonWiggle(button) {

    button.classList.remove(
        'normalButtonWiggle'
    );
}


normalButtons.forEach(
    button => {

        if (
            button.classList.contains(
                'hidden'
            )
        ) {
            return;
        }

        button.addEventListener(
            'pointerenter',
            () => {
                startNormalButtonWiggle(button);
            }
        );

        button.addEventListener(
            'pointerleave',
            () => {
                stopNormalButtonWiggle(button);
            }
        );

        button.addEventListener(
            'focus',
            () => {
                startNormalButtonWiggle(button);
            }
        );

        button.addEventListener(
            'blur',
            () => {
                stopNormalButtonWiggle(button);
            }
        );
    }
);


const RNG_RARITY_COLORS = {

    common: '#dce7f0',
    uncommon: '#4fd1c5',
    rare: '#4da6ff',
    legendary: '#ffd84d'

};


const RNG_RARITY_GRADIENTS = {

    common:
        'linear-gradient(135deg, #304b65 0%, #354653 46%, #31383d 100%)',

    uncommon:
        'linear-gradient(135deg, #205f5c 0%, #2b4f53 46%, #313b40 100%)',

    rare:
        'linear-gradient(135deg, #21598a 0%, #2d485f 46%, #303b43 100%)',

    legendary:
        'linear-gradient(135deg, #695719 0%, #50472f 46%, #343a3e 100%)'

};


const RNG_RANDOM_CHARACTERS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';


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
const RNG_RECORD_WIGGLE_DURATION = 2800;
const RNG_RECORD_WIGGLE_AMPLITUDE = 100;
const RNG_RECORD_WIGGLE_ROTATION = 24;


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
let rngRngTimeRefreshTimer = null;
let rngStoredResultScrollPending = false;


function getRandomRngCharacter() {

    return RNG_RANDOM_CHARACTERS[
        Math.floor(
            Math.random() *
            RNG_RANDOM_CHARACTERS.length
        )
    ];
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

    saveLocalRngRollState(
        rngNextResetTimestamp
    );

    if (
        rngRngTimeRefreshTimer
    ) {
        clearTimeout(
            rngRngTimeRefreshTimer
        );
    }

    rngRngTimeRefreshTimer =
        setTimeout(
            () => {
                requestRngServerTime();
            },
            1000
        );

    if (
        !rngFrontendInitialized
    ) {

        rngFrontendInitialized =
            true;

        initializeRngFrontend();

    } else {

        updateRngDailyCountdown();

        if (
            !getRngNextRollTimestamp() &&
            !rngResultPanel &&
            !rngScrambleElement &&
            !rngRequestPending &&
            !rngRollLoadingPending
        ) {
            initializeRngGenerateButton();
        }
    }

    maybePlayRngLaunchFlash();
}


function getRngServerNow() {

    if (
        typeof rngServerTimeBase !== 'number' ||
        !Number.isFinite(
            rngServerTimeBase
        ) ||
        typeof rngPerformanceTimeBase !== 'number' ||
        !Number.isFinite(
            rngPerformanceTimeBase
        )
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


function formatRngCountdown(
    milliseconds
) {

    const totalSeconds =
        Math.max(
            0,
            Math.ceil(
                milliseconds /
                1000
            )
        );

    const days =
        Math.floor(
            totalSeconds /
            86400
        );

    const hours =
        Math.floor(
            (
                totalSeconds %
                86400
            ) /
            3600
        );

    const minutes =
        Math.floor(
            (
                totalSeconds %
                3600
            ) /
            60
        );

    const seconds =
        totalSeconds %
        60;

    if (days > 0) {

        return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }

    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}


function sanitizeRngStoredResult(
    payload
) {

    if (
        !payload ||
        typeof payload !== 'object'
    ) {
        return null;
    }

    return {

        record:
            typeof payload.record === 'string'
                ? payload.record
                : '',

        rarity:
            typeof payload.rarity === 'string'
                ? payload.rarity
                : 'common',

        points:
            typeof payload.points === 'number' &&
            Number.isFinite(payload.points)
                ? payload.points
                : 0,

        lifetimeRecordScore:
            typeof payload.lifetimeRecordScore === 'number' &&
            Number.isFinite(payload.lifetimeRecordScore)
                ? payload.lifetimeRecordScore
                : typeof payload.lifetimeScore === 'number' &&
                  Number.isFinite(payload.lifetimeScore)
                    ? payload.lifetimeScore
                    : typeof payload.totalScore === 'number' &&
                      Number.isFinite(payload.totalScore)
                        ? payload.totalScore
                        : 0,

        timesRolled:
            typeof payload.timesRolled === 'number' &&
            Number.isFinite(payload.timesRolled)
                ? payload.timesRolled
                : typeof payload.rollCount === 'number' &&
                  Number.isFinite(payload.rollCount)
                    ? payload.rollCount
                    : 0,

        modifiers:
            payload.modifiers ?? []

    };
}


function loadLocalRngRollState() {

    try {

        const stored =
            localStorage.getItem(
                RNG_LOCAL_ROLL_STORAGE_KEY
            );

        if (!stored) {
            rngLocalRollState = null;
            return;
        }

        const timestamp =
            Number(stored);

        if (
            !Number.isFinite(
                timestamp
            )
        ) {
            rngLocalRollState = null;
            return;
        }

        rngLocalRollState =
            timestamp;

    } catch (err) {

        rngLocalRollState = null;

    }
}


function saveLocalRngRollState(
    timestamp
) {

    if (
        typeof timestamp !== 'number' ||
        !Number.isFinite(timestamp)
    ) {
        return;
    }

    rngLocalRollState =
        timestamp;

    try {

        localStorage.setItem(
            RNG_LOCAL_ROLL_STORAGE_KEY,
            String(timestamp)
        );

    } catch (err) {
        return;
    }
}


function clearLocalRngRollState() {

    rngLocalRollState = null;

    try {

        localStorage.removeItem(
            RNG_LOCAL_ROLL_STORAGE_KEY
        );

    } catch (err) {
        return;
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

        const parsed =
            JSON.parse(
                stored
            );

        return sanitizeRngStoredResult(
            parsed
        );

    } catch (err) {

        return null;

    }
}


function saveLocalRngResult(
    payload
) {

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
        return;
    }
}


function clearLocalRngResult() {

    try {

        localStorage.removeItem(
            RNG_LOCAL_RESULT_STORAGE_KEY
        );

    } catch (err) {
        return;
    }
}


function getRngNextRollTimestamp() {

    if (
        typeof rngNextResetTimestamp === 'number' &&
        Number.isFinite(
            rngNextResetTimestamp
        ) &&
        rngNextResetTimestamp > 0
    ) {
        return rngNextResetTimestamp;
    }

    return null;
}


function createRngTopControlArea() {

    if (rngTopControlArea) {
        return rngTopControlArea;
    }

    rngTopControlArea =
        document.createElement('div');

    rngTopControlArea.className =
        'rngTopControlArea';

    rngControlSlot =
        document.createElement('div');

    rngControlSlot.style.width =
        '100%';

    rngControlSlot.style.minHeight =
        '86px';

    rngControlSlot.style.display =
        'flex';

    rngControlSlot.style.alignItems =
        'center';

    rngControlSlot.style.justifyContent =
        'center';

    rngControlSlot.style.boxSizing =
        'border-box';

    rngTopControlArea.appendChild(
        rngControlSlot
    );

    generateScreen.appendChild(
        rngTopControlArea
    );

    return rngTopControlArea;
}


function createRngDailyStatus() {

    if (rngDailyStatus) {
        return rngDailyStatus;
    }

    rngDailyStatus =
        document.createElement('div');

    rngDailyStatus.className =
        'rngDailyStatus';

    rngDailyMessage =
        document.createElement('div');

    rngDailyMessage.className =
        'rngDailyMessage';

    rngDailyCountdown =
        document.createElement('div');

    rngDailyCountdown.className =
        'rngDailyCountdown';

    rngDailyMessage.textContent =
        'Next record available in';

    rngDailyStatus.appendChild(
        rngDailyMessage
    );

    rngDailyStatus.appendChild(
        rngDailyCountdown
    );

    rngControlSlot.appendChild(
        rngDailyStatus
    );

    return rngDailyStatus;
}


function updateRngDailyCountdown() {

    if (
        !rngDailyStatus ||
        !rngDailyCountdown
    ) {
        return;
    }

    const nextRollTimestamp =
        getRngNextRollTimestamp();

    const serverNow =
        getRngServerNow();

    if (
        !nextRollTimestamp ||
        typeof serverNow !== 'number' ||
        !Number.isFinite(serverNow)
    ) {

        stopRngDailyCountdown();

        rngDailyStatus.classList.add(
            'hidden'
        );

        if (
            rngDailyActionArea
        ) {
            return;
        }

        if (
            !rngResultPanel &&
            !rngScrambleElement &&
            !rngRequestPending &&
            !rngRollLoadingPending
        ) {
            initializeRngGenerateButton();
        }

        return;
    }

    const remaining =
        nextRollTimestamp -
        serverNow;

    if (
        remaining <= 0
    ) {

        handleRngCooldownExpired();

        return;
    }

    rngDailyStatus.classList.remove(
        'hidden'
    );

    rngDailyMessage.textContent =
        'Next record available in';

    rngDailyCountdown.textContent =
        formatRngCountdown(
            remaining
        );

    if (
        !rngCountdownTimer
    ) {

        rngCountdownTimer =
            setInterval(
                () => {

                    const currentNextRoll =
                        getRngNextRollTimestamp();

                    const currentServerNow =
                        getRngServerNow();

                    if (
                        !currentNextRoll ||
                        typeof currentServerNow !== 'number'
                    ) {

                        stopRngDailyCountdown();

                        rngDailyStatus.classList.add(
                            'hidden'
                        );

                        initializeRngGenerateButton();

                        return;
                    }

                    const currentRemaining =
                        currentNextRoll -
                        currentServerNow;

                    if (
                        currentRemaining <= 0
                    ) {

                        handleRngCooldownExpired();

                        return;
                    }

                    rngDailyStatus.classList.remove(
                        'hidden'
                    );

                    rngDailyCountdown.textContent =
                        formatRngCountdown(
                            currentRemaining
                        );

                },
                250
            );
    }
}


function startRngDailyCountdown() {
    updateRngDailyCountdown();
}


function stopRngDailyCountdown() {

    if (rngCountdownTimer) {

        clearInterval(
            rngCountdownTimer
        );

        rngCountdownTimer =
            null;
    }
}


function hideRngDailyStatus() {

    stopRngDailyCountdown();

    if (rngDailyStatus) {
        rngDailyStatus.classList.add(
            'hidden'
        );
    }
}


function showRngDailyStatus() {

    if (rngDailyStatus) {
        rngDailyStatus.classList.remove(
            'hidden'
        );
    }
}


function clearRngRarityTheme() {

    RNG_RARITY_THEME_CLASSES.forEach(
        className => {
            document.body.classList.remove(
                className
            );
        }
    );

    document.body.style.background = '';
}


function normalizeRngRarity(
    rarity
) {

    if (
        typeof rarity !== 'string'
    ) {
        return 'common';
    }

    const normalized =
        rarity
            .trim()
            .toLowerCase();

    if (
        RNG_RARITY_THEME_CLASSES
            .includes(
                `rng-rarity-${normalized}`
            )
    ) {
        return normalized;
    }

    return 'common';
}


function getRngDisplayRarity(
    payload
) {

    const baseRarity =
        normalizeRngRarity(
            payload &&
            payload.rarity
        );

    /*
    FUTURE MODIFIER-BASED RARITY PROCESSING
    */

    return baseRarity;
}


function applyRngRarityTheme(
    rarity
) {

    const normalized =
        normalizeRngRarity(
            rarity
        );

    clearRngRarityTheme();

    document.body.classList.add(
        `rng-rarity-${normalized}`
    );
}


function getRngRarityGradient(
    rarity
) {

    const normalized =
        normalizeRngRarity(
            rarity
        );

    return (
        RNG_RARITY_GRADIENTS[
            normalized
        ] ||
        RNG_RARITY_GRADIENTS.common
    );
}


function playRngLaunchFlash() {

    const existing =
        document.querySelector(
            '.rngLaunchFlash'
        );

    if (existing) {
        existing.remove();
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
        {
            once: true
        }
    );
}


function requestRngLaunchFlash() {
    rngLaunchFlashPending = true;
}


function maybePlayRngLaunchFlash() {

    if (!rngLaunchFlashPending) {
        return;
    }

    rngLaunchFlashPending = false;

    playRngLaunchFlash();
}


function scrollRngResultIntoView(
    element
) {

    if (!element) {
        return;
    }

    requestAnimationFrame(
        () => {

            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });

        }
    );
}


function clearRngRecordCardWiggle() {

    if (rngRecordCardWiggleFrame) {

        cancelAnimationFrame(
            rngRecordCardWiggleFrame
        );

        rngRecordCardWiggleFrame =
            null;
    }

    document
        .querySelectorAll(
            '.rngRecordCard'
        )
        .forEach(
            card => {
                card.style.transform = '';
            }
        );
}


function startRngRecordCardWiggle(
    card
) {

    clearRngRecordCardWiggle();

    if (!card) {
        return;
    }

    const startTime =
        performance.now();

    function animate(now) {

        if (
            !document.body.contains(
                card
            )
        ) {
            rngRecordCardWiggleFrame =
                null;
            return;
        }

        const elapsed =
            now -
            startTime;

        if (
            elapsed >=
            RNG_RECORD_WIGGLE_DURATION
        ) {

            card.style.transform = '';

            rngRecordCardWiggleFrame =
                null;

            return;
        }

        const progress =
            elapsed /
            RNG_RECORD_WIGGLE_DURATION;

        const envelope =
            Math.sin(
                Math.PI *
                Math.min(
                    progress,
                    1
                )
            );

        const sineA =
            Math.sin(
                elapsed *
                0.035
            );

        const sineB =
            Math.sin(
                elapsed *
                0.071
            );

        const x =
            (
                (
                    sineA *
                    0.72
                ) +
                (
                    sineB *
                    0.28
                )
            ) *
            RNG_RECORD_WIGGLE_AMPLITUDE *
            envelope;

        const rotation =
            (
                (
                    sineA *
                    0.75
                ) +
                (
                    sineB *
                    0.25
                )
            ) *
            RNG_RECORD_WIGGLE_ROTATION *
            envelope;

        const y =
            Math.sin(
                elapsed *
                0.047
            ) *
            30 *
            envelope;

        card.style.transform =
            `translate(${x}px, ${y}px) rotate(${rotation}deg)`;

        rngRecordCardWiggleFrame =
            requestAnimationFrame(
                animate
            );
    }

    rngRecordCardWiggleFrame =
        requestAnimationFrame(
            animate
        );
}


function handleRngCooldownExpired() {

    stopRngDailyCountdown();

    rngNextResetTimestamp = null;

    clearLocalRngRollState();

    hideRngDailyStatus();

    if (rngScrambleTimer) {
        clearTimeout(rngScrambleTimer);
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

    clearLocalRngResult();

    clearRngRecordCardWiggle();

    clearRngRarityTheme();

    if (
        currentTab === 'generate' &&
        !rngRequestPending &&
        !rngRollLoadingPending
    ) {
        initializeRngGenerateButton();
    }

    updateScrollRail();
}


function handleRngGenerateTabActivation() {

    const nextRollTimestamp =
        getRngNextRollTimestamp();

    const serverNow =
        getRngServerNow();

    if (
        nextRollTimestamp &&
        typeof serverNow === 'number'
    ) {

        if (
            serverNow >=
            nextRollTimestamp
        ) {

            handleRngCooldownExpired();

            return;
        }

        if (rngResultPanel) {

            const card =
                rngResultPanel.querySelector(
                    '.rngRecordCard'
                );

            if (card) {

                const rarity =
                    card.dataset.rngRarity ||
                    'common';

                applyRngRarityTheme(
                    rarity
                );

                startRngRecordCardWiggle(
                    card
                );

                requestRngLaunchFlash();
                maybePlayRngLaunchFlash();
            }

        } else if (
            rngScrambleElement
        ) {

            return;

        } else {

            updateRngDailyCountdown();
        }

        return;
    }

    hideRngDailyStatus();

    if (
        rngResultPanel
    ) {
        rngResultPanel.remove();
        rngResultPanel = null;
    }

    clearRngRarityTheme();

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

    const elements =
        card.querySelectorAll(
            '.rngRecordLabel, .rngRecordValue, .rngStat, .rngStatLabel, .rngStatValue, .rngModifiersTitle, .rngModifier, .rngModifierName, .rngModifierValue, .rngNoModifiers'
        );

    let lifetimeAnimationTriggered =
        false;

    elements.forEach(
        (
            element,
            index
        ) => {

            element.classList.remove(
                'rngResultPopIn'
            );

            element.style.opacity =
                '0';

            element.style.transform =
                'translateY(12px) scale(0.88)';

            element.style.setProperty(
                '--rng-pop-delay',
                `${index * RNG_POP_INTERVAL}ms`
            );

            void element.offsetWidth;

            element.classList.add(
                'rngResultPopIn'
            );

            element.addEventListener(
                'animationend',
                event => {

                    if (
                        event.animationName !==
                        'rngResultPopIn'
                    ) {
                        return;
                    }

                    if (
                        element.classList.contains(
                            'rngLifetimeStatValue'
                        ) &&
                        !lifetimeAnimationTriggered
                    ) {

                        lifetimeAnimationTriggered =
                            true;

                        if (
                            typeof onLifetimeLabelShown ===
                            'function'
                        ) {
                            onLifetimeLabelShown();
                        }
                    }

                    element.classList.remove(
                        'rngResultPopIn'
                    );

                    element.style.opacity =
                        '1';

                    element.style.transform =
                        'none';

                },
                {
                    once: true
                }
            );
        }
    );

    const finalDelay =
        (
            elements.length -
            1
        ) *
        RNG_POP_INTERVAL +
        RNG_POP_DURATION;

    setTimeout(
        () => {

            card.classList.remove(
                'rngRecordCardFinalPop'
            );

            void card.offsetWidth;

            card.classList.add(
                'rngRecordCardFinalPop'
            );

            card.addEventListener(
                'animationend',
                event => {

                    if (
                        event.animationName !==
                        'rngRecordCardFinalPop'
                    ) {
                        return;
                    }

                    card.classList.remove(
                        'rngRecordCardFinalPop'
                    );

                    card.style.transform =
                        '';

                    startRngRecordCardWiggle(
                        card
                    );

                    playRngLaunchFlash();

                },
                {
                    once: true
                }
            );

        },
        finalDelay
    );
}


function clearRngLifetimeAnimation() {

    if (rngLifetimeRollTimer) {

        clearTimeout(
            rngLifetimeRollTimer
        );

        rngLifetimeRollTimer =
            null;
    }

    rngLifetimeAnimationFrames.forEach(
        frame => {
            cancelAnimationFrame(
                frame
            );
        }
    );

    rngLifetimeAnimationFrames = [];

    rngLifetimeAnimationActive =
        false;
}


function resetDailyRngFrontend() {

    stopRngDailyCountdown();

    clearLocalRngRollState();
    clearLocalRngResult();

    rngNextResetTimestamp =
        null;

    rngPendingLifetimeScore =
        null;

    clearRngLifetimeAnimation();
    clearRngRecordCardWiggle();

    if (rngScrambleTimer) {
        clearTimeout(rngScrambleTimer);
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

    if (rngDailyActionArea) {
        rngDailyActionArea.remove();
        rngDailyActionArea = null;
    }

    clearRngRarityTheme();

    hideRngDailyStatus();

    requestRngServerTime();

    if (
        currentTab === 'generate'
    ) {
        initializeRngGenerateButton();
    }

    updateScrollRail();
}


function markRngRollComplete(
    payload
) {

    saveLocalRngResult(
        payload
    );

    if (
        typeof rngNextResetTimestamp === 'number' &&
        Number.isFinite(
            rngNextResetTimestamp
        )
    ) {
        saveLocalRngRollState(
            rngNextResetTimestamp
        );
    }

    rngLocalRollState =
        rngNextResetTimestamp;

    updateRngDailyCountdown();

    sendRngLifetimeUpdate(
        payload
    );

    if (rngDailyActionArea) {
        rngDailyActionArea.remove();
        rngDailyActionArea = null;
    }
}


function getRngLifetimePayloadScore(
    payload
) {

    if (
        !payload ||
        typeof payload !== 'object'
    ) {
        return null;
    }

    const score =
        payload.lifetimeRecordScore ??
        payload.lifetimeScore ??
        payload.totalScore;

    if (
        typeof score !== 'number' ||
        !Number.isFinite(score)
    ) {
        return null;
    }

    return score;
}


function getRngLifetimeStatValueElement() {

    if (!rngResultPanel) {
        return null;
    }

    return rngResultPanel.querySelector(
        '.rngLifetimeScoreValue'
    );
}


function createRngLifetimeDigitFace(
    value
) {

    const face =
        document.createElement('div');

    face.className =
        'rngLifetimeDigitFace';

    face.textContent =
        value;

    return face;
}


function getRngLifetimeReelDigit(
    value
) {

    const numeric =
        Number(
            value
        );

    if (
        !Number.isFinite(
            numeric
        )
    ) {
        return '0';
    }

    return String(
        Math.abs(
            Math.trunc(
                numeric
            )
        ) %
        10
    );
}


function createRngLifetimeDigitReel(
    digit,
    nextDigit,
    steps
) {

    const wrapper =
        document.createElement('div');

    wrapper.className =
        'rngLifetimeDigit';

    const strip =
        document.createElement('div');

    strip.className =
        'rngLifetimeDigitStrip';

    const visibleFaces =
        Math.max(
            1,
            steps
        );

    strip.appendChild(
        createRngLifetimeDigitFace(
            digit
        )
    );

    for (
        let i = 0;
        i < visibleFaces;
        i++
    ) {

        strip.appendChild(
            createRngLifetimeDigitFace(
                getRngLifetimeReelDigit(
                    Number(digit) +
                    i +
                    1
                )
            )
        );
    }

    strip.appendChild(
        createRngLifetimeDigitFace(
            nextDigit
        )
    );

    wrapper.appendChild(
        strip
    );

    return {
        wrapper,
        strip
    };
}


function updateRngLifetimeDigitFaces(
    strip,
    digit,
    nextDigit,
    steps
) {

    while (
        strip.children.length < steps + 2
    ) {

        strip.appendChild(
            createRngLifetimeDigitFace(
                '0'
            )
        );
    }

    const faces =
        strip.children;

    if (faces[0]) {
        faces[0].textContent =
            digit;
    }

    for (
        let i = 1;
        i <= steps;
        i++
    ) {

        if (faces[i]) {

            faces[i].textContent =
                getRngLifetimeReelDigit(
                    Number(digit) +
                    i
                );
        }
    }

    if (
        faces[steps + 1]
    ) {
        faces[steps + 1].textContent =
            nextDigit;
    }
}


function easeRngLifetimeRoll(
    progress
) {

    return (
        1 -
        Math.pow(
            1 -
            progress,
            3
        )
    );
}


function startRngLifetimeDigitReel(
    reel,
    digit,
    nextDigit,
    startTime,
    duration
) {

    const startOffset =
        0;

    const faceHeight =
        18;

    function animate(now) {

        if (
            !rngLifetimeAnimationActive
        ) {
            return;
        }

        const progress =
            Math.min(
                1,
                (
                    now -
                    startTime
                ) /
                duration
            );

        const eased =
            easeRngLifetimeRoll(
                progress
            );

        const offset =
            startOffset +
            (
                (
                    RNG_LIFETIME_VISIBLE_STEPS +
                    1
                ) *
                faceHeight *
                eased
            );

        reel.style.transform =
            `translateY(-${offset}px)`;

        if (
            progress < 1
        ) {

            const frame =
                requestAnimationFrame(
                    animate
                );

            rngLifetimeAnimationFrames.push(
                frame
            );

            return;
        }

        reel.style.transform =
            `translateY(-${(
                (
                    RNG_LIFETIME_VISIBLE_STEPS +
                    1
                ) *
                faceHeight
            )}px)`;
    }

    const frame =
        requestAnimationFrame(
            animate
        );

    rngLifetimeAnimationFrames.push(
        frame
    );
}


function animateRngLifetimeScore(
    element,
    oldScore,
    newScore
) {

    if (!element) {
        return;
    }

    clearRngLifetimeAnimation();

    const oldValue =
        Number(
            oldScore
        );

    const newValue =
        Number(
            newScore
        );

    if (
        !Number.isFinite(oldValue) ||
        !Number.isFinite(newValue)
    ) {
        return;
    }

    if (
        oldValue ===
        newValue
    ) {

        element.textContent =
            String(
                Math.trunc(
                    newValue
                )
            );

        return;
    }

    const normalValue =
        element.querySelector(
            '.rngLifetimeNormalValue'
        ) ||
        document.createElement('span');

    normalValue.className =
        'rngLifetimeNormalValue';

    normalValue.textContent =
        String(
            Math.trunc(
                oldValue
            )
        );

    element.innerHTML = '';

    element.appendChild(
        normalValue
    );

    const wheel =
        document.createElement('span');

    wheel.className =
        'rngLifetimeWheel';

    const oldString =
        String(
            Math.trunc(
                Math.abs(
                    oldValue
                )
            )
        );

    const newString =
        String(
            Math.trunc(
                Math.abs(
                    newValue
                )
            )
        );

    const digitLength =
        Math.max(
            oldString.length,
            newString.length
        );

    const paddedOld =
        oldString.padStart(
            digitLength,
            '0'
        );

    const paddedNew =
        newString.padStart(
            digitLength,
            '0'
        );

    for (
        let i = 0;
        i < digitLength;
        i++
    ) {

        const currentDigit =
            paddedOld[i];

        const nextDigit =
            paddedNew[i];

        const reelData =
            createRngLifetimeDigitReel(
                currentDigit,
                nextDigit,
                RNG_LIFETIME_VISIBLE_STEPS
            );

        wheel.appendChild(
            reelData.wrapper
        );

        updateRngLifetimeDigitFaces(
            reelData.strip,
            currentDigit,
            nextDigit,
            RNG_LIFETIME_VISIBLE_STEPS
        );
    }

    wheel.style.opacity =
        '1';

    element.appendChild(
        wheel
    );

    rngLifetimeAnimationActive =
        true;

    rngLifetimeRollTimer =
        setTimeout(
            () => {

                const startTime =
                    performance.now();

                const reels =
                    wheel.querySelectorAll(
                        '.rngLifetimeDigitStrip'
                    );

                reels.forEach(
                    (
                        reel,
                        index
                    ) => {

                        startRngLifetimeDigitReel(
                            reel,
                            paddedOld[index],
                            paddedNew[index],
                            startTime +
                            (
                                index *
                                RNG_LIFETIME_DIGIT_STAGGER
                            ),
                            RNG_LIFETIME_ROLL_DURATION
                        );
                    }
                );

                setTimeout(
                    () => {

                        wheel.style.opacity =
                            '0';

                        setTimeout(
                            () => {

                                if (
                                    wheel.parentNode
                                ) {
                                    wheel.remove();
                                }

                                normalValue.textContent =
                                    String(
                                        Math.trunc(
                                            newValue
                                        )
                                    );

                                element.dataset.rngLifetimeConfirmedScore =
                                    String(
                                        newValue
                                    );

                                rngLifetimeAnimationActive =
                                    false;

                            },
                            RNG_LIFETIME_FADE_DURATION
                        );

                    },
                    RNG_LIFETIME_ROLL_DURATION
                );

            },
            270
        );
}


function scheduleRngLifetimeScoreAnimation(
    payload
) {

    const newScore =
        getRngLifetimePayloadScore(
            payload
        );

    if (
        typeof newScore !== 'number'
    ) {
        return;
    }

    rngLifetimeRollTimer =
        setTimeout(
            () => {

                const element =
                    getRngLifetimeStatValueElement();

                if (!element) {
                    return;
                }

                const normalValue =
                    element.querySelector(
                        '.rngLifetimeNormalValue'
                    );

                const currentScore =
                    normalValue
                        ? Number(
                            normalValue.textContent
                        )
                        : Number(
                            element.textContent
                        );

                if (
                    !Number.isFinite(
                        currentScore
                    )
                ) {
                    return;
                }

                animateRngLifetimeScore(
                    element,
                    currentScore,
                    newScore
                );

            },
            RNG_LIFETIME_ROLL_DELAY
        );
}


function sendRngLifetimeUpdate(
    payload
) {

    const lifetimeScore =
        getRngLifetimePayloadScore(
            payload
        );

    const points =
        payload &&
        typeof payload.points === 'number' &&
        Number.isFinite(
            payload.points
        )
            ? payload.points
            : 0;

    const currentLifetime =
        lifetimeScore !== null
            ? lifetimeScore
            : 0;

    const newLifetimeScore =
        currentLifetime +
        points;

    rngPendingLifetimeScore =
        newLifetimeScore;

    if (
        !socket ||
        socket.readyState !==
            WebSocket.OPEN
    ) {
        console.log(
            "Lifetime update skipped because socket is not open."
        );
        return;
    }

    const request =
        {
            protocol: "cardgame",
            version: 1,
            request: "rng_lifetime_update",
            info: {
                score:
                    newLifetimeScore
            }
        };

    console.log(
        "Sending RNG lifetime update:",
        request
    );

    socket.send(
        JSON.stringify(
            request
        )
    );

    scheduleRngLifetimeScoreAnimation(
        payload
    );
}


function applyRngLifetimeUpdateResult(
    score
) {

    if (
        typeof score !== 'number' ||
        !Number.isFinite(
            score
        )
    ) {
        return;
    }

    rngPendingLifetimeScore =
        score;

    const stored =
        loadLocalRngResult();

    if (
        stored
    ) {

        stored.lifetimeRecordScore =
            score;

        saveLocalRngResult(
            stored
        );
    }

    const element =
        getRngLifetimeStatValueElement();

    if (element) {

        element.dataset.rngLifetimeConfirmedScore =
            String(
                score
            );

        const normalValue =
            element.querySelector(
                '.rngLifetimeNormalValue'
            );

        if (
            normalValue &&
            !rngLifetimeAnimationActive
        ) {

            normalValue.textContent =
                String(
                    Math.trunc(
                        score
                    )
                );
        }
    }
}


function applyDailyRollState(
    payload
) {
    return;
}


function renderStoredRngResult(
    payload
) {

    if (!payload) {
        return;
    }

    const nextRollTimestamp =
        getRngNextRollTimestamp();

    const serverNow =
        getRngServerNow();

    if (
        !nextRollTimestamp ||
        typeof serverNow !== 'number' ||
        serverNow >= nextRollTimestamp
    ) {
        clearLocalRngResult();
        return;
    }

    if (rngScrambleElement) {
        rngScrambleElement.remove();
        rngScrambleElement = null;
    }

    if (rngResultPanel) {
        rngResultPanel.remove();
        rngResultPanel = null;
    }

    const rarity =
        getRngDisplayRarity(
            payload
        );

    applyRngRarityTheme(
        rarity
    );

    rngResultPanel =
        document.createElement('div');

    rngResultPanel.className =
        'rngResultPanel';

    const card =
        createRngRecordCard(
            payload
        );

    rngResultPanel.appendChild(
        card
    );

    generateScreen.appendChild(
        rngResultPanel
    );

    if (
        mainScreen.classList.contains(
            'hidden'
        )
    ) {

        rngStoredResultScrollPending =
            true;

    }

    animateRngRecordCard(
        card
    );

    updateScrollRail();
}


function normalizeRngModifiers(
    modifiers
) {

    if (
        Array.isArray(
            modifiers
        )
    ) {

        return modifiers.map(
            modifier => {

                if (
                    modifier &&
                    typeof modifier === 'object'
                ) {

                    return {
                        label:
                            modifier.label ??
                            modifier.name ??
                            'Modifier',

                        value:
                            modifier.value ??
                            modifier.description ??
                            ''
                    };
                }

                return {
                    label:
                        'Modifier',

                    value:
                        modifier
                };
            }
        );
    }

    if (
        modifiers &&
        typeof modifiers === 'object'
    ) {

        return Object.entries(
            modifiers
        ).map(
            (
                [
                    key,
                    value
                ]
            ) => ({
                label: key,
                value
            })
        );
    }

    if (
        modifiers !== null &&
        modifiers !== undefined &&
        modifiers !== ''
    ) {

        return [{
            label:
                'Modifier',
            value:
                modifiers
        }];
    }

    return [];
}


function formatRngValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {
        return '—';
    }

    if (
        typeof value === 'number' &&
        Number.isFinite(
            value
        )
    ) {
        return value.toLocaleString();
    }

    return String(
        value
    );
}


function getRngRarityColor(
    rarity
) {

    const normalized =
        normalizeRngRarity(
            rarity
        );

    return (
        RNG_RARITY_COLORS[
            normalized
        ] ||
        RNG_RARITY_COLORS.common
    );
}


function createRngStat(
    label,
    value,
    options = {}
) {

    const stat =
        document.createElement('div');

    stat.className =
        'rngStat';

    const labelElement =
        document.createElement('div');

    labelElement.className =
        'rngStatLabel';

    const valueElement =
        document.createElement('div');

    valueElement.className =
        'rngStatValue';

    labelElement.textContent =
        label;

    const isLifetime =
        options.lifetime === true;

    if (isLifetime) {

        stat.classList.add(
            'rngLifetimeStat'
        );

        labelElement.classList.add(
            'rngLifetimeStatLabel'
        );

        valueElement.classList.add(
            'rngLifetimeStatValue'
        );

    }

    if (
        options.rarity === true
    ) {

        stat.classList.add(
            'rngRarityStat'
        );

        valueElement.classList.add(
            'rngRarityValue'
        );

        const normalizedRarity =
            normalizeRngRarity(
                value
            );

        valueElement.dataset.rngRarity =
            normalizedRarity;

        stat.dataset.rngRarity =
            normalizedRarity;

        if (
            normalizedRarity === 'rare' ||
            normalizedRarity === 'legendary'
        ) {

            valueElement.classList.add(
                'rngRarityShiny'
            );
        }
    }

    if (
        isLifetime
    ) {

        valueElement.classList.add(
            'rngLifetimeScoreValue'
        );

        const normalValue =
            document.createElement('span');

        normalValue.className =
            'rngLifetimeNormalValue';

        normalValue.textContent =
            formatRngValue(
                value
            );

        valueElement.appendChild(
            normalValue
        );

        valueElement.setAttribute(
            'aria-label',
            `Total Score ${formatRngValue(value)}`
        );

    } else {

        valueElement.textContent =
            formatRngValue(
                value
            );
    }

    if (
        options.rarity === true
    ) {

        valueElement.style.color =
            getRngRarityColor(
                value
            );
    }

    stat.appendChild(
        labelElement
    );

    stat.appendChild(
        valueElement
    );

    return stat;
}


function createRngRecordCard(
    payload
) {

    const card =
        document.createElement('div');

    const rarity =
        getRngDisplayRarity(
            payload
        );

    card.className =
        `rngRecordCard rng-rarity-${rarity}`;

    card.dataset.rngRarity =
        rarity;

    card.style.background =
        getRngRarityGradient(
            rarity
        );

    const header =
        document.createElement('div');

    header.className =
        'rngRecordHeader';

    const recordLabel =
        document.createElement('div');

    recordLabel.className =
        'rngRecordLabel';

    recordLabel.textContent =
        'Record';

    const recordValue =
        document.createElement('div');

    recordValue.className =
        'rngRecordValue';

    recordValue.textContent =
        typeof payload.record === 'string'
            ? payload.record
            : '';

    header.appendChild(
        recordLabel
    );

    header.appendChild(
        recordValue
    );

    const stats =
        document.createElement('div');

    stats.className =
        'rngStats';

    const rarityStat =
        createRngStat(
            'Rarity',
            rarity,
            {
                rarity: true
            }
        );

    const points =
        typeof payload.points === 'number' &&
        Number.isFinite(
            payload.points
        )
            ? payload.points
            : 0;

    const lifetimeScore =
        getRngLifetimePayloadScore(
            payload
        );

    const timesRolled =
        typeof payload.timesRolled === 'number' &&
        Number.isFinite(
            payload.timesRolled
        )
            ? payload.timesRolled
            : typeof payload.rollCount === 'number' &&
              Number.isFinite(
                payload.rollCount
              )
                ? payload.rollCount
                : 0;

    stats.appendChild(
        rarityStat
    );

    stats.appendChild(
        createRngStat(
            'Points',
            points
        )
    );

    stats.appendChild(
        createRngStat(
            'Lifetime Score',
            lifetimeScore ?? 0,
            {
                lifetime: true
            }
        )
    );

    stats.appendChild(
        createRngStat(
            'Times Rolled',
            timesRolled
        )
    );

    const modifiersSection =
        document.createElement('div');

    modifiersSection.className =
        'rngModifiersSection';

    const modifiersTitle =
        document.createElement('div');

    modifiersTitle.className =
        'rngModifiersTitle';

    modifiersTitle.textContent =
        'Modifiers';

    modifiersSection.appendChild(
        modifiersTitle
    );

    const modifiers =
        normalizeRngModifiers(
            payload.modifiers
        );

    if (
        modifiers.length > 0
    ) {

        const modifiersContainer =
            document.createElement('div');

        modifiersContainer.className =
            'rngModifiers';

        modifiers.forEach(
            modifier => {

                const modifierElement =
                    document.createElement('div');

                modifierElement.className =
                    'rngModifier';

                const name =
                    document.createElement('div');

                name.className =
                    'rngModifierName';

                name.textContent =
                    String(
                        modifier.label
                    );

                const modifierValue =
                    document.createElement('div');

                modifierValue.className =
                    'rngModifierValue';

                modifierValue.textContent =
                    formatRngValue(
                        modifier.value
                    );

                modifierElement.appendChild(
                    name
                );

                modifierElement.appendChild(
                    modifierValue
                );

                modifiersContainer.appendChild(
                    modifierElement
                );
            }
        );

        modifiersSection.appendChild(
            modifiersContainer
        );

    } else {

        const noModifiers =
            document.createElement('div');

        noModifiers.className =
            'rngNoModifiers';

        noModifiers.textContent =
            'No modifiers';

        modifiersSection.appendChild(
            noModifiers
        );
    }

    card.appendChild(
        header
    );

    card.appendChild(
        stats
    );

    card.appendChild(
        modifiersSection
    );

    return card;
}


function showRngRecordResult(
    payload
) {

    stopRngDailyCountdown();

    if (rngScrambleTimer) {
        clearTimeout(rngScrambleTimer);
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
        typeof payload !== 'object'
    ) {

        errorMessage.textContent =
            '⚠️ Invalid RNG result payload.';

        errorMessage.classList.remove(
            'hidden'
        );

        return;
    }

    const sanitized =
        sanitizeRngStoredResult(
            payload
        );

    if (!sanitized) {

        errorMessage.textContent =
            '⚠️ Invalid RNG result payload.';

        errorMessage.classList.remove(
            'hidden'
        );

        return;
    }

    const rarity =
        getRngDisplayRarity(
            sanitized
        );

    applyRngRarityTheme(
        rarity
    );

    const record =
        typeof sanitized.record === 'string'
            ? sanitized.record
            : '';

    if (!record) {

        rngResultPanel =
            document.createElement('div');

        rngResultPanel.className =
            'rngResultPanel';

        const card =
            createRngRecordCard(
                sanitized
            );

        rngResultPanel.appendChild(
            card
        );

        generateScreen.appendChild(
            rngResultPanel
        );

        if (
            currentTab === 'generate'
        ) {

            scrollRngResultIntoView(
                card
            );
        }

        requestRngLaunchFlash();

        animateRngRecordCard(
            card,
            () => {
                scheduleRngLifetimeScoreAnimation(
                    sanitized
                );
            }
        );

        updateRngDailyCountdown();
        updateScrollRail();

        return;
    }

    rngScrambleElement =
        document.createElement('div');

    rngScrambleElement.className =
        'rngScramble';

    rngScrambleElement.textContent =
        '';

    generateScreen.appendChild(
        rngScrambleElement
    );

    const recordCharacters =
        Array.from(
            record
        );

    let displayedCharacters =
        recordCharacters.map(
            () => ''
        );

    const startedAt =
        performance.now();

    rngScrambleProgressTimer =
        setInterval(
            () => {

                const elapsed =
                    performance.now() -
                    startedAt;

                const progress =
                    Math.min(
                        1,
                        elapsed /
                        RNG_SCRAMBLE_DURATION
                    );

                const visibleCount =
                    Math.floor(
                        recordCharacters.length *
                        progress
                    );

                displayedCharacters =
                    recordCharacters.map(
                        (
                            character,
                            index
                        ) => {

                            if (
                                index <
                                visibleCount
                            ) {
                                return character;
                            }

                            return getRandomRngCharacter();
                        }
                    );

                rngScrambleElement.textContent =
                    displayedCharacters.join('');

                if (
                    progress >= 1
                ) {

                    clearInterval(
                        rngScrambleProgressTimer
                    );

                    rngScrambleProgressTimer =
                        null;

                    finishRngScramble(
                        sanitized
                    );
                }

            },
            RNG_SCRAMBLE_TICK
        );

    rngScrambleTimer =
        setTimeout(
            () => {

                if (
                    rngScrambleProgressTimer
                ) {

                    clearInterval(
                        rngScrambleProgressTimer
                    );

                    rngScrambleProgressTimer =
                        null;
                }

                finishRngScramble(
                    sanitized
                );

            },
            RNG_SCRAMBLE_DURATION +
            100
        );
}


function finishRngScramble(
    payload
) {

    if (rngScrambleTimer) {

        clearTimeout(
            rngScrambleTimer
        );

        rngScrambleTimer =
            null;
    }

    if (rngScrambleProgressTimer) {

        clearInterval(
            rngScrambleProgressTimer
        );

        rngScrambleProgressTimer =
            null;
    }

    if (!rngScrambleElement) {
        return;
    }

    const scramble =
        rngScrambleElement;

    const record =
        typeof payload.record === 'string'
            ? payload.record
            : '';

    scramble.textContent =
        record;

    setTimeout(
        () => {

            if (
                scramble !==
                rngScrambleElement
            ) {
                return;
            }

            scramble.remove();
            rngScrambleElement = null;

            rngResultPanel =
                document.createElement('div');

            rngResultPanel.className =
                'rngResultPanel';

            const card =
                createRngRecordCard(
                    payload
                );

            rngResultPanel.appendChild(
                card
            );

            generateScreen.appendChild(
                rngResultPanel
            );

            if (
                currentTab === 'generate'
            ) {

                scrollRngResultIntoView(
                    card
                );
            }

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

            requestRngLaunchFlash();

            maybePlayRngLaunchFlash();

        },
        RNG_APPEAR_DURATION
    );
}


function initializeRngGenerateButton() {

    const nextRollTimestamp =
        getRngNextRollTimestamp();

    const serverNow =
        getRngServerNow();

    if (
        nextRollTimestamp &&
        typeof serverNow === 'number'
    ) {

        if (
            serverNow >=
            nextRollTimestamp
        ) {

            handleRngCooldownExpired();

            return;
        }

        updateRngDailyCountdown();

        return;
    }

    if (
        rngDailyActionArea ||
        rngRequestPending ||
        rngRollLoadingPending
    ) {
        return;
    }

    if (
        rngDailyStatus
    ) {
        hideRngDailyStatus();
    }

    rngDailyActionArea =
        document.createElement('div');

    rngDailyActionArea.className =
        'rngActionArea';

    const button =
        document.createElement('button');

    button.type =
        'button';

    button.id =
        'generateRecordButton';

    button.className =
        'rngGenerateButton';

    button.textContent =
        'Generate Record';

    rngDailyActionArea.appendChild(
        button
    );

    rngControlSlot.appendChild(
        rngDailyActionArea
    );

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

            if (
                rngRequestPending ||
                rngRollLoadingPending
            ) {
                return;
            }

            rngDailyActionArea.remove();

            rngDailyActionArea =
                null;

            rngRollLoadingPending =
                true;

            errorMessage.classList.add(
                'hidden'
            );

            startRngRollLoading(
                () => {

                    rngRollLoadingPending =
                        false;

                    beginRngRollRequest();

                }
            );
        }
    );
}


function beginRngRollRequest() {

    const nextRollTimestamp =
        getRngNextRollTimestamp();

    const serverNow =
        getRngServerNow();

    if (
        typeof serverNow !== 'number'
    ) {

        errorMessage.textContent =
            "⚠️ Cannot verify server time.";

        errorMessage.classList.remove(
            "hidden"
        );

        initializeRngGenerateButton();

        return;
    }

    if (
        nextRollTimestamp &&
        serverNow <
        nextRollTimestamp
    ) {

        updateRngDailyCountdown();

        return;
    }

    if (
        nextRollTimestamp &&
        serverNow >=
        nextRollTimestamp
    ) {

        handleRngCooldownExpired();
    }

    if (
        rngRequestPending
    ) {
        return;
    }

    if (
        !socket ||
        socket.readyState !==
            WebSocket.OPEN
    ) {

        errorMessage.textContent =
            "⚠️ Action Cancelled: Socket is not open.";

        errorMessage.classList.remove(
            "hidden"
        );

        initializeRngGenerateButton();

        return;
    }

    rngRequestPending =
        true;

    socket.send(
        JSON.stringify({
            protocol: "cardgame",
            version: 1,
            request: "rng_go"
        })
    );
}


function initializeRngFrontend() {

    loadLocalRngRollState();

    createRngTopControlArea();
    createRngDailyStatus();

    hideRngDailyStatus();

    clearRngRarityTheme();

    const storedResult =
        loadLocalRngResult();

    const nextRollTimestamp =
        getRngNextRollTimestamp();

    const serverNow =
        getRngServerNow();

    const cooldownActive =
        Boolean(
            nextRollTimestamp &&
            typeof serverNow === 'number' &&
            serverNow <
                nextRollTimestamp
        );

    if (
        cooldownActive &&
        storedResult
    ) {

        renderStoredRngResult(
            storedResult
        );

    } else {

        if (
            !cooldownActive
        ) {
            clearLocalRngResult();
        }

        updateRngDailyCountdown();

        if (
            !rngRequestPending &&
            !rngRollLoadingPending &&
            !rngResultPanel &&
            !rngScrambleElement
        ) {
            initializeRngGenerateButton();
        }
    }

    updateRngDailyCountdown();
    updateScrollRail();

    requestRngLaunchFlash();
}


function initializeRngMusic() {

    const music =
        document.getElementById(
            'activityMusic'
        );

    const toggleButton =
        document.getElementById(
            'musicToggleButton'
        );

    if (
        !music
    ) {
        return;
    }

    music.loop =
        true;

    music.volume =
        0.5;

    let muted =
        music.muted;

    function updateMusicButton() {

        if (
            !toggleButton
        ) {
            return;
        }

        toggleButton.setAttribute(
            'aria-label',
            muted
                ? 'Unmute music'
                : 'Mute music'
        );

        toggleButton.setAttribute(
            'aria-pressed',
            muted
                ? 'true'
                : 'false'
        );

        toggleButton.textContent =
            muted
                ? '🔇'
                : '🔊';
    }


    function attemptMusicPlayback() {

        music.loop =
            true;

        music.volume =
            0.5;

        if (
            muted
        ) {
            music.muted =
                true;

            return;
        }

        music.muted =
            false;

        const promise =
            music.play();

        if (
            promise &&
            typeof promise.catch ===
                'function'
        ) {

            promise.catch(
                () => {
                    return;
                }
            );
        }
    }


    if (
        toggleButton
    ) {

        toggleButton.addEventListener(
            'click',
            event => {

                event.preventDefault();

                muted =
                    !muted;

                music.muted =
                    muted;

                if (
                    !muted
                ) {
                    attemptMusicPlayback();
                } else {
                    music.pause();
                }

                updateMusicButton();
            }
        );
    }


    document.addEventListener(
        'pointerdown',
        () => {

            if (
                !muted
            ) {
                attemptMusicPlayback();
            }

        },
        {
            passive: true
        }
    );


    document.addEventListener(
        'keydown',
        () => {

            if (
                !muted
            ) {
                attemptMusicPlayback();
            }

        },
        {
            passive: true
        }
    );


    music.addEventListener(
        'ended',
        () => {

            if (
                music.loop &&
                !muted
            ) {
                attemptMusicPlayback();
            }
        }
    );


    updateMusicButton();
    attemptMusicPlayback();
}


initializeRngMusic();


/*
============================================================
===== TEMP RNG COOLDOWN BYPASS - START REMOVE HERE =====
============================================================

REMOVE EVERYTHING FROM THE START MARKER ABOVE
THROUGH THE END MARKER BELOW.

PRESS CTRL + SHIFT + R TO ROLL DURING COOLDOWN.
*/

const rngTestOriginalSyncRngServerClock =
    syncRngServerClock;

const rngTestOriginalMarkRngRollComplete =
    markRngRollComplete;

let rngTestHasRolled =
    false;

let rngTestNextResetTimestamp =
    null;

try {

    localStorage.removeItem(
        RNG_LOCAL_ROLL_STORAGE_KEY
    );

    localStorage.removeItem(
        RNG_LOCAL_RESULT_STORAGE_KEY
    );

} catch (err) {

    console.log(
        "Temporary RNG test storage reset failed."
    );
}


syncRngServerClock =
    function (
        serverTime,
        nextReset
    ) {

        rngTestOriginalSyncRngServerClock(
            serverTime,
            nextReset
        );

        if (
            !rngTestHasRolled
        ) {

            rngTestNextResetTimestamp =
                null;

            rngNextResetTimestamp =
                null;

            clearLocalRngRollState();
            clearLocalRngResult();

            if (rngResultPanel) {
                rngResultPanel.remove();
                rngResultPanel = null;
            }

            hideRngDailyStatus();

            clearRngRarityTheme();

            if (
                currentTab === 'generate' &&
                !rngRequestPending &&
                !rngRollLoadingPending
            ) {
                initializeRngGenerateButton();
            }

            updateScrollRail();

            return;
        }

        if (
            typeof rngTestNextResetTimestamp === 'number' &&
            Number.isFinite(
                rngTestNextResetTimestamp
            )
        ) {

            rngNextResetTimestamp =
                rngTestNextResetTimestamp;

            saveLocalRngRollState(
                rngTestNextResetTimestamp
            );

            updateRngDailyCountdown();
        }
    };


markRngRollComplete =
    function (
        payload
    ) {

        rngTestOriginalMarkRngRollComplete(
            payload
        );

        const serverNow =
            getRngServerNow();

        if (
            typeof serverNow === 'number' &&
            Number.isFinite(serverNow)
        ) {

            rngTestHasRolled =
                true;

            rngTestNextResetTimestamp =
                serverNow +
                60000;

            rngNextResetTimestamp =
                rngTestNextResetTimestamp;

            saveLocalRngRollState(
                rngTestNextResetTimestamp
            );

            updateRngDailyCountdown();
        }
    };


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