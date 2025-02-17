const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const { version } = require("./package.json");

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

// Página HTML embebida que muestra las últimas peticiones
app.get("/", (req, res) => {
    let historyHTML = "";
    const reversed = [...lastRequests].reverse();
    if (reversed.length > 0) {
        reversed.forEach(data => {
            let methodColor = "";
            switch(data.method) {
                case "GET":
                    methodColor = 'bg-green-500 text-white px-2 py-1 rounded';
                    break;
                case "POST":
                    methodColor = 'bg-blue-500 text-white px-2 py-1 rounded';
                    break;
                case "PUT":
                    methodColor = 'bg-yellow-500 text-white px-2 py-1 rounded';
                    break;
                case "DELETE":
                    methodColor = 'bg-red-500 text-white px-2 py-1 rounded';
                    break;
                default:
                    methodColor = 'bg-gray-500 text-white px-2 py-1 rounded';
                    break;
            }
            historyHTML += `
            <div class="p-3 bg-blue-100 border-l-4 border-blue-500 rounded shadow mb-2">
                <div>
                    <span class="${methodColor}">${data.method}</span>
                    <span class="ml-2 font-semibold">Recurso:</span> ${data.url}
                </div>
                <details class="mt-2">
                    <summary class="cursor-pointer text-sm text-gray-600">Mostrar cuerpo de la petición</summary>
                    <pre class="text-sm mt-2">${JSON.stringify(data.body, null, 2)}</pre>
                </details>
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
            <footer class="mt-4 text-center text-gray-500 text-sm">
                Versión: ${version}
            </footer>
        </div>

        <script>
            const dataContainer = document.getElementById("dataContainer");

            // Detecta si la página usa HTTPS o HTTP
            const wsProtocol = window.location.protocol === "https:" ? "wss://" : "ws://";
            const ws = new WebSocket(wsProtocol + window.location.host);

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                let methodColor = "";
                switch(data.method) {
                    case "GET":
                        methodColor = 'bg-green-500 text-white px-2 py-1 rounded';
                        break;
                    case "POST":
                        methodColor = 'bg-blue-500 text-white px-2 py-1 rounded';
                        break;
                    case "PUT":
                        methodColor = 'bg-yellow-500 text-white px-2 py-1 rounded';
                        break;
                    case "DELETE":
                        methodColor = 'bg-red-500 text-white px-2 py-1 rounded';
                        break;
                    default:
                        methodColor = 'bg-gray-500 text-white px-2 py-1 rounded';
                        break;
                }
                const newEntry = document.createElement("div");
                newEntry.classList = "p-3 bg-blue-100 border-l-4 border-blue-500 rounded shadow mb-2";
                newEntry.innerHTML = 
                    "<div>" +
                        "<span class='" + methodColor + "'>" + data.method + "</span>" +
                        "<span class='ml-2 font-semibold'>Recurso:</span> " + data.url +
                    "</div>" +
                    "<details class='mt-2'>" +
                        "<summary class='cursor-pointer text-sm text-gray-600'>Mostrar cuerpo de la petición</summary>" +
                        "<pre class='text-sm mt-2'>" + JSON.stringify(data.body, null, 2) + "</pre>" +
                    "</details>";
                dataContainer.prepend(newEntry);
            };
        </script>
    </body>
    </html>
    `);
});

// Middleware de captura para cualquier petición (GET, POST, PUT, DELETE, etc.) en cualquier recurso
app.all("*", (req, res) => {
    const data = {
        method: req.method,
        url: req.originalUrl,
        body: req.body
    };
    console.log("Datos recibidos:", data);

    // Almacenar solicitud y mantener solo las últimas 10
    lastRequests.push(data);
    if (lastRequests.length > 10) {
        lastRequests.shift();
    }

    // Enviar datos a todos los clientes WebSocket
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });

    res.json({ message: "Datos recibidos", data });
});