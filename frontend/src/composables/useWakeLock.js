/**
 * ============================================
 * useWakeLock – Screen Wake Lock Composable
 * ============================================
 * Hält den Bildschirm wach, solange aktiv.
 *
 * Strategie (mit automatischem Fallback):
 *  1. Native Screen Wake Lock API (Chrome 84+, Safari 16.4+, Edge 84+, Firefox 126+)
 *  2. Canvas-MediaStream-Fallback: Erzeugt einen Live-Videostream
 *     aus einem Canvas-Element. Browser behandeln aktive MediaStream-
 *     Wiedergabe als echte Mediennutzung und halten den Bildschirm wach.
 *     Funktioniert auch in Brave und anderen Browsern, die die native
 *     Wake Lock API blockieren.
 *
 * Wird automatisch re-aktiviert wenn der Tab wieder sichtbar wird.
 * Wird automatisch freigegeben beim Unmount der Komponente.
 */

import { ref, onUnmounted, watch } from 'vue';

const nativeSupported = 'wakeLock' in navigator;
const canvasStreamSupported =
  typeof document !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' &&
  typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
  typeof HTMLVideoElement !== 'undefined';

export function useWakeLock() {
  const isActive = ref(false);
  const isSupported = ref(nativeSupported || canvasStreamSupported);
  const method = ref(null); // 'native' | 'stream' | null

  let nativeLock = null;
  let streamVideo = null;
  let streamCanvas = null;
  let streamAnimFrame = null;

  // ── Native Wake Lock ──────────────────────────────

  async function requestNative() {
    try {
      nativeLock = await navigator.wakeLock.request('screen');
      isActive.value = true;
      method.value = 'native';

      nativeLock.addEventListener('release', () => {
        isActive.value = false;
        nativeLock = null;
      });

      return true;
    } catch (err) {
      console.warn('[WakeLock] Native fehlgeschlagen:', err.message);
      return false;
    }
  }

  async function releaseNative() {
    if (nativeLock) {
      await nativeLock.release();
      nativeLock = null;
    }
  }

  // ── Canvas-MediaStream-Fallback ───────────────────
  //
  // Erzeugt ein Canvas (2×2px), zeichnet regelmäßig darauf,
  // wandelt es in einen MediaStream und spielt diesen in einem
  // Video-Element ab. Der Browser erkennt aktive Medienwiedergabe
  // und verhindert das Display-Timeout.

  function requestStream() {
    try {
      if (!streamCanvas) {
        streamCanvas = document.createElement('canvas');
        streamCanvas.width = 2;
        streamCanvas.height = 2;
      }

      const ctx = streamCanvas.getContext('2d');

      // Regelmäßig auf das Canvas zeichnen, damit der Stream "lebt"
      let tick = 0;
      function draw() {
        // Abwechselnd Farbe ändern, damit der Stream nicht als statisch erkannt wird
        const c = tick++ % 2 === 0 ? '#000001' : '#000002';
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 2, 2);
        streamAnimFrame = requestAnimationFrame(draw);
      }
      draw();

      const stream = streamCanvas.captureStream(1); // 1 FPS reicht

      if (!streamVideo) {
        streamVideo = document.createElement('video');
        streamVideo.setAttribute('playsinline', '');
        streamVideo.setAttribute('muted', '');
        streamVideo.muted = true;
        // Sichtbar genug für den Browser, aber unsichtbar für den User:
        // Nicht display:none, nicht opacity:0 – sondern unter dem Content
        // mit minimalem Footprint
        Object.assign(streamVideo.style, {
          position: 'fixed',
          bottom: '0',
          left: '0',
          width: '2px',
          height: '2px',
          opacity: '0.01',
          pointerEvents: 'none',
          zIndex: '-9999',
        });
        document.body.appendChild(streamVideo);
      }

      streamVideo.srcObject = stream;

      const playPromise = streamVideo.play();
      if (playPromise) {
        playPromise
          .then(() => {
            isActive.value = true;
            method.value = 'stream';
            console.info('[WakeLock] Canvas-Stream aktiv');
          })
          .catch((err) => {
            console.warn('[WakeLock] Stream-Wiedergabe fehlgeschlagen:', err.message);
            cleanupStream();
          });
      }
      return true;
    } catch (err) {
      console.warn('[WakeLock] Stream-Fallback fehlgeschlagen:', err.message);
      cleanupStream();
      return false;
    }
  }

  function cleanupStream() {
    if (streamAnimFrame) {
      cancelAnimationFrame(streamAnimFrame);
      streamAnimFrame = null;
    }
    if (streamVideo) {
      streamVideo.pause();
      if (streamVideo.srcObject) {
        streamVideo.srcObject.getTracks().forEach((t) => t.stop());
        streamVideo.srcObject = null;
      }
      streamVideo.remove();
      streamVideo = null;
    }
    streamCanvas = null;
  }

  // ── Öffentliche API ───────────────────────────────

  async function request() {
    if (!isSupported.value) return false;

    // Erst native versuchen
    if (nativeSupported) {
      const ok = await requestNative();
      if (ok) return true;
    }

    // Fallback: Canvas-MediaStream
    if (canvasStreamSupported) {
      return requestStream();
    }

    return false;
  }

  async function release() {
    if (method.value === 'native') {
      await releaseNative();
    } else if (method.value === 'stream') {
      cleanupStream();
    }
    isActive.value = false;
    method.value = null;
  }

  async function toggle() {
    if (isActive.value) {
      await release();
    } else {
      await request();
    }
    return isActive.value;
  }

  // Re-acquire wenn Tab wieder sichtbar wird
  let wantActive = false;

  watch(isActive, (val) => {
    wantActive = val;
  });

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && wantActive && !isActive.value) {
      request();
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Cleanup bei Unmount
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    release();
  });

  return {
    isActive,
    isSupported,
    method,
    request,
    release,
    toggle,
  };
}
