self.addEventListener('install', (event) => {
    // The service worker is installed
    self.skipWaiting();
  });
  
  self.addEventListener('activate', (event) => {
    // The service worker is activated
  });
  
  self.addEventListener('fetch', (event) => {
    // The service worker will fetch resources
    event.respondWith(fetch(event.request));
  });
  