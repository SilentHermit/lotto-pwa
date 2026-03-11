// 배포할 때마다 버전만 올리세요 (업데이트 트리거가 확실해짐)
const CACHE = "lotto-pwa-nav-v2";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./offline.html",
  "./sw.js"
];

// 1) 설치: 핵심 파일 미리 캐싱
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE_ASSETS);
    // 새 버전이 오면 오래 기다리지 말고 활성화 가능하게
    // (단, 실제 활성화는 message로 제어)
  })());
});

// 2) 메시지: waiting -> active 즉시 전환
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting(); // [Source](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting)
  }
});

// 3) 활성화: 이전 캐시 삭제 + 컨트롤 클레임
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// 4) fetch 전략
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 같은 출처만 캐싱(외부 리소스는 건드리지 않음)
  const isSameOrigin = (url.origin === self.location.origin);

  // (A) "페이지 이동(HTML)"은 network-first로: 업데이트 반영 최우선
  // req.mode === 'navigate' 는 SPA/PWA에서 페이지 로딩 요청에 해당
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        // 온라인이면 최신 HTML을 먼저 받음
        const fresh = await fetch(req);

        // 최신 index.html을 캐시에 갱신 저장
        if (isSameOrigin) {
          const cache = await caches.open(CACHE);
          await cache.put("./index.html", fresh.clone());
        }

        return fresh;
      } catch (e) {
        // 오프라인이면 캐시된 index.html로 대체
        const cached = await caches.match("./index.html", { ignoreSearch: true });
        return cached || (await caches.match("./offline.html")) || new Response("Offline", { status: 200 });
      }
    })());
    return;
  }

  // (B) 정적 리소스는 cache-first(빠르고 오프라인 안정)
  if (!isSameOrigin) return; // 외부는 기본 네트워크로

  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      // 성공한 same-origin 요청은 캐시에 저장(정적 파일 가정)
      const cache = await caches.open(CACHE);
      await cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      // 정적 파일 실패 시 offline로 안내
      return (await caches.match("./offline.html")) || new Response("Offline", { status: 200 });
    }
  })());
});
