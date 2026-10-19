// Manage Users screen (Manager portal only): create logins for new staff
// and view/delete existing accounts. This is a record-keeping admin
// feature layered on top of the prototype's existing gate — the portal
// gate still accepts any email/password, so creating an account here does
// not change who can actually sign in; a real build would wire the two
// together and never show a password back on screen the way this demo
// does (there's no real email service to send it through instead).

function renderManageUsersScreen(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Add a User</h2>
      <p class="helper-text">
        Create a login for a new employee or manager. Prototype note: there's no real email service here —
        the generated password is shown below instead of being sent, so you can pass it on yourself.
      </p>
      <div class="field">
        <label>Full name</label>
        <input type="text" id="new-user-name" placeholder="e.g. Jamie Smith" />
      </div>
      <div class="field">
        <label>Email</label>
        <input type="email" id="new-user-email" placeholder="e.g. jamie@company.com" />
      </div>
      <div class="field">
        <label>Role</label>
        <select id="new-user-role">
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
        </select>
      </div>
      <button type="button" class="btn btn-primary btn-block" id="add-user-btn">Create Account</button>
      <div id="new-user-result"></div>
    </div>
    <div class="card">
      <h2>Active Accounts</h2>
      <p class="helper-text" id="user-count-label"></p>
      <div class="product-list" id="user-list"></div>
    </div>
  `;

  document.getElementById('add-user-btn').addEventListener('click', handleAddUser);
  renderUserList();

  function handleAddUser() {
    const nameInput = document.getElementById('new-user-name');
    const emailInput = document.getElementById('new-user-email');
    const roleSelect = document.getElementById('new-user-role');
    const resultEl = document.getElementById('new-user-result');

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const role = roleSelect.value;

    if (!name) {
      showToast('Enter the new user’s full name');
      nameInput.focus();
      return;
    }
    if (!email || !email.includes('@')) {
      showToast('Enter a valid email address');
      emailInput.focus();
      return;
    }

    const { user, error } = Store.addUser({ name, email, role });
    if (error) {
      showToast(error);
      return;
    }

    resultEl.innerHTML = `
      <div class="user-created-card">
        <p class="user-created-title">Account created for ${escapeHtml(user.name)}</p>
        <p class="helper-text">
          ${escapeHtml(user.email)} &middot; ${user.role === 'manager' ? 'Manager' : 'Employee'} portal.
          Simulated email &mdash; share this temporary password with them yourself.
        </p>
        <div class="user-created-password-row">
          <code id="new-user-password">${escapeHtml(user.password)}</code>
          <button type="button" class="btn btn-sm" id="copy-new-user-password-btn">Copy</button>
        </div>
      </div>
    `;

    document.getElementById('copy-new-user-password-btn').addEventListener('click', () => {
      navigator.clipboard
        .writeText(user.password)
        .then(() => showToast('Password copied'))
        .catch(() => showToast('Could not copy — select and copy it manually'));
    });

    nameInput.value = '';
    emailInput.value = '';
    roleSelect.value = 'employee';
    showToast(`Account created for "${user.name}"`);
    renderUserList();
  }

  function formatUserDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function renderUserList() {
    const users = Store.getUsers();
    const listEl = document.getElementById('user-list');
    const countLabel = document.getElementById('user-count-label');

    countLabel.textContent = `${users.length} active account${users.length === 1 ? '' : 's'}.`;

    if (!users.length) {
      listEl.innerHTML = '<div class="empty-state">No user accounts created yet.</div>';
      return;
    }

    listEl.innerHTML = users
      .map(
        (u) => `
      <div class="product-row" id="user-row-${escapeHtml(u.id)}">
        <div class="product-row-main">
          <div class="product-row-name">${escapeHtml(u.name)}</div>
          <div class="product-row-sub">${escapeHtml(u.email)} &middot; Created ${escapeHtml(formatUserDate(u.createdAt))}</div>
          <div class="status-badge ${formatStatusClass(u.role)}">${u.role === 'manager' ? 'Manager' : 'Employee'}</div>
        </div>
        <div class="product-row-actions">
          <button type="button" class="btn btn-sm btn-danger" data-action="delete" data-user-id="${escapeHtml(u.id)}">Delete</button>
        </div>
      </div>
    `
      )
      .join('');

    listEl.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteClick(btn.dataset.userId));
    });
  }

  function handleDeleteClick(userId) {
    const user = Store.getUsers().find((u) => u.id === userId);
    if (!user) return;

    const rowEl = document.getElementById(`user-row-${userId}`);
    rowEl.innerHTML = `
      <div class="confirm-prompt product-row-confirm">
        <p class="confirm-message">Delete &ldquo;${escapeHtml(user.name)}&rdquo;&rsquo;s account? This cannot be undone.</p>
        <div class="confirm-actions">
          <button type="button" class="btn" id="cancel-delete-user">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-delete-user">Yes, delete</button>
        </div>
      </div>
    `;

    document.getElementById('cancel-delete-user').addEventListener('click', renderUserList);
    document.getElementById('confirm-delete-user').addEventListener('click', () => {
      Store.deleteUser(userId);
      showToast(`"${user.name}"'s account deleted`);
      renderUserList();
    });
  }
}
