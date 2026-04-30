/**
 * TAXICHAT UI LIBRARY - Tailwind Components
 * Inyecta componentes reutilizables de Tailwind CSS
 */
const TaxiUI = {
    inject() {
        const style = document.createElement('style');
        style.setAttribute('type', 'text/tailwindcss');
        style.innerHTML = `
            @layer components {
                .btn-base {
                    @apply px-6 py-3.5 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-center;
                }
                .btn-primary { @apply btn-base bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200; }
                .btn-secondary { @apply btn-base bg-blue-600 text-white hover:bg-blue-700; }
                
                .input-main {
                    @apply w-full p-3 bg-slate-100 dark:bg-zinc-800 border border-transparent rounded-lg focus:bg-white dark:focus:bg-zinc-900 focus:border-slate-900 dark:focus:border-slate-100 outline-none transition-all text-slate-900 dark:text-slate-100;
                }
                
                .card-main {
                    @apply bg-white dark:bg-zinc-900 p-8 border border-zinc-200 dark:border-zinc-800 transition-colors shadow-sm rounded-xl;
                }
            }
        `;
        document.head.appendChild(style);
        console.log("🎨 UI Library: Componentes Tailwind inyectados.");
    }
};

// Ejecución inmediata para que Tailwind CDN lo procese al cargar
TaxiUI.inject();