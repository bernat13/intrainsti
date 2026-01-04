import { MONTHS, DAYS, getDaysInMonth, getFirstDayOfMonth } from './utils.js';

export class Calendar {
    constructor(containerOrConfig, firebaseService, user, userRoles = [], options = {}) {
        // Support legacy constructor signature: (containerId, firebaseService, ...)
        // vs New signature: (domElementsConfig, firebaseService, ..., options)

        let domConfig = {};

        if (typeof containerOrConfig === 'string') {
            // Legacy mode: ID passed
            this.container = document.getElementById(containerOrConfig);
            domConfig = {
                grid: document.getElementById('calendar-grid'),
                monthLabel: document.getElementById('current-month-year'),
                prevBtn: document.getElementById('prev-month'),
                nextBtn: document.getElementById('next-month')
            };
        } else {
            // New mode: DOM Elements object passed
            domConfig = containerOrConfig;
        }

        this.grid = domConfig.grid;
        this.monthLabel = domConfig.monthLabel;
        this.prevBtn = domConfig.prevBtn;
        this.nextBtn = domConfig.nextBtn;

        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles;

        // Options for reusability
        this.options = {
            fetchData: null, // Callback(year, month) -> Promise/Data. If null, uses default logic.
            renderCell: null, // Callback(cell, dateStr, dayData) -> void. Custom cell rendering.
            onDateSelect: null, // Callback(dateStr) -> void.
            showNavigationIcons: false,
            ...options
        };

        // Define permissions based on strict requirements (Default Logic)
        this.canEditSlots = this.userRoles.includes('director');
        this.canAddEvents = this.userRoles.includes('equipo_directivo');

        const now = new Date();
        this.currentYear = now.getFullYear();
        this.currentMonth = now.getMonth();

        this.availabilityData = {};
        this.unsubscribe = null;

        this.init();
    }

    async init() {
        this.setupControls();
        this.loadMonth();
    }

    setupControls() {
        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.changeMonth(-1));
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.changeMonth(1));
    }

    changeMonth(delta) {
        this.currentMonth += delta;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.loadMonth();
    }

    loadMonth() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        this.updateHeaderLabel();
        this.renderSkeleton();

        if (this.options.fetchData) {
            // Custom data fetching
            Promise.resolve(this.options.fetchData(this.currentYear, this.currentMonth))
                .then(data => {
                    this.availabilityData = data || {};
                    this.render();
                })
                .catch(err => {
                    console.error("Error fetching calendar data", err);
                    this.availabilityData = {};
                    this.render();
                });
        } else {
            // Default behavior: Subscribe to monthly availability
            this.unsubscribe = this.firebaseService.subscribeToMonth(this.currentYear, this.currentMonth, (data) => {
                this.availabilityData = data;
                this.render();
            });
        }
    }

    renderSkeleton() {
        if (!this.grid) return;
        this.grid.innerHTML = '';
        DAYS.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'calendar-header';
            cell.textContent = day;
            this.grid.appendChild(cell);
        });

        const totalDays = getDaysInMonth(this.currentYear, this.currentMonth);
        const firstDayIndex = getFirstDayOfMonth(this.currentYear, this.currentMonth);

        // Empty cells
        for (let i = 0; i < firstDayIndex; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day empty';
            this.grid.appendChild(cell);
        }

        // Skeleton cells
        for (let day = 1; day <= totalDays; day++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            cell.innerHTML = '<div class="spinner-border spinner-border-sm text-secondary" role="status"></div>';
            this.grid.appendChild(cell);
        }
    }

    updateHeaderLabel() {
        if (this.monthLabel) {
            this.monthLabel.textContent = `${MONTHS[this.currentMonth]} ${this.currentYear}`;
        }
    }

    render() {
        if (!this.grid) return;
        this.grid.innerHTML = '';

        // Headers
        DAYS.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'calendar-header';
            cell.textContent = day;
            this.grid.appendChild(cell);
        });

        const totalDays = getDaysInMonth(this.currentYear, this.currentMonth);
        const firstDayIndex = getFirstDayOfMonth(this.currentYear, this.currentMonth);

        // Empty cells for previous month
        for (let i = 0; i < firstDayIndex; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day empty';
            this.grid.appendChild(cell);
        }

        // Days
        for (let day = 1; day <= totalDays; day++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayData = this.availabilityData[dateStr] || {};
            const dateObj = new Date(this.currentYear, this.currentMonth, day);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            const cell = document.createElement('div');
            cell.className = 'calendar-day';

            // Custom rendering hook
            if (this.options.renderCell) {
                // Allow customized rendering completely
                this.options.renderCell(cell, dateStr, dayData, isWeekend);
            } else {
                // Default Rendering Logic
                this.renderDefaultCell(cell, dateStr, dayData, isWeekend, day);
            }

            // Common Date Select Handler
            if (this.options.onDateSelect) {
                cell.style.cursor = 'pointer';
                cell.addEventListener('click', (e) => {
                    // Don't trigger if clicking on interactive elements inside
                    if (e.target.closest('button') || e.target.closest('.admin-interactive') || e.target.closest('.delete-event-btn') || e.target.closest('.event-badge')) {
                        return;
                    }
                    this.options.onDateSelect(dateStr);
                });
            }

            this.grid.appendChild(cell);
        }
    }

    renderDefaultCell(cell, dateStr, dayData, isWeekend, day) {
        // Number
        const number = document.createElement('span');
        number.className = 'day-number';
        number.textContent = day;
        cell.appendChild(number);

        if (dayData.isHoliday) {
            cell.classList.add('day-red'); // Visual red
            if (this.canEditSlots) {
                cell.title = "Ctrl+Click para quitar festivo";
                cell.style.cursor = 'pointer';
                cell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (e.ctrlKey || e.metaKey) { // Support Mac Command key too
                        this.firebaseService.toggleHoliday(dateStr);
                    }
                });
            }
        } else {
            // Icons Container
            const iconsContainer = document.createElement('div');
            iconsContainer.className = 'd-flex justify-content-center flex-wrap mt-1 gap-1';
            // Prevent date selection when clicking empty space in container
            iconsContainer.addEventListener('click', (e) => e.stopPropagation());

            // 1. Drive Link (Parte de Guardia)
            if (dayData.driveLink) {
                const driveBtn = document.createElement('a');
                driveBtn.className = 'btn btn-sm btn-outline-primary p-0 px-1 d-flex align-items-center justify-content-center';
                driveBtn.style.fontSize = '0.65em';
                driveBtn.style.height = '20px';
                driveBtn.href = `https://docs.google.com/document/d/${dayData.driveLink}/edit`;
                driveBtn.target = '_blank';
                driveBtn.innerHTML = '<i class="fab fa-google-drive me-1"></i>Guardias';
                driveBtn.title = 'Ver Parte de Guardia';
                iconsContainer.appendChild(driveBtn);
            }

            // 2 & 3. Navigation Icons (SUM and Carts) - Always Visible if enabled
            if (this.options.showNavigationIcons) {
                // SUM Icon
                // Capacity: 7 slots.
                // Logic: 0 -> Gray, 1-6 -> Orange, 7+ -> Red.
                const sumCount = dayData.sumCount || 0;
                const sumCapacity = 7;

                let sumClass = 'btn-light text-secondary border-0'; // Default (0)
                let sumTitle = 'Reservar SUM (Libre)';

                if (sumCount > 0) {
                    if (sumCount >= sumCapacity) {
                        sumClass = 'btn-danger text-white'; // Full
                        sumTitle = 'Reservas SUM (Completo)';
                    } else {
                        sumClass = 'btn-warning text-dark'; // Partial
                        sumTitle = `Reservas SUM (${sumCount}/${sumCapacity} ocupados)`;
                    }
                }

                const sumBtn = document.createElement('div');
                sumBtn.className = `btn btn-sm p-0 px-1 d-flex align-items-center justify-content-center ${sumClass}`;
                sumBtn.style.fontSize = '0.7em';
                sumBtn.style.width = '24px';
                sumBtn.style.height = '24px';
                sumBtn.innerHTML = '<i class="fas fa-chalkboard-teacher"></i>';
                sumBtn.title = sumTitle;
                sumBtn.onclick = (e) => {
                    e.stopPropagation();
                    localStorage.setItem('pendingDate', dateStr);
                    window.location.hash = '/reserva-sum';
                };
                iconsContainer.appendChild(sumBtn);

                // Carts Icon
                // Capacity: TotalCarts * 7 slots.
                const cartCount = dayData.cartCount || 0;
                const totalActiveCarts = dayData.totalActiveCarts || 0; // Passed from service
                // If totalActiveCarts is 0 (not loaded or none), assume partial if count > 0?
                // Or fallback to orange.
                const totalCartSlots = totalActiveCarts * 7;

                let cartsClass = 'btn-light text-secondary border-0';
                let cartsTitle = 'Reservar Carros (Libre)';

                if (cartCount > 0) {
                    if (totalActiveCarts > 0 && cartCount >= totalCartSlots) {
                        cartsClass = 'btn-danger text-white'; // Full
                        cartsTitle = 'Reservas Carros (Completo)';
                    } else {
                        // User asked for "Orange" if partial.
                        // Previously used 'btn-dark' (Dashboard color). Now 'btn-warning' (Orange).
                        cartsClass = 'btn-warning text-dark';
                        cartsTitle = `Reservas Carros (${cartCount} reservas)`;
                    }
                }

                const cartsBtn = document.createElement('div');
                cartsBtn.className = `btn btn-sm p-0 px-1 d-flex align-items-center justify-content-center ${cartsClass}`;
                cartsBtn.style.fontSize = '0.7em';
                cartsBtn.style.width = '24px';
                cartsBtn.style.height = '24px';
                cartsBtn.innerHTML = '<i class="fas fa-laptop"></i>';
                cartsBtn.title = cartsTitle;
                cartsBtn.onclick = (e) => {
                    e.stopPropagation();
                    localStorage.setItem('pendingDate', dateStr);
                    window.location.hash = '/reserva-carros';
                };
                iconsContainer.appendChild(cartsBtn);
            }

            if (iconsContainer.hasChildNodes()) {
                cell.appendChild(iconsContainer);
            }

            if (isWeekend) {
                cell.classList.add('day-red');
            } else {
                const slots = dayData.remainingSlots !== undefined ? dayData.remainingSlots : 4;
                const badge = document.createElement('span');
                badge.className = `slot-badge ${this.getBadgeClass(slots)}`;
                badge.textContent = `${slots} Huecos`;

                if (this.canEditSlots) {
                    badge.classList.add('admin-interactive');
                    badge.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (e.ctrlKey || e.metaKey) {
                            this.firebaseService.toggleHoliday(dateStr);
                        } else {
                            if (slots > 0) this.firebaseService.updateSlot(dateStr, slots - 1);
                        }
                    });
                    badge.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (slots < 4) this.firebaseService.updateSlot(dateStr, slots + 1);
                    });
                    badge.title = "Click: -1 | Click Dcho: +1 | Ctrl+Click: Festivo";
                }

                cell.appendChild(badge);

                // Moved Events Render (Here, after Huecos)
                if (dayData.events && dayData.events.length > 0) {
                    dayData.events.forEach(event => {
                        const eventBadge = document.createElement('div');
                        eventBadge.className = `event-badge bg-${event.type === 'cloister' ? 'danger' : 'info'} text-white mt-1`;

                        let displayTitle = event.title;
                        if (event.time) {
                            displayTitle = `${event.time} ${displayTitle}`;
                        }

                        eventBadge.textContent = displayTitle;
                        eventBadge.title = event.description || event.title;

                        if (event.link) {
                            eventBadge.style.cursor = 'pointer';
                            eventBadge.innerHTML += ' <i class="fas fa-external-link-alt small ms-1"></i>';
                            eventBadge.onclick = (e) => {
                                e.stopPropagation();
                                window.open(event.link, '_blank');
                            };
                            eventBadge.title += ` (Ir a: ${event.link})`;
                        }

                        // Management Team Event Deletion
                        if (this.canAddEvents) {
                            const deleteBtn = document.createElement('i');
                            deleteBtn.className = 'fas fa-trash small ms-2 text-white-50 delete-event-btn';
                            deleteBtn.style.cursor = 'pointer';
                            deleteBtn.onclick = (e) => {
                                e.stopPropagation();
                                if (confirm('¿Seguro que quieres borrar este evento?')) {
                                    this.firebaseService.removeCalendarEvent(dateStr, event)
                                        .then(() => {
                                            if (window.UIHelpers) window.UIHelpers.showToast('Evento eliminado', 'success');
                                        })
                                        .catch(err => console.error(err));
                                }
                            };
                            deleteBtn.onmouseover = () => deleteBtn.classList.remove('text-white-50');
                            deleteBtn.onmouseout = () => deleteBtn.classList.add('text-white-50');
                            eventBadge.appendChild(deleteBtn);
                        }

                        cell.appendChild(eventBadge);
                    });
                }

                // Admin Interactions (Shift+Click for Drive, etc)
                if (this.isAdmin || (this.userRoles && this.userRoles.includes('equipo_tic'))) {
                    cell.addEventListener('mousedown', (e) => {
                        // Shift + Click: Link Drive Doc
                        if (e.shiftKey && e.button === 0) {
                            e.preventDefault();
                            e.stopPropagation();
                            const currentId = dayData.driveLink || '';
                            const newId = prompt('ID del documento de Drive (vacío para borrar):', currentId);
                            if (newId !== null) {
                                this.firebaseService.setDriveLink(dateStr, newId);
                            }
                            return;
                        }
                    });
                }

                if (this.canEditSlots) {
                    // Cell-level clicks for admins
                    cell.addEventListener('mousedown', (e) => {
                        // Ctrl + Click: Toggle Holiday (on cell background)
                        if ((e.ctrlKey || e.metaKey) && e.button === 0) {
                            e.preventDefault();
                            e.stopPropagation();
                            this.firebaseService.toggleHoliday(dateStr);
                            return;
                        }

                        // Right Click on cell background: +1 Slot
                        if (e.button === 2) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (slots < 4) this.firebaseService.updateSlot(dateStr, slots + 1);
                        }
                    });
                    cell.addEventListener('contextmenu', (e) => e.preventDefault());
                }

                // Management Team Event Creation
                if (this.canAddEvents) {
                    cell.addEventListener('dblclick', (e) => {
                        if (window.addCalendarEvent) window.addCalendarEvent(dateStr);
                    });
                    cell.title += (this.canEditSlots ? " | " : "") + "Doble click para añadir evento";
                }
            }
        }
    }

    getBadgeClass(slots) {
        if (slots >= 3) return 'slots-high';
        if (slots >= 1) return 'slots-low';
        return 'slots-zero';
    }
}
