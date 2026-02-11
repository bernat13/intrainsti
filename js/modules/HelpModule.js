export class HelpModule {
    constructor(container, supabaseService, user, userRoles, moduleConfig) {
        this.container = container;
        this.supabaseService = supabaseService;
        this.user = user;
        this.userRoles = userRoles || [];
        this.moduleConfig = moduleConfig || {};

        this.helpContent = [
            {
                id: 'dashboard',
                title: 'Panel Principal (Dashboard)',
                icon: 'fas fa-home',
                desc: 'Tu centro de control personal. Desde aquí tienes una visión global de tu actividad en el centro.',
                steps: [
                    '<b>Accesos Directos:</b> Botones rápidos para ir a las secciones más usadas (Guardias, Mis Tickets, Reservas).',
                    '<b>Resumen de Estado:</b> Visualiza cuántos tickets tienes pendientes o en proceso.',
                    '<b>Tablón de Anuncios:</b> Revisa las últimas noticias publicadas por dirección o administración en la parte inferior.',
                    '<b>Menú Lateral:</b> Utiliza el menú desplegable (móvil) o la barra lateral para navegar a cualquier módulo.'
                ],
                access: 'active'
            },
            {
                id: 'calendario',
                title: 'Calendario y Guardias',
                icon: 'fas fa-calendar-alt',
                desc: 'Agenda del centro, control de festivos y gestión de documentos de guardia.',
                steps: [
                    '<b>Navegación:</b> Usa las flechas superiores para cambiar de mes.',
                    '<b>Festivos:</b> Los días no lectivos aparecen marcados en rojo/gris.',
                    '<b>Guardias (Icono G):</b> Si ves un icono "G" en un día: haz clic para ver/editar el "Parte de Guardia" en Google Drive.',
                    '<b>Ocupación de Espacios:</b> Los iconos de "SUM" y "Carros" te indican si hay reservas ese día (Naranja=Parcial, Rojo=Completo).',
                    '<b>Eventos (Dirección):</b> Haz clic en un día para añadir un evento o recordatorio (Solo usuarios autorizados).'
                ],
                access: 'calendario'
            },
            {
                id: 'reserva-sum',
                title: 'Reservas Salón de Actos / SUM',
                icon: 'fas fa-chalkboard-teacher',
                desc: 'Sistema de reserva de espacios comunes para actividades o reuniones.',
                steps: [
                    '<b>Seleccionar Día:</b> Haz clic en un día del calendario mensual.',
                    '<b>Ver Disponibilidad:</b> Se mostrará una tabla con las horas lectivas. Las ocupadas aparecen en rojo con el nombre del profesor.',
                    '<b>Reservar:</b> Pulsa el botón "Reservar" verde en una hora libre.',
                    '<b>Detalles:</b> Indica el curso/grupo y el motivo de la reserva (ej. Charla, Examen).',
                    '<b>Mis Reservas:</b> Consulta o cancela tus futuras reservas desde el panel lateral "Mis Reservas".'
                ],
                access: 'sum'
            },
            {
                id: 'reserva-carros',
                title: 'Reservas Carros de Portátiles',
                icon: 'fas fa-laptop-house',
                desc: 'Gestión de recursos móviles (portátiles) para las aulas.',
                steps: [
                    '<b>Seleccionar Día:</b> Elige la fecha en la que necesitas los equipos.',
                    '<b>Disponibilidad por Hora:</b> Verás cuántos carros quedan libres en cada franja (ej. "2/4 Libres").',
                    '<b>Elegir Carro:</b> Al pulsar reservar, selecciona qué carro específico prefieres (Carro 1, 2, etc.).',
                    '<b>Confirmación:</b> Reservar bloquea ese carro para ti en esa hora. Recuerda devolverlo a tiempo y enchufarlo.'
                ],
                access: 'carts'
            },
            {
                id: 'tickets-tic',
                title: 'Peticiones TIC (Incidencias)',
                icon: 'fas fa-laptop',
                desc: 'Canal oficial para reportar problemas informáticos (PC, Proyector, Internet).',
                steps: [
                    '<b>Nueva Petición:</b> Pulsa el botón flotante (+) o "Nueva Petición".',
                    '<b>Ubicación:</b> Indica claramente el Aula o Despacho.',
                    '<b>Descripción:</b> Explica el problema (ej. "No enciende", "No conecta a wifi").',
                    '<b>Prioridad:</b> Sé honesto con la urgencia (Baja, Media, Alta, Urgente).',
                    '<b>Seguimiento:</b> Recibirás notificaciones cuando el ticket cambie de estado (En Proceso, Resuelto).'
                ],
                access: 'tickets_tic'
            },
            {
                id: 'tickets-mantenimiento',
                title: 'Peticiones Mantenimiento',
                icon: 'fas fa-tools',
                desc: 'Avisos para conserjería y mantenimiento general.',
                steps: [
                    '<b>Uso:</b> Para todo lo NO informático (Luces, persianas, muebles, electricidad, fontanería).',
                    '<b>Proceso:</b> Idéntico a las peticiones TIC.',
                    '<b>Resolución:</b> El equipo de mantenimiento marcará la incidencia como resuelta cuando se repare.'
                ],
                access: 'tickets_maintenance'
            },
            {
                id: 'tickets-3d',
                title: 'Peticiones Impresión 3D',
                icon: 'fas fa-cube',
                desc: 'Solicitud de trabajos a la impresora 3D del centro.',
                steps: [
                    '<b>Solicitud:</b> Crea una nueva petición describiendo qué quieres imprimir.',
                    '<b>Archivo:</b> Si tienes el fichero .STL, indica dónde está o descríbelo.',
                    '<b>Detalles:</b> Especifica color, tamaño aproximado y material (PLA, etc.) si es relevante.',
                    '<b>Comunicación:</b> Usa los comentarios del ticket para hablar con el responsable de impresión.'
                ],
                access: 'tickets_3d'
            },
            {
                id: 'mis-tickets',
                title: 'Mis Peticiones (Historial)',
                icon: 'fas fa-list-alt',
                desc: 'Consulta histórica de todas tus incidencias y solicitudes.',
                steps: [
                    '<b>Filtros:</b> Filtra por estado (Abierto, Cerrado) o tipo.',
                    '<b>Detalle:</b> Haz clic en cualquier ticket para ver la conversación completa y la solución aplicada.',
                    '<b>Reabrir:</b> Si el problema persiste, puedes añadir un comentario nuevo.'
                ],
                access: 'tickets_tic' // Accessible if any ticket module is active generally
            },
            {
                id: 'mi-departamento',
                title: 'Mi Departamento',
                icon: 'fas fa-users',
                desc: 'Gestión de los miembros de tu departamento didáctico.',
                steps: [
                    '<b>Ver Miembros:</b> Lista de todos los compañeros asignados a tu departamento.',
                    '<b>Añadir Miembro:</b> Pulsa "Añadir Miembro" e introduce su email (debe estar registrado en la app).',
                    '<b>Roles:</b> Visualiza quién es el Jefe de Departamento.',
                    '<b>Eliminar:</b> Si un compañero cambia de departamento, puedes eliminarlo de la lista (icono papelera).'
                ],
                access: 'dept_manage' // Custom check below
            },
            {
                id: 'anuncios',
                title: 'Tablón de Anuncios',
                icon: 'fas fa-bullhorn',
                desc: 'Comunicación interna y avisos oficiales.',
                steps: [
                    '<b>Lectura:</b> Revisa los avisos ordenados por fecha.',
                    '<b>Búsqueda:</b> Usa la barra de búsqueda para encontrar avisos antiguos.',
                    '<b>Publicar (Admin/Dir):</b> Botón "Nuevo Anuncio" para enviar un mensaje a todo el claustro.'
                ],
                access: 'anuncios'
            },
            {
                id: 'admin-users',
                title: 'Admin: Usuarios',
                icon: 'fas fa-users-cog',
                desc: 'Gestión global de cuentas y accesos (Solo Administradores).',
                steps: [
                    '<b>Lista:</b> Ver todos los usuarios registrados, buscar por nombre o email.',
                    '<b>Editar:</b> Asigna departamentos y roles especiales (TIC, Dirección, Jefatura).',
                    '<b>Permisos:</b> Convierte a un usuario en Administrador o hazlo "Tester" para probar funciones nuevas.'
                ],
                access: 'admin'
            },
            {
                id: 'admin-config',
                title: 'Admin: Configuración',
                icon: 'fas fa-cogs',
                desc: 'Control del despliegue de módulos.',
                steps: [
                    '<b>Visibilidad:</b> Decide qué módulos ven los usuarios.',
                    '<b>Activo:</b> Visible para todos.',
                    '<b>Solo Testers:</b> Visible solo para usuarios con rol "Tester" (Pruebas).',
                    '<b>Inactivo:</b> Oculto para todos (Mantenimiento).'
                ],
                access: 'admin'
            },
            {
                id: 'admin-audit',
                title: 'Admin: Auditoría',
                icon: 'fas fa-shield-alt',
                desc: 'Seguridad y control de accesos.',
                steps: [
                    '<b>Registro:</b> Consulta quién ha iniciado sesión, cuándo y si hubo errores (contraseña mal, usuario no encontrado).',
                    '<b>Diagnóstico:</b> Útil para ayudar a compañeros que "no pueden entrar".'
                ],
                access: 'admin'
            }
        ];

        this.render();
    }

    checkAccess(moduleKey) {
        if (moduleKey === 'active') return true;
        if (moduleKey === 'admin') return this.isAdmin || this.userRoles.includes('equipo_tic');
        if (moduleKey === 'dept_manage') return true; // Available to everyone who has a department, basically all confirmed users

        // Reuse standard logic
        const config = this.moduleConfig || {};
        const state = config[moduleKey];
        if (state === 'active' || state === true || state === undefined) return true;
        if (state === 'testers') return this.userRoles.includes('tester');
        return false;
    }

    render() {
        this.container.innerHTML = `
            <div class="module-header fade-in">
                <h2><i class="fas fa-question-circle me-2"></i>Ayuda y Tutoriales</h2>
                <p class="text-muted">Guía de uso de las funcionalidades activas para tu usuario.</p>
            </div>

            <div class="accordion pb-5 mb-5" id="helpAccordion">
                <!-- Content injected here -->
            </div>
        `;

        const accordionContainer = document.getElementById('helpAccordion');

        let modulesShown = 0;

        this.helpContent.forEach((item, index) => {
            if (this.checkAccess(item.access)) {
                modulesShown++;
                const isExpanded = index === 0 ? 'show' : ''; // Expand first item
                const isCollapsed = index === 0 ? '' : 'collapsed';

                const html = `
                    <div class="accordion-item shadow-sm mb-3 border-0 rounded">
                        <h2 class="accordion-header" id="heading${item.id}">
                            <button class="accordion-button ${isCollapsed} fw-bold text-primary" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${item.id}" aria-expanded="${index === 0}" aria-controls="collapse${item.id}">
                                <i class="${item.icon} me-3 fa-lg"></i> ${item.title}
                            </button>
                        </h2>
                        <div id="collapse${item.id}" class="accordion-collapse collapse ${isExpanded}" aria-labelledby="heading${item.id}" data-bs-parent="#helpAccordion">
                            <div class="accordion-body bg-light">
                                <p class="lead fs-6 mb-3">${item.desc}</p>
                                <h6 class="text-uppercase text-muted small fw-bold mb-2">Cómo usarlo:</h6>
                                <ul class="list-group list-group-flush rounded">
                                    ${item.steps.map(step => `<li class="list-group-item bg-white"><i class="fas fa-check text-success me-2"></i>${step}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
                accordionContainer.insertAdjacentHTML('beforeend', html);
            }
        });

        if (modulesShown === 0) {
            accordionContainer.innerHTML = '<div class="alert alert-info">No hay módulos disponibles para mostrar ayuda.</div>';
        }
    }
}
