# Monitor de Posiciones

Este proyecto es una herramienta similar a Beeceptor pero diseñada para ejecutarse localmente o en hosting gratuito. Implementa un servidor HTTP con Express en el que se captura y almacena (hasta las últimas 10) todas las solicitudes recibidas, mostrando su historial en una interfaz web. Además, incorpora soporte para WebSocket (usando [ws](server.js)) para actualizar en tiempo real la lista de solicitudes. También permite configurar respuestas personalizadas (tanto en formato JSON como texto plano) para simular distintos escenarios durante las pruebas.

Las entradas se sanitizan utilizando DOMPurify y se visualizan con un diseño basado en Tailwind CSS. Puedes iniciar el servidor ejecutando el script `start` en el [package.json](package.json) o, para desarrollo, usar `nodemon` mediante el script `dev`.
