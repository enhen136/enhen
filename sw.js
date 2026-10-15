/* 河北师范大学数学考研打卡 · Service Worker
   目标：首次联网打开后，之后完全离线可用。 */
const VERSION = "v1.0.0";
const CACHE = "kaoyan-" + VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 逐个添加，单个失败不影响整体安装
    await Promise.all(ASSETS.map(async url => {
      try { await cache.add(new Request(url, { cache: "reload" })); }
      catch (e) { /* 忽略单个资源失败 */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 导航请求：缓存优先（离线可用），后台顺便更新
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match("./index.html");
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put("./index.html", res.clone());
        return res;
      }).catch(() => null);
      return cached || (await network) || new Response("离线且无缓存", { status: 503 });
    })());
    return;
  }

  // 其它资源：缓存优先，回落网络
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    } catch (e) {
      return cached || new Response("", { status: 504 });
    }
  })());
});
