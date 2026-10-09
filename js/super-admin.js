/* ==========================================================================
   Super Admin JS - Dedicated Master Control Panel & Advertisement Engine
   Exclusive for Super Admin (kasivishal)
   ========================================================================== */

class SuperAdminDashboardController {
  constructor() {
    this.activeTab = 'admins'; // 'admins' | 'ads'
    this.adminSearchQuery = '';
    this.adminRoleFilter = 'All';

    this.adSearchQuery = '';
    this.adPlacementFilter = 'All';
    this.adNetworkFilter = 'All';

    this.currentEditingAdminId = null;
    this.currentEditingAdId = null;
  }

  init() {
    if (!window.auth || !auth.isSuperAdmin()) {
      console.warn("Unauthorized attempt to access Super Admin Controller.");
      return;
    }

    this.renderCurrentTab();
    this.renderGlobalAdSlots();
  }

  /* --- Navigation / Tab Switching --- */
  switchTab(tabId) {
    this.activeTab = tabId;

    // Toggle nav buttons
    document.querySelectorAll('.super-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    // Toggle panels
    const adminsPanel = document.getElementById('super-panel-admins');
    const adsPanel = document.getElementById('super-panel-ads');

    if (adminsPanel) adminsPanel.classList.toggle('active', tabId === 'admins');
    if (adsPanel) adsPanel.classList.toggle('active', tabId === 'ads');

    this.renderCurrentTab();
  }

  renderCurrentTab() {
    if (this.activeTab === 'admins') {
      this.renderAdminsTable();
    } else if (this.activeTab === 'ads') {
      this.renderAdsTable();
    }
  }

  /* ==========================================================================
     MODULE 1: ADMINISTRATOR ACCOUNTS MANAGEMENT (CREATE, EDIT, DELETE)
     ========================================================================== */
  renderAdminsTable() {
    const admins = (window.storage && typeof storage.getAdmins === 'function')
      ? storage.getAdmins()
      : (window.DEFAULT_ADMINS || []);

    // Update Stats Counters
    const totalCount = admins.length;
    const superCount = admins.filter(a => a.isSuperAdmin || (a.role || '').toLowerCase() === 'super admin' || (a.username || '').toLowerCase() === 'kasivishal').length;
    const regularCount = totalCount - superCount;

    const elTotal = document.getElementById('super-stat-total-admins');
    const elSuper = document.getElementById('super-stat-super-admins');
    const elRegular = document.getElementById('super-stat-regular-admins');

    if (elTotal) elTotal.textContent = totalCount;
    if (elSuper) elSuper.textContent = superCount;
    if (elRegular) elRegular.textContent = regularCount;

    // Filter admins based on search & role
    const search = (this.adminSearchQuery || '').trim().toLowerCase();
    const roleFilter = this.adminRoleFilter;

    const filtered = admins.filter(admin => {
      const name = (admin.name || '').toLowerCase();
      const username = (admin.username || '').toLowerCase();
      const matchesSearch = !search || name.includes(search) || username.includes(search);

      let matchesRole = true;
      if (roleFilter === 'Super Admin') {
        matchesRole = admin.isSuperAdmin || (admin.role || '').toLowerCase() === 'super admin' || username === 'kasivishal';
      } else if (roleFilter === 'Standard Admin') {
        matchesRole = !admin.isSuperAdmin && (admin.role || '').toLowerCase() !== 'super admin' && username !== 'kasivishal';
      }

      return matchesSearch && matchesRole;
    });

    const tbody = document.getElementById('super-admins-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.6;">👥</div>
            <div style="font-weight: 600;">No administrators found</div>
            <div style="font-size: 0.8rem; margin-top: 0.25rem;">Try modifying your search or click "+ Add New Admin" above.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(admin => {
      const isSuper = admin.isSuperAdmin || (admin.role || '').toLowerCase() === 'super admin' || (admin.username || '').toLowerCase() === 'kasivishal';
      const isPrimary = (admin.username || '').toLowerCase() === 'kasivishal';
      const initial = (admin.name || admin.username || 'A').charAt(0).toUpperCase();
      const avatarBg = isSuper ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #6366f1, #4f46e5)';
      const roleBadge = isSuper 
        ? `<span class="badge" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; font-weight: 700; padding: 3px 9px; border-radius: 999px; font-size: 0.72rem; box-shadow: 0 2px 6px rgba(245, 158, 11, 0.35);">👑 Super Admin</span>`
        : `<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); font-weight: 600; padding: 3px 9px; border-radius: 999px; font-size: 0.72rem;">Faculty Admin</span>`;

      const dateStr = admin.createdAt ? new Date(admin.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Permanent';

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: ${avatarBg}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">${initial}</div>
              <div>
                <div style="font-weight: 600; color: var(--text-main); font-size: 0.88rem;">${escapeHtml(admin.name || 'Unnamed Admin')}</div>
                ${isPrimary ? '<div style="font-size: 0.72rem; color: #f59e0b; font-weight: 600;">Root Authority</div>' : ''}
              </div>
            </div>
          </td>
          <td>
            <code style="background: rgba(99, 102, 241, 0.1); color: var(--primary-400); padding: 3px 7px; border-radius: 6px; font-weight: 700; font-size: 0.82rem;">${escapeHtml(admin.username)}</code>
          </td>
          <td>
            <div style="display: inline-flex; align-items: center; gap: 6px;">
              <span class="admin-pwd-text" data-pwd="${escapeHtml(admin.password || '')}" style="font-family: var(--font-mono); font-size: 0.82rem; letter-spacing: 1px;">••••••••</span>
              <button type="button" class="btn-icon-subtle" onclick="superAdminDashboard.togglePasswordVisibility(this)" title="Toggle password preview" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px;">
                👁️
              </button>
            </div>
          </td>
          <td>${roleBadge}</td>
          <td style="font-size: 0.82rem; color: var(--text-muted);">${dateStr}</td>
          <td>
            <div style="display: flex; gap: 0.45rem; justify-content: flex-end; align-items: center;">
              <button type="button" class="btn btn-sm btn-secondary" onclick="superAdminDashboard.openEditAdminModal('${admin.id}')" title="Modify Admin Credentials" style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.32rem 0.65rem; font-size: 0.76rem; font-weight: 600;">
                ✏️ Edit
              </button>
              ${isPrimary ? `
                <button type="button" class="btn btn-sm btn-secondary" disabled title="Primary Super Admin cannot be deleted" style="opacity: 0.4; cursor: not-allowed; padding: 0.32rem 0.65rem; font-size: 0.76rem;">
                  🔒 Protected
                </button>
              ` : `
                <button type="button" class="btn btn-sm btn-danger" onclick="superAdminDashboard.deleteAdminConfirm('${admin.id}')" title="Delete Administrator" style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.32rem 0.65rem; font-size: 0.76rem; font-weight: 600;">
                  🗑️ Delete
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  togglePasswordVisibility(btnEl) {
    const span = btnEl.previousElementSibling;
    if (!span) return;
    const realPwd = span.getAttribute('data-pwd') || '';
    if (span.textContent === '••••••••') {
      span.textContent = realPwd;
      btnEl.textContent = '🙈';
    } else {
      span.textContent = '••••••••';
      btnEl.textContent = '👁️';
    }
  }

  onAdminSearch(val) {
    this.adminSearchQuery = val || '';
    this.renderAdminsTable();
  }

  onAdminRoleFilter(role, btnEl) {
    this.adminRoleFilter = role;
    if (btnEl && btnEl.parentElement) {
      btnEl.parentElement.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
    }
    this.renderAdminsTable();
  }

  /* --- Add Admin Modal Handlers --- */
  openAddAdminModal() {
    const form = document.getElementById('form-super-add-admin');
    if (form) form.reset();
    ui.showModal('modal-super-add-admin');
  }

  saveNewAdminSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('super-add-admin-name').value.trim();
    const username = document.getElementById('super-add-admin-username').value.trim();
    const password = document.getElementById('super-add-admin-password').value.trim();
    const role = document.getElementById('super-add-admin-role').value;

    try {
      storage.addAdmin({
        name,
        username,
        password,
        role,
        isSuperAdmin: role === 'Super Admin'
      });

      ui.hideModal('modal-super-add-admin');
      ui.showToast(`Admin account "${username}" created successfully!`, 'success');
      this.renderAdminsTable();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  }

  /* --- Edit Admin Modal Handlers --- */
  openEditAdminModal(adminId) {
    const admin = storage.getAdminById(adminId);
    if (!admin) {
      ui.showToast("Admin record not found.", "error");
      return;
    }

    this.currentEditingAdminId = adminId;
    document.getElementById('super-edit-admin-id').value = admin.id;
    document.getElementById('super-edit-admin-name').value = admin.name || '';
    document.getElementById('super-edit-admin-username').value = admin.username || '';
    document.getElementById('super-edit-admin-password').value = admin.password || '';
    document.getElementById('super-edit-admin-role').value = (admin.isSuperAdmin || admin.role === 'Super Admin') ? 'Super Admin' : 'Admin';

    // Disable username change for primary super admin
    const usernameInput = document.getElementById('super-edit-admin-username');
    const roleSelect = document.getElementById('super-edit-admin-role');
    const isPrimary = (admin.username || '').toLowerCase() === 'kasivishal';

    if (usernameInput) usernameInput.disabled = isPrimary;
    if (roleSelect) roleSelect.disabled = isPrimary;

    ui.showModal('modal-super-edit-admin');
  }

  saveEditAdminSubmit(e) {
    e.preventDefault();
    if (!this.currentEditingAdminId) return;

    const name = document.getElementById('super-edit-admin-name').value.trim();
    const username = document.getElementById('super-edit-admin-username').value.trim();
    const password = document.getElementById('super-edit-admin-password').value.trim();
    const role = document.getElementById('super-edit-admin-role').value;

    try {
      storage.updateAdmin(this.currentEditingAdminId, {
        name,
        username,
        password,
        role,
        isSuperAdmin: role === 'Super Admin'
      });

      ui.hideModal('modal-super-edit-admin');
      ui.showToast(`Admin record "${username}" updated successfully!`, 'success');
      this.renderAdminsTable();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  }

  deleteAdminConfirm(adminId) {
    const admin = storage.getAdminById(adminId);
    if (!admin) return;

    if (!confirm(`Are you sure you want to permanently delete administrator account "${admin.name} (${admin.username})"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      storage.deleteAdmin(adminId);
      ui.showToast(`Administrator "${admin.username}" deleted.`, 'success');
      this.renderAdminsTable();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  }

  /* ==========================================================================
     MODULE 2: ADVERTISEMENT CONTROL ENGINE (ADSENSE, META, CUSTOM BANNERS)
     ========================================================================== */
  renderAdsTable() {
    const ads = (window.storage && typeof storage.getAds === 'function') ? storage.getAds() : [];

    // Stats
    const totalAds = ads.length;
    const activeAds = ads.filter(a => a.status === 'active').length;
    const distinctPlacements = new Set(ads.map(a => a.placement)).size;

    const elTotal = document.getElementById('super-stat-total-ads');
    const elActive = document.getElementById('super-stat-active-ads');
    const elPlacements = document.getElementById('super-stat-ad-placements');

    if (elTotal) elTotal.textContent = totalAds;
    if (elActive) elActive.textContent = activeAds;
    if (elPlacements) elPlacements.textContent = distinctPlacements;

    // Filter
    const search = (this.adSearchQuery || '').trim().toLowerCase();
    const placementFilter = this.adPlacementFilter;
    const networkFilter = this.adNetworkFilter;

    const filtered = ads.filter(ad => {
      const title = (ad.title || '').toLowerCase();
      const matchesSearch = !search || title.includes(search);
      const matchesPlacement = placementFilter === 'All' || ad.placement === placementFilter;
      const matchesNetwork = networkFilter === 'All' || ad.network === networkFilter;
      return matchesSearch && matchesPlacement && matchesNetwork;
    });

    const tbody = document.getElementById('super-ads-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
            <div style="font-size: 2.2rem; margin-bottom: 0.5rem; opacity: 0.6;">📢</div>
            <div style="font-weight: 600;">No advertisements configured yet</div>
            <div style="font-size: 0.8rem; margin-top: 0.25rem;">Click "+ Create Advertisement" to configure Google AdSense, Meta Ads, or Custom Banners.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(ad => {
      const networkBadge = this.getNetworkBadge(ad.network);
      const placementLabel = this.getPlacementLabel(ad.placement);
      const isActive = ad.status === 'active';

      const previewHtml = this.renderAdMiniThumbnail(ad);

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-main); font-size: 0.88rem;">${escapeHtml(ad.title)}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Created: ${new Date(ad.createdAt).toLocaleDateString()}</div>
          </td>
          <td>${networkBadge}</td>
          <td>
            <span class="badge" style="background: rgba(14, 165, 233, 0.12); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3); font-weight: 600; padding: 3px 8px; border-radius: 8px; font-size: 0.74rem;">
              📍 ${placementLabel}
            </span>
          </td>
          <td style="max-width: 180px;">
            <div style="max-width: 180px; max-height: 48px; overflow: hidden; border-radius: 6px; border: 1px solid var(--bg-dark-border, #cbd5e1); background: var(--bg-dark-surface, #f8fafc); display: flex; align-items: center; justify-content: center;">
              ${previewHtml}
            </div>
          </td>
          <td>
            <label class="ad-toggle-switch" title="Toggle Campaign Active/Paused">
              <input type="checkbox" ${isActive ? 'checked' : ''} onchange="superAdminDashboard.toggleAdStatus('${ad.id}')">
              <span class="ad-toggle-slider"></span>
            </label>
            <span style="font-size: 0.75rem; font-weight: 600; margin-left: 6px; color: ${isActive ? '#10b981' : '#64748b'};">
              ${isActive ? 'Active' : 'Paused'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.45rem; justify-content: flex-end; align-items: center;">
              <button type="button" class="btn btn-sm btn-secondary" onclick="superAdminDashboard.openEditAdModal('${ad.id}')" title="Edit Campaign" style="padding: 0.32rem 0.65rem; font-size: 0.76rem; font-weight: 600;">
                ✏️ Edit
              </button>
              <button type="button" class="btn btn-sm btn-danger" onclick="superAdminDashboard.deleteAdConfirm('${ad.id}')" title="Delete Advertisement" style="padding: 0.32rem 0.65rem; font-size: 0.76rem; font-weight: 600;">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  getNetworkBadge(network) {
    switch (network) {
      case 'adsense':
        return `<span class="badge" style="background: rgba(234, 67, 53, 0.12); color: #ea4335; border: 1px solid rgba(234, 67, 53, 0.3); font-weight: 700; padding: 3px 8px; border-radius: 8px; font-size: 0.72rem;">🌐 Google AdSense</span>`;
      case 'meta':
        return `<span class="badge" style="background: rgba(24, 119, 242, 0.12); color: #1877f2; border: 1px solid rgba(24, 119, 242, 0.3); font-weight: 700; padding: 3px 8px; border-radius: 8px; font-size: 0.72rem;">📱 Meta Ads</span>`;
      case 'amazon':
        return `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.35); font-weight: 700; padding: 3px 8px; border-radius: 8px; font-size: 0.72rem;">🛒 Amazon Ads</span>`;
      case 'medianet':
        return `<span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.35); font-weight: 700; padding: 3px 8px; border-radius: 8px; font-size: 0.72rem;">🔷 Media.net</span>`;
      case 'propeller':
        return `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.35); font-weight: 700; padding: 3px 8px; border-radius: 8px; font-size: 0.72rem;">🚀 PropellerAds</span>`;
      case 'infolinks':
        return `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.35); font-weight: 700; padding: 3px 8px; border-radius: 8px; font-size: 0.72rem;">🔗 Infolinks</span>`;
      case 'adsterra':
        return `<span class="badge" style="background: rgba(249, 115, 22, 0.15); color: #ea580c; border: 1px solid rgba(249, 115, 22, 0.35); font-weight: 700; padding: 3px 8px; border-radius: 8px; font-size: 0.72rem;">⭐ Adsterra</span>`;
      case 'custom_banner':
        return `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; padding: 3px 8px; border-radius: 8px; font-size: 0.72rem;">🖼️ Banner / GIF</span>`;
      default:
        return `<span class="badge" style="background: rgba(139, 92, 246, 0.12); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.3); font-weight: 700; padding: 3px 8px; border-radius: 8px; font-size: 0.72rem;">💻 Rich HTML</span>`;
    }
  }

  getPlacementLabel(placement) {
    const found = (window.AD_PLACEMENTS || []).find(p => p.id === placement);
    return found ? found.label : placement;
  }

  renderAdMiniThumbnail(ad) {
    if (ad.network === 'custom_banner' && ad.imageUrl) {
      const isGif = (ad.imageUrl || '').toLowerCase().includes('.gif') || (ad.imageUrl || '').startsWith('data:image/gif');
      return `
        <div style="display: inline-flex; align-items: center; gap: 6px;">
          <img src="${escapeHtml(ad.imageUrl)}" alt="${escapeHtml(ad.altText || '')}" style="max-height: 44px; max-width: 85px; object-fit: contain; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08);" onerror="this.outerHTML='<span style=\\'font-size: 0.72rem; color: #f43f5e;\\'>Broken Image</span>'">
          ${isGif ? '<span class="badge" style="background: #ec4899; color: #fff; font-size: 0.65rem; padding: 2px 5px; border-radius: 4px; font-weight: 700;">GIF</span>' : ''}
        </div>
      `;
    }
    if (ad.network === 'adsense') {
      return `<span style="font-size: 0.72rem; font-weight: 700; color: #ea4335;">Google AdSense Embed</span>`;
    }
    if (ad.network === 'meta') {
      return `<span style="font-size: 0.72rem; font-weight: 700; color: #1877f2;">Meta Creative Embed</span>`;
    }
    if (ad.network === 'amazon') {
      return `<span style="font-size: 0.72rem; font-weight: 700; color: #d97706;">Amazon Associates Ad</span>`;
    }
    if (ad.network === 'medianet') {
      return `<span style="font-size: 0.72rem; font-weight: 700; color: #0284c7;">Media.net Contextual Tag</span>`;
    }
    if (ad.network === 'propeller') {
      return `<span style="font-size: 0.72rem; font-weight: 700; color: #dc2626;">PropellerAds Zone Tag</span>`;
    }
    if (ad.network === 'infolinks') {
      return `<span style="font-size: 0.72rem; font-weight: 700; color: #059669;">Infolinks Smart Tag</span>`;
    }
    if (ad.network === 'adsterra') {
      return `<span style="font-size: 0.72rem; font-weight: 700; color: #ea580c;">Adsterra Direct Display</span>`;
    }
    return `<span style="font-size: 0.72rem; font-weight: 600; color: #8b5cf6;">HTML Snippet</span>`;
  }

  onAdSearch(val) {
    this.adSearchQuery = val || '';
    this.renderAdsTable();
  }

  onAdPlacementFilter(placement) {
    this.adPlacementFilter = placement;
    this.renderAdsTable();
  }

  onAdNetworkFilter(net) {
    this.adNetworkFilter = net;
    this.renderAdsTable();
  }

  /* --- Direct File Upload for Images and Animated GIFs --- */
  handleImageFileUpload(modalType, fileInput) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      ui.showToast('Please select a valid image or GIF file (PNG, JPG, WebP, GIF, SVG).', 'error');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      ui.showToast('File size exceeds 8MB. Please select an optimized image or GIF.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const urlInput = document.getElementById(`super-${modalType}-ad-image-url`);
      if (urlInput) {
        urlInput.value = dataUrl;
      }

      const fileInfo = document.getElementById(`super-${modalType}-ad-file-info`);
      if (fileInfo) {
        const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
        const sizeKb = Math.round(file.size / 1024);
        fileInfo.style.display = 'block';
        fileInfo.innerHTML = `✓ Uploaded: <strong>${escapeHtml(file.name)}</strong> (${sizeKb} KB) ${isGif ? '<span class="badge" style="background: #ec4899; color: #fff; font-size: 0.65rem; padding: 2px 5px; border-radius: 4px; font-weight: 700;">ANIMATED GIF</span>' : ''}`;
      }

      this.updateAdLivePreview(modalType);
      ui.showToast(`Selected "${file.name}" ready to publish!`, 'info');
    };
    reader.onerror = () => {
      ui.showToast('Failed to read image file.', 'error');
    };
    reader.readAsDataURL(file);
  }

  /* --- Add/Edit Advertisement Modal Handlers --- */
  openAddAdModal() {
    const form = document.getElementById('form-super-add-ad');
    if (form) form.reset();
    const fileInfo = document.getElementById('super-add-ad-file-info');
    if (fileInfo) {
      fileInfo.style.display = 'none';
      fileInfo.innerHTML = '';
    }
    this.currentEditingAdId = null;
    this.switchAdNetworkFields('add', 'custom_banner');
    this.updateAdLivePreview('add');
    ui.showModal('modal-super-add-ad');
  }

  openEditAdModal(adId) {
    const ad = storage.getAdById(adId);
    if (!ad) {
      ui.showToast("Advertisement not found.", "error");
      return;
    }

    this.currentEditingAdId = adId;
    document.getElementById('super-edit-ad-id').value = ad.id;
    document.getElementById('super-edit-ad-title').value = ad.title || '';
    document.getElementById('super-edit-ad-network').value = ad.network || 'custom_banner';
    document.getElementById('super-edit-ad-placement').value = ad.placement || 'login_banner';
    document.getElementById('super-edit-ad-image-url').value = ad.imageUrl || '';
    document.getElementById('super-edit-ad-target-url').value = ad.targetUrl || '';
    document.getElementById('super-edit-ad-alt-text').value = ad.altText || '';
    document.getElementById('super-edit-ad-code-snippet').value = ad.codeSnippet || '';
    document.getElementById('super-edit-ad-status').value = ad.status || 'active';

    const fileInfo = document.getElementById('super-edit-ad-file-info');
    if (fileInfo) {
      if (ad.imageUrl && ad.imageUrl.startsWith('data:image/')) {
        const isGif = ad.imageUrl.startsWith('data:image/gif');
        fileInfo.style.display = 'block';
        fileInfo.innerHTML = `✓ Uploaded Custom File ${isGif ? '<span class="badge" style="background: #ec4899; color: #fff; font-size: 0.65rem; padding: 2px 5px; border-radius: 4px; font-weight: 700;">ANIMATED GIF</span>' : ''}`;
      } else {
        fileInfo.style.display = 'none';
        fileInfo.innerHTML = '';
      }
    }

    this.switchAdNetworkFields('edit', ad.network || 'custom_banner');
    this.updateAdLivePreview('edit');
    ui.showModal('modal-super-edit-ad');
  }

  switchAdNetworkFields(modalType, network) {
    const bannerGroup = document.getElementById(`super-${modalType}-ad-banner-group`);
    const codeGroup = document.getElementById(`super-${modalType}-ad-code-group`);
    const codeLabel = document.getElementById(`super-${modalType}-ad-code-label`);
    const codeHelp = document.getElementById(`super-${modalType}-ad-code-help`);

    if (network === 'custom_banner') {
      if (bannerGroup) bannerGroup.style.display = 'block';
      if (codeGroup) codeGroup.style.display = 'none';
    } else {
      if (bannerGroup) bannerGroup.style.display = 'none';
      if (codeGroup) codeGroup.style.display = 'block';

      switch (network) {
        case 'adsense':
          if (codeLabel) codeLabel.textContent = 'Google AdSense Script / Snippet Code';
          if (codeHelp) codeHelp.textContent = 'Paste your Google AdSense <script> or <ins class="adsbygoogle"> block here.';
          break;
        case 'meta':
          if (codeLabel) codeLabel.textContent = 'Meta Ads (Facebook/Instagram) Embed Code';
          if (codeHelp) codeHelp.textContent = 'Paste your Meta Ads Pixel, embed code or creative iframe snippet here.';
          break;
        case 'amazon':
          if (codeLabel) codeLabel.textContent = 'Amazon Ads / Native Shopping / Associates Code';
          if (codeHelp) codeHelp.textContent = 'Paste your Amazon Associates banner iframe, Native Shopping Ads, or product link widget here.';
          break;
        case 'medianet':
          if (codeLabel) codeLabel.textContent = 'Media.net (Yahoo! Bing) Contextual Tag Code';
          if (codeHelp) codeHelp.textContent = 'Paste your Yahoo! Bing Media.net contextual JavaScript tag or iframe ad unit here.';
          break;
        case 'propeller':
          if (codeLabel) codeLabel.textContent = 'PropellerAds Zone Tag / Banner Script';
          if (codeHelp) codeHelp.textContent = 'Paste your PropellerAds zone tag, push creative, or banner script here.';
          break;
        case 'infolinks':
          if (codeLabel) codeLabel.textContent = 'Infolinks Smart In-Text / In-Tag Script';
          if (codeHelp) codeHelp.textContent = 'Paste your Infolinks smart in-text, in-frame, or overlay script tag here.';
          break;
        case 'adsterra':
          if (codeLabel) codeLabel.textContent = 'Adsterra Direct Display / Social Bar Code';
          if (codeHelp) codeHelp.textContent = 'Paste your Adsterra native banner tag, social bar script, or direct display code here.';
          break;
        default:
          if (codeLabel) codeLabel.textContent = 'Custom HTML / Rich Media / Video Script';
          if (codeHelp) codeHelp.textContent = 'Paste arbitrary responsive HTML, iframe, video embed, or third-party banner markup here.';
          break;
      }
    }

    this.updateAdLivePreview(modalType);
  }

  updateAdLivePreview(modalType) {
    const network = document.getElementById(`super-${modalType}-ad-network`) ? document.getElementById(`super-${modalType}-ad-network`).value : 'custom_banner';
    const previewBox = document.getElementById(`super-${modalType}-ad-preview-box`);
    if (!previewBox) return;

    if (network === 'custom_banner') {
      const imgUrl = (document.getElementById(`super-${modalType}-ad-image-url`) ? document.getElementById(`super-${modalType}-ad-image-url`).value.trim() : '');
      const altText = (document.getElementById(`super-${modalType}-ad-alt-text`) ? document.getElementById(`super-${modalType}-ad-alt-text`).value.trim() : 'Banner Ad');
      const targetUrl = (document.getElementById(`super-${modalType}-ad-target-url`) ? document.getElementById(`super-${modalType}-ad-target-url`).value.trim() : '');
      const isGif = imgUrl.toLowerCase().includes('.gif') || imgUrl.startsWith('data:image/gif');

      if (imgUrl) {
        previewBox.innerHTML = `
          <div style="position: relative; width: 100%; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.05); text-align: center;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span class="ad-sponsored-tag">Sponsored</span>
              ${isGif ? '<span class="badge" style="background: #ec4899; color: #fff; font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">🎞️ ANIMATED GIF</span>' : ''}
            </div>
            <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(altText)}" style="max-height: 140px; width: 100%; object-fit: contain; display: block; border-radius: 6px;" onerror="this.outerHTML='<div style=\\'padding: 1rem; color: #f43f5e;\\'>⚠️ Invalid Image or Format</div>'">
            ${targetUrl ? `<div style="font-size: 0.72rem; color: #60a5fa; margin-top: 6px; word-break: break-all; font-weight: 600;">🔗 Target Link: ${escapeHtml(targetUrl)} (Opens in new tab)</div>` : ''}
          </div>
        `;
      } else {
        previewBox.innerHTML = `<span style="color: var(--text-muted); font-size: 0.8rem;">Upload an image/GIF file or enter link above to see live preview</span>`;
      }
    } else {
      const code = (document.getElementById(`super-${modalType}-ad-code-snippet`) ? document.getElementById(`super-${modalType}-ad-code-snippet`).value.trim() : '');
      if (code) {
        previewBox.innerHTML = `
          <div style="width: 100%; text-align: left;">
            <div style="font-size: 0.72rem; font-weight: 700; color: #10b981; margin-bottom: 4px;">✓ Embed Code Ready (${network.toUpperCase()})</div>
            <pre style="max-height: 90px; overflow-y: auto; background: rgba(0,0,0,0.25); padding: 8px; border-radius: 6px; font-size: 0.72rem; margin: 0; color: #cbd5e1;">${escapeHtml(code)}</pre>
          </div>
        `;
      } else {
        previewBox.innerHTML = `<span style="color: var(--text-muted); font-size: 0.8rem;">Paste ${network} code snippet to preview integration</span>`;
      }
    }
  }

  saveNewAdSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('super-add-ad-title').value.trim();
    const network = document.getElementById('super-add-ad-network').value;
    const placement = document.getElementById('super-add-ad-placement').value;
    const imageUrl = document.getElementById('super-add-ad-image-url').value.trim();
    const targetUrl = document.getElementById('super-add-ad-target-url').value.trim();
    const altText = document.getElementById('super-add-ad-alt-text').value.trim();
    const codeSnippet = document.getElementById('super-add-ad-code-snippet').value.trim();
    const status = document.getElementById('super-add-ad-status').value;

    try {
      storage.addAd({
        title,
        network,
        placement,
        imageUrl,
        targetUrl,
        altText,
        codeSnippet,
        status
      });

      ui.hideModal('modal-super-add-ad');
      ui.showToast(`Campaign "${title}" created successfully!`, 'success');
      this.renderAdsTable();
      this.renderGlobalAdSlots();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  }

  saveEditAdSubmit(e) {
    e.preventDefault();
    if (!this.currentEditingAdId) return;

    const title = document.getElementById('super-edit-ad-title').value.trim();
    const network = document.getElementById('super-edit-ad-network').value;
    const placement = document.getElementById('super-edit-ad-placement').value;
    const imageUrl = document.getElementById('super-edit-ad-image-url').value.trim();
    const targetUrl = document.getElementById('super-edit-ad-target-url').value.trim();
    const altText = document.getElementById('super-edit-ad-alt-text').value.trim();
    const codeSnippet = document.getElementById('super-edit-ad-code-snippet').value.trim();
    const status = document.getElementById('super-edit-ad-status').value;

    try {
      storage.updateAd(this.currentEditingAdId, {
        title,
        network,
        placement,
        imageUrl,
        targetUrl,
        altText,
        codeSnippet,
        status
      });

      ui.hideModal('modal-super-edit-ad');
      ui.showToast(`Campaign "${title}" updated successfully!`, 'success');
      this.renderAdsTable();
      this.renderGlobalAdSlots();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  }

  toggleAdStatus(adId) {
    try {
      const updated = storage.toggleAdStatus(adId);
      ui.showToast(`Campaign is now ${updated.status === 'active' ? 'Active' : 'Paused'}.`, 'info');
      this.renderAdsTable();
      this.renderGlobalAdSlots();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  }

  deleteAdConfirm(adId) {
    const ad = storage.getAdById(adId);
    if (!ad) return;

    if (!confirm(`Are you sure you want to permanently delete advertisement campaign "${ad.title}"?`)) {
      return;
    }

    try {
      storage.deleteAd(adId);
      ui.showToast("Advertisement deleted.", "success");
      this.renderAdsTable();
      this.renderGlobalAdSlots();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  }

  /* ==========================================================================
     GLOBAL AD INJECTION ENGINE (REAL-TIME PORTAL INTEGRATION)
     Renders active ads in configured slots across Login, Student Dashboard,
     Compiler, and Exam views.
     ========================================================================== */
  renderGlobalAdSlots() {
    if (!window.storage || typeof storage.getActiveAdsByPlacement !== 'function') return;

    const slots = [
      { id: 'ad-slot-login-banner', placement: 'login_banner' },
      { id: 'ad-slot-student-dash-top', placement: 'student_dash_top' },
      { id: 'ad-slot-student-dash-sidebar', placement: 'student_dash_sidebar' },
      { id: 'ad-slot-notice-board', placement: 'notice_board_banner' },
      { id: 'ad-slot-exam-result', placement: 'exam_result_banner' },
      { id: 'ad-slot-notes-footer', placement: 'notes_viewer_footer' },
      { id: 'ad-slot-compiler', placement: 'compiler_banner' },
      { id: 'ad-slot-exam-header', placement: 'exam_header' },
      { id: 'ad-slot-logout-banner', placement: 'logout_screen_banner' }
    ];

    slots.forEach(slot => {
      const el = document.getElementById(slot.id);
      if (!el) return;

      const activeAds = storage.getActiveAdsByPlacement(slot.placement);
      if (!activeAds || activeAds.length === 0) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
      }

      // Pick the latest active ad for this slot
      const ad = activeAds[0];
      el.style.display = 'block';

      if (ad.network === 'custom_banner') {
        const linkHref = ad.targetUrl || 'javascript:void(0)';
        const targetAttr = ad.targetUrl ? 'target="_blank" rel="noopener noreferrer"' : '';
        const clickHandler = ad.targetUrl ? `onclick="storage.recordAdClick('${ad.id}')"` : '';

        el.innerHTML = `
          <div class="ad-banner-card" style="position: relative;">
            <span class="ad-sponsored-tag">Sponsored</span>
            <a href="${escapeHtml(linkHref)}" ${targetAttr} ${clickHandler} style="display: block; text-decoration: none;">
              <img src="${escapeHtml(ad.imageUrl)}" alt="${escapeHtml(ad.altText || ad.title)}" class="ad-banner-img" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
              <div class="ad-fallback-banner" style="display: none; background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid rgba(245, 158, 11, 0.4); padding: 1rem 1.25rem; border-radius: 12px; align-items: center; justify-content: space-between; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <span style="font-size: 1.6rem;">🎓</span>
                  <div>
                    <div style="font-weight: 700; color: #f8fafc; font-size: 0.95rem;">${escapeHtml(ad.title)}</div>
                    <div style="font-size: 0.78rem; color: #94a3b8;">${escapeHtml(ad.altText || 'Official Announcement / Sponsored')}</div>
                  </div>
                </div>
                <span class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #f59e0b, #d97706); border: none; font-size: 0.76rem; font-weight: 700; padding: 0.35rem 0.85rem; border-radius: 8px;">Explore &rarr;</span>
              </div>
            </a>
          </div>
        `;
      } else {
        // Embed code for AdSense, Meta, or Rich HTML
        const wrapper = document.createElement('div');
        wrapper.className = 'ad-banner-card ad-embed-container';
        wrapper.innerHTML = `
          <div style="position: relative;">
            <span class="ad-sponsored-tag">Sponsored • ${ad.network.toUpperCase()}</span>
            <div class="ad-embed-body" style="padding: 0.5rem; overflow: hidden;">
              ${ad.codeSnippet}
            </div>
          </div>
        `;
        el.innerHTML = '';
        el.appendChild(wrapper);

        // If AdSense push script required:
        try {
          if (ad.network === 'adsense' && window.adsbygoogle) {
            (adsbygoogle = window.adsbygoogle || []).push({});
          }
        } catch (e) {}
      }
    });
  }
}

// Global Super Admin Instance
const superAdminDashboard = new SuperAdminDashboardController();
window.superAdminDashboard = superAdminDashboard;
window.renderGlobalAdSlots = function() {
  superAdminDashboard.renderGlobalAdSlots();
};
