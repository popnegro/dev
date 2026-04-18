/**
 * TAXICHAT CORE - Motor de Identidad Dinámica
 */
const TaxiChat = {
    config: null,
    map: null,

    async init() {
        const hostname = window.location.hostname;
        // Detectar subdominio o forzar 'taxichat' en localhost puro
        let brandID = hostname.split('.')[0];
        if (brandID === 'localhost' || brandID === '127.0.0.1') {
            brandID = 'taxichat';
        }
        
        console.log(`🔍 Intentando cargar marca: ${brandID} desde ${hostname}`);

        try {
            const response = await fetch(`/api/bootstrap?brand=${brandID}`);
            if (!response.ok) throw new Error("Empresa no registrada");
            this.config = await response.json();

            this.applyTheme();
            this.applyUI();
            this.loadGoogleMaps();
            
            console.log(`🚀 Empresa cargada: ${this.config.name} (${brandID}).`);
            // Notificar a otros scripts que la configuración está lista
            document.dispatchEvent(new CustomEvent('taxichat-ready', { detail: this.config }));

            return this.config;
        } catch (error) {
            console.error("❌ Error Core:", error);
            this.applyDefaultTheme();
            // Notificar que hubo un fallo en la carga inicial
            document.dispatchEvent(new CustomEvent('taxichat-error', { detail: error.message }));
        }
    },

    getPersistentUserId() {
        let userId = localStorage.getItem('taxichat_user_id');
        if (!userId) {
            // Generamos un ID único combinando timestamp y strings aleatorios
            userId = 'u' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
            localStorage.setItem('taxichat_user_id', userId);
        }
        return userId;
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
        // Si existe la función global initMaps (usada en widget.html), la llamamos
        if (typeof window.initMaps === 'function') {
            window.initMaps();
        }

        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        this.map = new google.maps.Map(mapContainer, {
            center: { lat: -32.8895, lng: -68.8458 }, // Mendoza por defecto
            zoom: 14
        });
    },

    /**
     * Convierte coordenadas en una dirección legible (Reverse Geocoding)
     */
    async reverseGeocode(lat, lng) {
        if (!window.google || !window.google.maps) return null;
        const geocoder = new google.maps.Geocoder();
        
        return new Promise((resolve) => {
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === "OK" && results[0]) {
                    resolve({
                        formatted_address: results[0].formatted_address,
                        place_id: results[0].place_id
                    });
                } else {
                    console.warn("Geocodificación fallida:", status);
                    resolve(null);
                }
            });
        });
    },

    /**
     * Configura el autocompletado de Google Places para capturar la dirección formateada.
     * @param {string} inputId - El ID del elemento <input> donde el usuario escribe.
     * @param {Function} callback - Función que recibe el objeto con la dirección y coordenadas.
     */
    setupAddressAutocomplete(inputId, callback) {
        const input = document.getElementById(inputId);
        if (!input || !window.google || !window.google.maps.places) return;

        const autocomplete = new google.maps.places.Autocomplete(input, {
            fields: ["formatted_address", "geometry"],
            types: ["geocode", "establishment"] // Permite direcciones y nombres de lugares conocidos
        });

        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.formatted_address) return;

            if (callback) {
                callback({
                    formatted_address: place.formatted_address,
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                });
            }
        });
    },

    applyDefaultTheme() {
        const root = document.documentElement;
        root.style.setProperty('--color-primary', '#fbbf24');
        root.style.setProperty('--color-secondary', '#0f172a');
        root.style.setProperty('--brand-radius', '0.75rem');
    }
};

document.addEventListener('DOMContentLoaded', () => TaxiChat.init());