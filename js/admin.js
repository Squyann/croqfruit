// Garde des pages d'administration, à charger sur chaque page admin/.
// Redirige vers la connexion si besoin, et refuse l'accès aux comptes non-admin.
//
// Ce n'est qu'un confort d'affichage : la vraie protection est dans les règles RLS
// de la base (un non-admin ne peut ni lire ni écrire les données d'administration).
// Dépend de layout.js, supabase-client.js et auth.js.
//
// Utilisation dans une page : `adminReady.then(() => { … })`.

function showAdminDenied() {
  document.querySelector('main').innerHTML = `
    <div class="wrap">
      <div class="state-message">
        <strong>Accès réservé à l'administration</strong>
        Ce compte n'a pas les droits nécessaires pour voir cette page.<br>
        <a class="btn btn-primary" href="${ROOT}index.html">Retour au site</a>
      </div>
    </div>`;
  document.body.classList.remove('is-checking');
}

const adminReady = new Promise((resolve) => {
  let granted = false;

  Auth.subscribe(async (user) => {
    if (!user) {
      window.location.replace(`${ROOT}connexion.html?redirect=${encodeURIComponent(pageForRedirect('admin/'))}`);
      return;
    }

    const profile = await Auth.getProfile();
    if (profile?.role !== 'admin') {
      showAdminDenied();
      return;
    }

    document.body.classList.remove('is-checking');
    if (!granted) {
      granted = true;
      resolve({ user, profile });
    }
  });
});

// ---------- photos des produits (bucket Supabase Storage "product-images") ----------
const IMAGE_BUCKET = 'product-images';
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`;

// Vérifie un fichier avant envoi ; renvoie un message d'erreur ou '' si tout va bien.
function checkImageFile(file) {
  if (!IMAGE_TYPES[file.type]) return 'Format non accepté : utilisez une image JPG, PNG ou WebP.';
  if (file.size > MAX_IMAGE_BYTES) return 'Image trop lourde : 3 Mo maximum.';
  return '';
}

async function uploadProductImage(file) {
  const path = `${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
  const { error } = await supabaseClient.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw error;
  return supabaseClient.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Supprime la photo associée à une URL du bucket (sans effet pour une autre URL).
async function deleteProductImage(url) {
  if (!url || !url.startsWith(IMAGE_PUBLIC_PREFIX)) return;
  const path = decodeURIComponent(url.slice(IMAGE_PUBLIC_PREFIX.length));
  const { error } = await supabaseClient.storage.from(IMAGE_BUCKET).remove([path]);
  if (error) console.error('Suppression de la photo :', error);
}

// Affiche un message dans l'élément [data-notice] de la page.
function setNotice(message, isError = false) {
  const el = document.querySelector('[data-notice]');
  if (!el) return;
  el.textContent = message;
  el.className = `msg ${isError ? 'msg-error' : 'msg-ok'}`;
  el.hidden = !message;
}
