importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.2.0/workbox-sw.js');

workbox.routing.registerRoute(
  ({url}) => url.pathname.startsWith('/third_party/aspell6/'),
  new workbox.strategies.StaleWhileRevalidate()
);

workbox.routing.registerRoute(
  () => true,
  new workbox.strategies.NetworkFirst()
);
