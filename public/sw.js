// Platinum CBD Cup Service Worker
// Bump this name à chaque changement de politique de cache : l'activation
// purge tous les caches qui ne portent pas ce nom. Passage en v3 : les
// certificats d'analyse (/uploads/lab-analyses) pouvaient jusqu'ici finir
// dans le cache, et un simple renommage est le seul moyen de vider ceux
// qui y sont déjà chez les visiteurs.
const CACHE_NAME = 'platinum-cbd-cup-v3';

/**
 * Espaces authentifiés : leur HTML ne doit JAMAIS entrer dans le cache.
 * Le cache est partagé par tout le profil du navigateur, sans notion de
 * session : une page de tableau de bord mise en cache reste lisible après
 * déconnexion, et sur un poste partagé par l'utilisateur suivant.
 *
 * `/uploads/lab-analyses` est le seul sous-arbre de téléversements que la
 * route /uploads/[...path] réserve aux organisateurs. Elle le sert malgré
 * tout avec `Cache-Control: public, max-age=31536000, immutable` comme
 * n'importe quel fichier : sans cette entrée, le certificat d'analyse d'un
 * producteur restait lisible hors ligne, et après déconnexion, par toute
 * personne utilisant le même navigateur.
 *
 * `/account` n'existe pas encore comme route : il est conservé pour que la
 * page soit déjà couverte le jour où elle est ajoutée.
 */
const PRIVATE_PREFIXES = [
  '/dashboard',
  '/producer',
  '/jury',
  '/account',
  '/uploads/lab-analyses',
];

function isPrivatePath(pathname) {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
}
const STATIC_ASSETS = [
  '/favicon.ico',
  '/offline.html',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Toujours réseau, jamais de cache : API, authentification, et tous les
  // espaces authentifiés.
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/trpc/') ||
    url.pathname.includes('auth') ||
    isPrivatePath(url.pathname)
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // On ne met en cache que les ressources publiques et immuables.
        // Le HTML des pages publiques est volontairement exclu : une page
        // périmée servie hors ligne vaut moins qu'un message hors ligne
        // honnête, et le portail est rendu dynamiquement à chaque requête.
        const isCacheable =
          response.status === 200 &&
          response.type === 'basic' &&
          event.request.mode !== 'navigate' &&
          !response.headers.get('Cache-Control')?.includes('no-store');

        if (isCacheable) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
      },
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.openWindow(url)
  );
});
