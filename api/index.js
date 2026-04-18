require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const Pusher = require("pusher");

const app = express();

// 1. Configuración de Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Requerido para procesar la autenticación de Pusher
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
        'taxigo': {
            name: 'TaxiGo Central',
            theme: { primary: '#000000', secondary: '#009ee3', radius: '1rem' },
            maps_key: process.env.GOOGLE_MAPS_API_KEY
        },
        'mendoza': {
            name: 'Taxi Mendoza',
            theme: { primary: '#fbbf24', secondary: '#0f172a', radius: '1.5rem' },
            maps_key: process.env.GOOGLE_MAPS_API_KEY
        },
        'taxichat-nine': {
            name: 'TaxiGo Demo',
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
                    success: `${baseUrl}/success.html`,
                    failure: `${baseUrl}/failure.html`,
                },
                auto_return: "approved",
            }
        });

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
    await pusher.trigger("private-admin", "nuevo-pedido", pedido);
    res.json({ status: "Pedido recibido", pedido });
});

app.post('/api/asignar-taxi', async (req, res) => {
    const { userId, ...data } = req.body;
    // Emitimos a un canal privado único para ese usuario
    const channelName = `private-user-${userId}`;
    await pusher.trigger(channelName, "confirmacion-cliente", data);
    res.json({ status: "Evento enviado a canal privado", channel: channelName });
});

app.post('/api/enviar-link-pago', async (req, res) => {
    const { userId, ...data } = req.body;
    const channelName = `private-user-${userId}`;
    await pusher.trigger(channelName, "recibir-pago", data);
    res.json({ status: "Link de pago enviado a canal privado", channel: channelName });
});

// 7. Endpoint para verificar el estado del servidor
app.get('/status', (req, res) => {
    res.json({ status: "ok", message: "TaxiGo API is running!" });
});

// 7. Encender servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});

module.exports = app;