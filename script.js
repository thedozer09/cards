import { DiscordSDK } from "https://unpkg.com";

const screen1 = document.getElementById('screen1');
const screen2 = document.getElementById('screen2');
const testButton = document.getElementById('testButton');
const rngButton = document.getElementById('rngButton');
const errorMessage = document.getElementById('errorMessage');

const clientId = '1371190489629593750';
let socket = null;

const discordSdk = new DiscordSDK(clientId);

async function setupActivity() {
    try {
        await discordSdk.ready();
        console.log("Discord SDK Ready");

        discordSdk.patchUrlMappings([
            {
                prefix: '/ws',
                target: 'fi12.bot-hosting.cloud:25151'
            }
        ], { patchWebSocket: true });

        console.log("URL Mappings Patched");
        initializeWebSocket();
    } catch (err) {
        console.error("Initialization failure:", err);
        errorMessage.textContent = "⚠️ Failed to initialize Discord link.";
        errorMessage.classList.remove("hidden");
    }
}

function initializeWebSocket() {
    socket = new WebSocket(`wss://fi12.bot-hosting.cloud:25151/ws`);

    socket.addEventListener('open', () => {
        console.log("Connected to card game backend");
        errorMessage.classList.add("hidden");
    });

    socket.addEventListener('message', event => {
        try {
            const data = JSON.parse(event.data);
            console.log("Backend message:", data);

            if (data.type === "connected") {
                console.log("Card game connection established");
                return;
            }

            if (data.type === "rng_result") {
                document.body.style.background = data.data.color.code;
                return;
            }

            if (data.type === "error") {
                errorMessage.textContent = data.data.message;
                errorMessage.classList.remove("hidden");
                return;
            }

            errorMessage.textContent = "⚠️ Game communication error.";
            errorMessage.classList.remove("hidden");
            console.log("❌ Unknown backend message type:", data.type);

        } catch (err) {
            errorMessage.textContent = "⚠️ Invalid game response.";
            errorMessage.classList.remove("hidden");
            console.log("❌ Invalid backend message");
        }
    });

    socket.addEventListener('close', () => {
        console.log("WebSocket connection closed. Retrying...");
        setTimeout(initializeWebSocket, 3000);
    });

    socket.addEventListener('error', (err) => {
        console.error("WebSocket connection failure:", err);
    });
}

testButton.addEventListener('click', () => {
    screen1.classList.add('hidden');
    screen2.classList.remove('hidden');
});

rngButton.addEventListener('click', () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        errorMessage.textContent = "⚠️ Game server is not connected.";
        errorMessage.classList.remove("hidden");
        return;
    }

    socket.send(JSON.stringify({
        protocol: "cardgame",
        version: 1,
        request: "rng_test"
    }));
});

setupActivity();
