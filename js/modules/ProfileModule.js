import { UIHelpers } from '../UIHelpers.js';

export class ProfileModule {
    constructor(supabaseService, user) {
        this.supabaseService = supabaseService;
        this.user = user;
    }


    async showProfileModal() {
        const profile = await this.supabaseService.getProfile(this.user.id);
        const instituteMember = this.supabaseService.currentInstitute
            ? await this.supabaseService.getInstituteMember(this.user.id, this.supabaseService.currentInstitute.id)
            : null;

        let myDept = null;
        if (this.supabaseService.currentInstitute) {
            const departments = await this.supabaseService.getAllDepartments();
            myDept = departments.find(d => d.id === instituteMember?.department);
        }

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'profileModal';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title"><i class="fas fa-user-circle me-2"></i>Mi Perfil</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="text-center mb-4">
                            <div class="avatar-circle bg-primary text-white d-inline-flex align-items-center justify-content-center rounded-circle fs-1 mb-2" style="width: 80px; height: 80px;">
                                ${profile.photo_url ? `<img src="${profile.photo_url}" class="rounded-circle w-100 h-100" style="object-fit: cover;">` : (profile.display_name || user.email).charAt(0).toUpperCase()}
                            </div>
                            <h4 class="fw-bold mb-0">${UIHelpers.escapeHtml(profile.display_name || this.user.email)}</h4>
                            <p class="text-muted small">${UIHelpers.escapeHtml(this.user.email)}</p>
                        </div>

                        <div class="list-group list-group-flush">
                            <div class="list-group-item px-0">
                                <small class="text-muted d-block uppercase fw-bold" style="font-size: 0.7rem;">INSTITUTO</small>
                                <div class="fw-bold">${UIHelpers.escapeHtml(this.supabaseService.currentInstitute?.name || 'Sin asignar')}</div>
                            </div>
                            <div class="list-group-item px-0">
                                <small class="text-muted d-block uppercase fw-bold" style="font-size: 0.7rem;">DEPARTAMENTO</small>
                                <div>${myDept ? UIHelpers.escapeHtml(myDept.name) : '<span class="text-muted">Sin departamento</span>'}</div>
                            </div>
                            <div class="list-group-item px-0">
                                <small class="text-muted d-block uppercase fw-bold" style="font-size: 0.7rem;">ROLES</small>
                                <div>
                                    ${(instituteMember?.roles || []).map(r => `<span class="badge bg-secondary me-1">${UIHelpers.getRoleDisplayName(r)}</span>`).join('') || '<span class="text-muted">Sin roles especiales</span>'}
                                </div>
                            </div>
                        </div>

                        <hr>

                        <form id="profile-form">
                            <div class="mb-3">
                                <label class="form-label">Nombre para mostrar</label>
                                <input type="text" class="form-control" id="profile-display-name" value="${UIHelpers.escapeHtml(profile.display_name || '')}">
                            </div>
                            <!-- Future: Photo URL input -->
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-profile">Guardar Cambios</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-profile').addEventListener('click', async () => {
            const newName = document.getElementById('profile-display-name').value;
            if (newName && newName !== profile.display_name) {
                try {
                    await this.supabaseService.upsertProfile({
                        id: this.user.id,
                        email: this.user.email,
                        user_metadata: { full_name: newName } // This might need adjustment based on how upsertProfile works
                    });
                    // Actually upsertProfile in Service takes a user object, but let's check its implementation.
                    // It uses: id, email, display_name: user.user_metadata.full_name || ...
                    // So I should call a specific update method or modify upsertProfile to take direct updates.
                    // Let's assume I can call supabase direct update or add updateProfile method.
                    // Service has upsertProfile taking a user object.

                    // Let's add updateProfile method to Service or use what we have.
                    // I will implement a specific updateProfile in service later or now.
                    // For now, let's try to update strictly the profile table.

                    const { error } = await this.supabaseService.supabase
                        .from('user_profiles')
                        .update({ display_name: newName })
                        .eq('id', this.user.id);

                    if (error) throw error;

                    UIHelpers.showToast('Perfil actualizado correctamente', 'success');
                    bsModal.hide();
                    setTimeout(() => window.location.reload(), 1000); // Reload to reflect changes
                } catch (e) {
                    console.error(e);
                    UIHelpers.showToast('Error al actualizar perfil', 'error');
                }
            } else {
                bsModal.hide();
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    showAboutModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header border-0 pb-0">
                         <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center pt-0 pb-5">
                       <i class="fas fa-school text-primary mb-3" style="font-size: 4rem;"></i>
                       <h3 class="fw-bold mb-1">Intranet IES Antonio Machado</h3>
                       <p class="text-muted">Gestión Integral de Centro Educativo</p>
                       
                       <div class="my-4">
                           <span class="badge bg-light text-dark border">v1.0.0-beta</span>
                       </div>

                       <div class="text-start bg-light p-3 rounded mx-auto" style="max-width: 350px;">
                           <small class="d-block text-muted mb-2 fw-bold text-uppercase">Créditos</small>
                           <ul class="list-unstyled small mb-0">
                               <li class="mb-1"><i class="fas fa-code me-2 text-primary"></i>Desarrollado por el Dpto. de Informática</li>
                               <li><i class="fas fa-calendar-alt me-2 text-success"></i>Curso 2025-2026</li>
                           </ul>
                       </div>

                       <div class="mt-4">
                           <p class="small text-muted mb-0">
                               Hecho con <i class="fas fa-heart text-danger mx-1"></i> y mucha cafeína.
                           </p>
                       </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }
}
