const path = require('path');
// Resolve the absolute path to the .env file in the parent directory
const envPath = path.resolve(__dirname, '../.env');
const envResult = require('dotenv').config({ path: envPath });

if (envResult.error) {
    console.warn(`⚠️ Warning: Could not find .env file at ${envPath}`);
}

// --- BLOQUE DE VALIDACIÓN DE ENTORNO ---
const requiredEnvVars = [
    'MP_ACCESS_TOKEN',
    'PUSHER_APP_ID',
    'PUSHER_KEY',
    'PUSHER_SECRET',
    'PUSHER_CLUSTER',
    'GOOGLE_MAPS_API_KEY'
];

const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
    console.error('❌ ERROR CRÍTICO: Faltan variables en el archivo .env:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.error('\nVerifica que el archivo .env esté en la raíz de /api/ y tenga los valores correctos.');
    process.exit(1); 
}

console.log(`✅ Environment variables loaded successfully from: ${envPath}`);
// ---------------------------------------

const express = require('express');
const fs = require('fs');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const Pusher = require("pusher");

const app = express();

// Función auxiliar para registro de actividades (Logging)
const writeLog = (event, data) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        data
    };
    const logString = JSON.stringify(logEntry);
    console.log(`[ACTIVITY]: ${logString}`);
    
    // Intentar escribir en archivo local (Nota: En Vercel el FS es de solo lectura)
    try {
        fs.appendFileSync(path.join(__dirname, 'activity.log'), logString + '\n');
    } catch (err) { /* Ignorar errores en entornos serverless sin FS persistente */ }
};

// 1. Configuración de Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Requerido para procesar la autenticación de Pusher
app.use((req, res, next) => {
    writeLog('HTTP_REQUEST', { method: req.method, url: req.url, ip: req.ip });
    next();
});
app.use(cors());

// 1.1 Servir archivos estáticos (HTML, CSS, JS)
// Esto permite que http://localhost:3000/views/widget.html funcione
app.use('/views', express.static(path.join(__dirname, '../views')));
app.use('/core', express.static(path.join(__dirname, '../core')));

// 2. Configuración Mercado Pago (Usando variables de entorno)
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});

// 3. Configuración de Pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

// Nuevo Endpoint de Autenticación para Canales Privados
app.post('/pusher/auth', (req, res) => {
    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;
    writeLog('PUSHER_AUTH', { channel, socketId });

    // Aquí deberías verificar la identidad del usuario (usando JWT, sesiones, etc.)
    // Por ahora, autorizamos la conexión basándonos en el socket_id proporcionado.
    const authResponse = pusher.authenticate(socketId, channel);
    res.send(authResponse);
});

// 4. Endpoint para Configuración de Marca (Bootstrap)
app.get('/api/bootstrap', (req, res) => {
    const { brand } = req.query;
    
    // Mapeo dinámico usando variables de entorno
    const tenants = {
        'taxichat': {
            name: 'TaxiChat Central',
            theme: { primary: '#000000', secondary: '#009ee3', radius: '1rem' },
            maps_key: process.env.GOOGLE_MAPS_API_KEY
        },
        'mendoza': {
            name: 'Taxi Mendoza',
            theme: { primary: '#fbbf24', secondary: '#0f172a', radius: '1.5rem' },
            maps_key: process.env.GOOGLE_MAPS_API_KEY
        },
        'taxichat-nine': {
            name: 'TaxiChat Demo',
            theme: { primary: '#10b981', secondary: '#064e3b', radius: '0.5rem' },
            maps_key: process.env.GOOGLE_MAPS_API_KEY
        }
    };

    const config = tenants[brand] || tenants['mendoza'];
    res.json({
        ...config,
        pusher_key: process.env.PUSHER_KEY,
        pusher_cluster: process.env.PUSHER_CLUSTER
    });
});

// 5. Endpoint para Mercado Pago
app.post('/create-preference', async (req, res) => {
    try {
        const preference = new Preference(client);
        // Detectar dinámicamente el origen para que las Back URLs funcionen en localhost
        const baseUrl = req.headers.origin || process.env.FRONTEND_URL || "https://taxichat-nine.vercel.app";
        
        const result = await preference.create({
            body: {
                items: [{
                    title: req.body.title || "Servicio de Taxi",
                    unit_price: Number(req.body.price),
                    quantity: 1,
                    currency_id: 'ARS' 
                }],
                back_urls: {
                    success: `${baseUrl}/views/success.html`,
                    failure: `${baseUrl}/views/failure.html`,
                },
                auto_return: "approved",
            }
        });

        writeLog('MP_PREFERENCE_CREATED', { id: result.id, title: req.body.title, price: req.body.price });

        // En Sandbox, Mercado Pago devuelve sandbox_init_point. 
        // Es preferible usarlo para evitar redirecciones fallidas a la App móvil en pruebas.
        res.json({ 
            init_point: result.sandbox_init_point || result.init_point 
        });
    } catch (error) {
        console.error("Error MP:", error);
        res.status(500).json({ error: "Error al crear preferencia" });
    }
});

// 6. Endpoints de Eventos en Tiempo Real (Pusher)
app.post('/api/nuevo-pedido', async (req, res) => {
    const pedido = {
        ...req.body,
        id: Date.now().toString().slice(-4),
        timestamp: new Date().toLocaleTimeString()
    };
    writeLog('PEDIDO_NUEVO', pedido);
    await pusher.trigger("private-admin", "nuevo-pedido", pedido);
    res.json({ status: "Pedido recibido", pedido });
});

app.post('/api/cancelar-pedido', async (req, res) => {
    const { userId } = req.body;
    writeLog('PEDIDO_CANCELADO', { userId });
    await pusher.trigger("private-admin", "pedido-cancelado", { userId });
    res.json({ status: "Cancelación notificada", userId });
});

app.post('/api/asignar-taxi', async (req, res) => {
    const { userId, ...data } = req.body;
    // Emitimos a un canal privado único para ese usuario
    const channelName = `private-user-${userId}`;
    writeLog('TAXI_ASIGNADO', { userId, ...data });
    await pusher.trigger(channelName, "confirmacion-cliente", data);
    res.json({ status: "Evento enviado a canal privado", channel: channelName });
});

app.post('/api/enviar-link-pago', async (req, res) => {
    const { userId, ...data } = req.body;
    const channelName = `private-user-${userId}`;
    writeLog('LINK_PAGO_ENVIADO', { userId, ...data });
    await pusher.trigger(channelName, "recibir-pago", data);
    res.json({ status: "Link de pago enviado a canal privado", channel: channelName });
});

// 7. Servir la Landing Page principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/index.html'));
});

// 7. Endpoint para verificar el estado del servidor
app.get('/status', (req, res) => {
    res.json({ status: "ok", message: "TaxiChat API is running!" });
});

// 7. Encender servidor
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
    const server = app.listen(PORT, () => {
        console.log(`✅ Servidor local corriendo en el puerto ${PORT}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use. Try changing the PORT in your .env or killing the existing process.`);
            process.exit(1);
        } else {
            console.error('❌ Server error:', err);
        }
    });
}

module.exports = app;