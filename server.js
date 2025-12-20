const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });

console.log("🚀 Signaling server running on port", PORT);

wss.on("connection", (ws) => {
    console.log("🟢 Client connected");

    ws.on("message", (message) => {
        console.log("📨 Received:", message.toString());

        // Forward to all other clients
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        });
    });

    ws.on("close", () => {
        console.log("🔴 Client disconnected");
    });
});
