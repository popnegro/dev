/**
 * TAXIGO CORE - Motor de Identidad Dinámica
 */
const TaxiGo = {
    config: null,

    async init() {
        const hostname = window.location.hostname;
        // Detectar ID de marca desde el subdominio
        const brandID = (hostname.includes('localhost') || hostname.includes('vercel.app'))
            ? hostname.split('.')[0]
            : hostname.split('.')[0];

        try {
            const response = await fetch(`/api/bootstrap?brand=${brandID}`);
            if (!response.ok) throw new Error("Empresa no registrada");
            this.config = await response.json();

            this.applyTheme();
            this.applyUI();
            
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

    applyDefaultTheme() {
        const root = document.documentElement;
        root.style.setProperty('--color-primary', '#fbbf24');
        root.style.setProperty('--color-secondary', '#0f172a');
        root.style.setProperty('--brand-radius', '0.75rem');
    }
};

document.addEventListener('DOMContentLoaded', () => TaxiGo.init());