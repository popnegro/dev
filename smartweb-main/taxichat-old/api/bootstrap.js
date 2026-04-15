export default function handler(req, res) {
    const { brand } = req.query;
    const tenants = {
        "mendoza": {
            id: "mendoza",
            name: "Taxi Mendoza",
            theme: { primary: "#fbbf24", secondary: "#0f172a", radius: "1.5rem" },
            maps_key: process.env.MAPS_MENDOZA
        },
        "taxichat-nine": { // Tu subdominio actual de Vercel
            id: "taxichat-nine",
            name: "TaxiGo Demo",
            theme: { primary: "#10b981", secondary: "#064e3b", radius: "0.5rem" },
            maps_key: process.env.MAPS_DEMO
        }
    };

    const config = tenants[brand] || tenants["mendoza"];
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(config);
}