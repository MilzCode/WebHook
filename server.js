const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const { version } = require("./package.json");
const bodyParser = require("body-parser");

// Importar y crear instancia de DOMPurify para Node
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(bodyParser.text({ type: 'text/plain' }));

// Almacén de las últimas 10 peticiones
let lastRequests = [];

// Variables para respuesta personalizada
let customResponse = null;
let customResponseType = 'json';

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
            const window = new JSDOM('').window;
            const purify = DOMPurify(window);
            // Sanitizar todos los campos dinámicos
            const sanitizedMethod = purify.sanitize(data.method);
            const sanitizedUrl = purify.sanitize(data.url);
            const sanitizedTimestamp = purify.sanitize(data.timestamp);
            const sanitizedBody = (typeof data.body === "string")
                ? DOMPurify.sanitize(data.body)
                : DOMPurify.sanitize(JSON.stringify(data.body, null, 2));
            let methodColor = "";
            switch(sanitizedMethod) {
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
                    <span class="${methodColor}">${sanitizedMethod}</span>
                    <span class="ml-2 font-semibold">Recurso:</span> ${sanitizedUrl}
                    <span class="ml-2 text-gray-600 text-sm">Hora:</span> ${sanitizedTimestamp}
                </div>
                <details class="mt-2">
                    <summary class="cursor-pointer text-sm text-gray-600">Mostrar cuerpo de la petición</summary>
                    <pre class="text-sm mt-2">${sanitizedBody}</pre>
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
        <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.4.1/purify.min.js"></script>
    </head>
    <body class="bg-gray-100 p-6">
        <div class="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-xl font-bold text-center mb-4">📊 Últimos Datos Recibidos</h2>
            <div id="dataContainer" class="space-y-2">
                ${historyHTML}
            </div>
            <!-- Botones de acción: Clear y Set Response -->
            <div class="flex gap-4 mt-4">
                <button id="clearButton" class="bg-red-500 text-white px-4 py-2 rounded">Clear</button>
                <button id="setResponseButton" class="bg-blue-500 text-white px-4 py-2 rounded">Set Response</button>
            </div>
            <footer class="mt-4 text-center text-gray-500 text-sm">
                Versión: ${version}
            </footer>
        </div>

        <!-- Modal para configurar respuesta personalizada -->
        <div id="modal" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 hidden">
            <div class="bg-white p-6 rounded-lg w-96">
                <h3 class="text-xl font-bold mb-4">Configurar Respuesta</h3>
                <div class="mb-4">
                    <label for="responseType" class="block mb-1">Tipo de respuesta:</label>
                    <select id="responseType" class="w-full border px-2 py-1">
                        <option value="json">JSON</option>
                        <option value="text">Texto Plano</option>
                    </select>
                </div>
                <div class="mb-4">
                    <label for="responseBody" class="block mb-1">Cuerpo de la respuesta:</label>
                    <textarea id="responseBody" class="w-full border px-2 py-1" rows="5" placeholder='{"key": "value"} o texto'></textarea>
                </div>
                <div class="flex justify-end gap-2">
                    <button id="cancelModal" class="bg-gray-500 text-white px-4 py-2 rounded">Cancelar</button>
                    <button id="resetModal" class="bg-yellow-500 text-white px-4 py-2 rounded">Resetear</button>
                    <button id="saveModal" class="bg-green-500 text-white px-4 py-2 rounded">Guardar</button>
                </div>
            </div>
        </div>

        <script>
            const dataContainer = document.getElementById("dataContainer");
            const clearButton = document.getElementById("clearButton");
            const setResponseButton = document.getElementById("setResponseButton");
            const modal = document.getElementById("modal");
            const cancelModal = document.getElementById("cancelModal");
            const saveModal = document.getElementById("saveModal");
            const responseType = document.getElementById("responseType");
            const responseBody = document.getElementById("responseBody");
            const resetModal = document.getElementById("resetModal");

            // WebSocket
            const wsProtocol = window.location.protocol === "https:" ? "wss://" : "ws://";
            const ws = new WebSocket(wsProtocol + window.location.host);

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                const sanitizedMethod = DOMPurify.sanitize(data.method);
                const sanitizedUrl = DOMPurify.sanitize(data.url);
                const sanitizedTimestamp = DOMPurify.sanitize(data.timestamp);
                const sanitizedBody = (typeof data.body === "string")
                    ? DOMPurify.sanitize(data.body)
                    : DOMPurify.sanitize(JSON.stringify(data.body, null, 2));

                let methodColor = "";
                switch(sanitizedMethod) {
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
                        "<span class='" + methodColor + "'>" + sanitizedMethod + "</span>" +
                        "<span class='ml-2 font-semibold'>Recurso:</span> " + sanitizedUrl +
                        "<span class='ml-2 text-gray-600 text-sm'>Hora:</span> " + sanitizedTimestamp +
                    "</div>" +
                    "<details class='mt-2'>" +
                        "<summary class='cursor-pointer text-sm text-gray-600'>Mostrar cuerpo de la petición</summary>" +
                        "<pre class='text-sm mt-2'>" + sanitizedBody + "</pre>" +
                    "</details>";
                dataContainer.prepend(newEntry);
            };

            clearButton.addEventListener("click", () => {
                fetch("/__clear_data_logs_ws", { method: "DELETE" })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            dataContainer.innerHTML = "";
                        }
                    });
            });

            // Mostrar modal al hacer click en "Set Response"
            setResponseButton.addEventListener("click", () => {
                modal.classList.remove("hidden");
            });

            cancelModal.addEventListener("click", () => {
                modal.classList.add("hidden");
            });

            saveModal.addEventListener("click", () => {
                const payload = {
                    responseType: responseType.value,
                    responseBody: responseBody.value
                };
                fetch("/__set_custom_response", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                })
                .then(resp => resp.json())
                .then(data => {
                    if(data.success){
                        modal.classList.add("hidden");
                        alert("Respuesta personalizada establecida.");
                    }
                });
            });

            resetModal.addEventListener("click", () => {
                fetch("/__default_custom_response", { method: "DELETE" })
                    .then(response => response.json())
                    .then(data => {
                        if(data.success){
                            responseType.value = "json";
                            responseBody.value = "";
                            modal.classList.add("hidden");
                            alert("Respuesta personalizada reseteada a estado default.");
                        }
                    });
            });
        </script>
    </body>
    </html>
    `);
});

app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
});

// Endpoint para limpiar la lista de peticiones
app.delete("/__clear_data_logs_ws", (req, res) => {
    lastRequests = [];
    res.json({ success: true });
});

app.delete("/__default_custom_response", (req, res) => {
    customResponse = null;
    customResponseType = 'json';
    res.json({ success: true });
});

// Endpoint para establecer la respuesta personalizada
app.post("/__set_custom_response", (req, res) => {
    const { responseType, responseBody } = req.body;
    const sanitizedResponseBody = DOMPurify.sanitize(responseBody);
    
    // Se asume que si se selecciona JSON, el body debe ser válido
    if (responseType === "json") {
        try {
            JSON.parse(sanitizedResponseBody);
        } catch(e) {
            return res.status(400).json({ success: false, error: "JSON inválido" });
        }
    }
    
    customResponseType = responseType;
    customResponse = sanitizedResponseBody;
    res.json({ success: true });
});

// Middleware de captura para cualquier petición (GET, POST, PUT, DELETE, etc.) en cualquier recurso
app.all("*", (req, res) => {
    let body;
    if (req.is("text/plain")) {
        body = req.body;
    } else {
        try {
            body = JSON.parse(req.body);
        } catch (e) {
            body = req.body;
        }
    }

    const data = {
        method: req.method,
        url: req.originalUrl,
        body: body,
        timestamp: new Date().toLocaleString()
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

    // Enviar respuesta personalizada si existe o la respuesta por defecto
    if (customResponse !== null) {
        if (customResponseType === "text") {
            res.set("Content-Type", "text/plain");
            return res.send(customResponse);
        } else {
            try {
                const parsed = JSON.parse(customResponse);
                return res.json(parsed);
            } catch (e) {
                return res.json({ response: customResponse });
            }
        }
    } else {
        return res.json({ message: "Datos recibidos", data });
    }
});