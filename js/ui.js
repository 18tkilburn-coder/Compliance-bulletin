// Small shared UI helpers used across screens.

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 2500);
}

function formatStatusClass(status) {
  return 'status-' + status.toLowerCase().replace(/\s+/g, '-');
}

// Wires up a text input + a results list element as a searchable dropdown.
// `renderItems(query)` must return an array of { html, className?, onSelect }.
function wireDropdown(inputEl, listEl, renderItems) {
  function refresh() {
    const items = renderItems(inputEl.value);
    if (!items.length) {
      listEl.innerHTML = '<div class="dropdown-empty">No matches</div>';
    } else {
      listEl.innerHTML = '';
      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'dropdown-item' + (item.className ? ' ' + item.className : '');
        row.innerHTML = item.html;
        // mousedown fires before the input's blur, so the click registers
        // before the list gets hidden.
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          item.onSelect();
        });
        listEl.appendChild(row);
      });
    }
    listEl.hidden = false;
  }

  inputEl.addEventListener('focus', refresh);
  inputEl.addEventListener('input', refresh);
  inputEl.addEventListener('blur', () => {
    setTimeout(() => {
      listEl.hidden = true;
    }, 120);
  });

  return { refresh, close: () => { listEl.hidden = true; } };
}

// Generic modal used for the stock entry detail view.
function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  document.getElementById('modal-content').innerHTML = '';
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
