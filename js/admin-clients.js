let profiles = [];
const body = document.getElementById('clients-body');
const searchInput = document.getElementById('client-search');

function renderClients() {
  const q = searchInput.value.trim().toLowerCase();
  const rows = profiles.filter((p) => !q || `${p.full_name ?? ''} ${p.email ?? ''}`.toLowerCase().includes(q));

  if (rows.length === 0) {
    body.innerHTML = `<tr><td class="empty" colspan="4">${profiles.length ? 'Aucun client ne correspond à la recherche.' : 'Aucun client pour le moment.'}</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.full_name || '—')}</td>
        <td>${escapeHtml(p.email || '—')}</td>
        <td>${formatDate(p.created_at)}</td>
        <td>${p.role === 'admin' ? '<span class="badge badge-warn">Administrateur</span>' : '<span class="badge">Client</span>'}</td>
      </tr>`
    )
    .join('');
}

searchInput.addEventListener('input', renderClients);

adminReady.then(async () => {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Chargement des clients :', error);
    body.innerHTML = '<tr><td class="empty" colspan="4">Impossible de charger les clients.</td></tr>';
    return;
  }
  profiles = data;
  renderClients();
});
