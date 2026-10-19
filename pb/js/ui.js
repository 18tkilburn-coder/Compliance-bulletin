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

// Forces the physical page size for the next print job, via a single
// unnamed @page rule — Chromium's print pipeline doesn't reliably honour
// CSS named pages, only this plain form. Pass e.g. '6in 4in' or 'A4', or
// null to go back to the browser's own default page size. AppRouter clears
// this on every screen change so a forced size never leaks into another
// screen's print button.
function setPrintPageSize(sizeCss) {
  let styleEl = document.getElementById('dynamic-print-page-size');
  if (!sizeCss) {
    if (styleEl) styleEl.textContent = '';
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-page-size';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@page { size: ${sizeCss}; margin: 0; }`;
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
          // A nested control (e.g. an inline "Edit" button) can opt out of
          // selecting the item by marking itself [data-keep-open] — the row
          // still keeps focus (so the list doesn't close), but onSelect is
          // skipped and the control's own click handler runs normally.
          if (e.target.closest('[data-keep-open]')) {
            e.preventDefault();
            return;
          }
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
