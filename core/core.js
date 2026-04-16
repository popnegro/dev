/**
 * TAXIGO CORE - Motor de Identidad Dinámica
 */
const TaxiGo = {
    config: null,
    map: null,

    async init() {
        const hostname = window.location.hostname;
        // Detectar ID de marca desde el subdominio
        const brandID = hostname.split('.')[0];

        try {
            const response = await fetch(`/api/bootstrap?brand=${brandID}`);
            if (!response.ok) throw new Error("Empresa no registrada");
            this.config = await response.json();

            this.applyTheme();
            this.applyUI();
            this.loadGoogleMaps();
            
            console.log(`🚀 Empresa cargada: ${this.config.name}`);
            return this.config;
        } catch (error) {
            console.error("❌ Error Core:", error);
            this.applyDefaultTheme();
        }
    },

    applyTheme() {
        const root = document.documentElement;
        const { theme } = this.config;
        root.style.setProperty('--color-primary', theme.primary);
        root.style.setProperty('--color-secondary', theme.secondary);
        root.style.setProperty('--brand-radius', theme.radius || '1rem');
    },

    applyUI() {
        document.title = `${this.config.name} | Despacho`;
        document.querySelectorAll('.brand-name').forEach(el => el.innerText = this.config.name);
    },

    loadGoogleMaps() {
        if (!this.config || !this.config.maps_key) return;

        // Si el script ya existe, simplemente inicializamos el mapa
        if (window.google && window.google.maps) {
            this.initMap();
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.config.maps_key}&libraries=places`;
        script.async = true;
        script.defer = true;
        // El evento onload es la clave para la inicialización segura
        script.onload = () => this.initMap();
        document.head.appendChild(script);
    },

    initMap() {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        this.map = new google.maps.Map(mapContainer, {
            center: { lat: -32.8895, lng: -68.8458 }, // Mendoza por defecto
            zoom: 14
        });
    },

    applyDefaultTheme() {
        const root = document.documentElement;
        root.style.setProperty('--color-primary', '#fbbf24');
        root.style.setProperty('--color-secondary', '#0f172a');
        root.style.setProperty('--brand-radius', '0.75rem');
    }
};

document.addEventListener('DOMContentLoaded', () => TaxiGo.init());