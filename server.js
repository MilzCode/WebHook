const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Almacén de las últimas 10 peticiones
let lastRequests = [];

// Servidor WebSocket
const wss = new WebSocket.Server({ noServer: true });

// Servidor HTTP + WebSocket juntos
const server = app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
    });
});

// Manejo de conexiones WebSocket
wss.on("connection", (ws) => {
    console.log("Cliente WebSocket conectado");
});

// Ruta para recibir datos mediante POST (acepta cualquier objeto)
app.post("/webhook", (req, res) => {
    console.log("Datos recibidos:", req.body);

    // Almacenar solicitud y mantener solo las últimas 10
    lastRequests.push(req.body);
    if (lastRequests.length > 10) {
        lastRequests.shift();
    }

    // Enviar datos a todos los clientes WebSocket
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(req.body)); // Enviar cualquier objeto recibido
        }
    });

    res.json({ message: "Datos recibidos", data: req.body });
});

// Página HTML + Tailwind embebida
app.get("/", (req, res) => {
    // Generar el HTML con las últimas 10 peticiones (último primero)
    let historyHTML = "";
    if (lastRequests.length > 0) {
        [...lastRequests].reverse().forEach(data => {
            historyHTML += `
            <div class="p-3 bg-blue-100 border-l-4 border-blue-500 rounded">
                <pre class="text-sm">${JSON.stringify(data, null, 2)}</pre>
            </div>
            `;
        });
    } else {
        historyHTML = `<p class="text-gray-500">Esperando datos...</p>`;
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monitor de Datos</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 p-6">
        <div class="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-xl font-bold text-center mb-4">📊 Últimos Datos Recibidos</h2>
            <div id="dataContainer" class="space-y-2">
                ${historyHTML}
            </div>
        </div>

        <script>
    const dataContainer = document.getElementById("dataContainer");

    // Detecta si la página usa HTTPS o HTTP
    const wsProtocol = window.location.protocol === "https:" ? "wss://" : "ws://";
    const ws = new WebSocket(wsProtocol + window.location.host);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const newEntry = document.createElement("div");
        newEntry.classList = "p-3 bg-blue-100 border-l-4 border-blue-500 rounded";
        newEntry.innerHTML = "<pre class='text-sm'>" + JSON.stringify(data, null, 2) + "</pre>";
        dataContainer.prepend(newEntry);
    };
</script>
    </body>
    </html>
    `);
});