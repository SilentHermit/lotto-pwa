const CACHE = "lotto-super-v9"; // 배포할 때마다 v를 올리세요
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./offline.html"
];

// 설치: 캐시 채우기
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

// 업데이트 즉시 적용 버튼(SKIP_WAITING) 처리
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// 활성화: 이전 캐시 제거 + 클라이언트 제어
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// fetch: 캐시 우선 + 네트워크 실패 시 offline.html
self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      try {
        const fresh = await fetch(event.request);
        return fresh;
      } catch (e) {
        const offline = await caches.match("./offline.html");
        return offline || new Response("Offline", { status: 200 });
      }
    })()
  );
});
