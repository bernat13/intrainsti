import { UIHelpers } from '../UIHelpers.js';

export class AnnouncementsModule {
    constructor(container, supabaseService, user, userRoles, isAdmin) {
        this.container = container;
        this.supabaseService = supabaseService;
        this.user = user;
        this.userRoles = userRoles;
        this.isAdmin = isAdmin;
        this.canCreate = userRoles.includes('equipo_directivo') || userRoles.includes('director');

        this.render();

        // Bind global function
        window.deleteAnnouncement = this.deleteAnnouncement.bind(this);
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header d-flex justify-content-between align-items-center">
                <div>
                    <h2><i class="fas fa-bullhorn me-2"></i>Tablón de Anuncios</h2>
                    <p class="text-muted mb-0">Novedades y comunicaciones del centro</p>
                </div>
                ${this.canCreate ? '<button id="btn-new-announcement" class="btn btn-primary"><i class="fas fa-plus me-2"></i>Nuevo Anuncio</button>' : ''}
            </div>

            <div id="announcements-list" class="mt-4">
                <div class="spinner-border text-primary" role="status"></div>
            </div>
        `;

        if (this.canCreate) {
            document.getElementById('btn-new-announcement').addEventListener('click', () => this.showCreateModal());
        }

        await this.loadAnnouncements();
    }

    async loadAnnouncements() {
        const container = document.getElementById('announcements-list');
        UIHelpers.showLoading(container);

        try {
            const announcements = await this.supabaseService.getAnnouncements(this.userRoles);

            if (announcements.length === 0) {
                UIHelpers.showEmptyState(container, 'No hay anuncios disponibles', 'bullhorn');
                return;
            }

            container.innerHTML = announcements.map(ann => this.renderAnnouncementCard(ann)).join('');
        } catch (error) {
            console.error('Error loading announcements:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar los anuncios</div>';
        }
    }

    renderAnnouncementCard(announcement) {
        const priorityClass = announcement.priority === 'urgente' ? 'priority-urgent' :
            announcement.priority === 'alta' ? 'priority-high' : '';

        return `
            <div class="card announcement-card ${priorityClass} mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title mb-0">${UIHelpers.escapeHtml(announcement.title)}</h5>
                        ${UIHelpers.getPriorityBadge(announcement.priority || 'normal')}
                    </div>
                    <p class="card-text">${UIHelpers.escapeHtml(announcement.content)}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="fas fa-user me-1"></i>${UIHelpers.escapeHtml(announcement.authorName)} • 
                            <i class="fas fa-clock me-1"></i>${UIHelpers.formatDate(announcement.createdAt)}
                        </small>
                        ${(this.canCreate && announcement.author === this.user.uid) || this.isAdmin ?
                `<button class="btn btn-sm btn-outline-danger" onclick="window.deleteAnnouncement('${announcement.id}')">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    showCreateModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-bullhorn me-2"></i>Nuevo Anuncio</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-announcement">
                            <div class="mb-3">
                                <label class="form-label">Título *</label>
                                <input type="text" class="form-control" id="announcement-title" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Contenido *</label>
                                <textarea class="form-control" id="announcement-content" rows="5" required></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Prioridad</label>
                                <select class="form-select" id="announcement-priority">
                                    <option value="normal">Normal</option>
                                    <option value="alta">Alta</option>
                                    <option value="urgente">Urgente</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Visible para (dejar vacío para todos)</label>
                                <select class="form-select" id="announcement-roles" multiple>
                                    <option value="jefe_departamento">Jefes de Departamento</option>
                                    <option value="equipo_tic">Equipo TIC</option>
                                    <option value="equipo_mantenimiento">Equipo Mantenimiento</option>
                                    <option value="equipo_directivo">Equipo Directivo</option>
                                    <option value="director">Director/a</option>
                                </select>
                                <small class="text-muted">Mantén pulsado Ctrl/Cmd para seleccionar varios</small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-announcement">Publicar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-announcement').addEventListener('click', async () => {
            const title = document.getElementById('announcement-title').value;
            const content = document.getElementById('announcement-content').value;
            const priority = document.getElementById('announcement-priority').value;
            const rolesSelect = document.getElementById('announcement-roles');
            const targetRoles = Array.from(rolesSelect.selectedOptions).map(opt => opt.value);

            if (!title || !content) {
                UIHelpers.showToast('Por favor completa todos los campos', 'error');
                return;
            }

            try {
                await this.supabaseService.createAnnouncement({
                    title,
                    content,
                    priority,
                    targetRoles
                }, this.user.uid, this.user.displayName || this.user.email.split('@')[0]);

                UIHelpers.showToast('Anuncio publicado correctamente', 'success');
                bsModal.hide();
                await this.loadAnnouncements();
            } catch (error) {
                console.error('Error creating announcement:', error);
                UIHelpers.showToast('Error al publicar el anuncio', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async deleteAnnouncement(id) {
        if (await UIHelpers.confirm('¿Estás seguro de que quieres eliminar este anuncio?')) {
            try {
                await this.supabaseService.deleteAnnouncement(id);
                UIHelpers.showToast('Anuncio eliminado', 'success');
                await this.loadAnnouncements(); // Reload list instead of page reload
            } catch (error) {
                console.error('Error deleting announcement:', error);
                UIHelpers.showToast('Error al eliminar el anuncio', 'error');
            }
        }
    }

    destroy() {
        // Cleanup global function
        delete window.deleteAnnouncement;
    }
}
