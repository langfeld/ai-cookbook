/**
 * ============================================
 * useWakeLock – Screen Wake Lock Composable
 * ============================================
 * Hält den Bildschirm wach, solange aktiv.
 *
 * Strategie (mit automatischem Fallback):
 *  1. Native Screen Wake Lock API (Chrome, Safari 16.4+, Edge)
 *  2. Video-Fallback: Unsichtbares Micro-Video in Endlosschleife
 *     (funktioniert in praktisch allen mobilen Browsern inkl. Brave)
 *
 * Wird automatisch re-aktiviert wenn der Tab wieder sichtbar wird.
 * Wird automatisch freigegeben beim Unmount der Komponente.
 */

import { ref, onUnmounted, watch } from 'vue';

// Winziges transparentes WebM-Video (1x1px, ~1KB) als Base64
// Verhindert auf mobilen Browsern das Display-Timeout
const TINY_WEBM = 'data:video/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmQCgq17FAAw9CQE2AQAZ3aGFtbXlXQUAGd2hhbW15RIlACECPQAAAAAAAFlSua0AxrkAu14EBY8WBAZyBACK1nEADdW5khkAFVl9WUDglhohAA1ZQOIOBAeBABrCBCLqBCB9DtnVBMKqBAlPAgQBhBYEBYoUBYGqBAlPAewEAAAAAABJUw2anQoeBAUKEgQEjoxMAAAAAAABRu94BcYABdwEAAAAAABJUw2anQoeBAUKEgQEjoxMAAAAAAABRu94BcYABdwEAAAAAABJUw2anQoaBAaOjEwAAAAAAAFG73gFxgAF3AQAAAAAAAA==';

const nativeSupported = 'wakeLock' in navigator;
// Video-Fallback ist auf praktisch allen mobilen Geräten möglich
const videoSupported = typeof document !== 'undefined' && typeof HTMLVideoElement !== 'undefined';

export function useWakeLock() {
  const isActive = ref(false);
  const isSupported = ref(nativeSupported || videoSupported);
  const method = ref(null); // 'native' | 'video' | null

  let nativeLock = null;
  let videoEl = null;

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
      console.warn('Native Wake Lock fehlgeschlagen:', err.message);
      return false;
    }
  }

  async function releaseNative() {
    if (nativeLock) {
      await nativeLock.release();
      nativeLock = null;
    }
  }

  // ── Video-Fallback ────────────────────────────────

  function requestVideo() {
    try {
      if (!videoEl) {
        videoEl = document.createElement('video');
        videoEl.setAttribute('playsinline', '');
        videoEl.setAttribute('muted', '');
        videoEl.muted = true;
        videoEl.loop = true;
        videoEl.src = TINY_WEBM;
        // Unsichtbar, aber im DOM (manche Browser brauchen das)
        Object.assign(videoEl.style, {
          position: 'fixed',
          top: '-1px',
          left: '-1px',
          width: '1px',
          height: '1px',
          opacity: '0.01',
          pointerEvents: 'none',
          zIndex: '-1',
        });
        document.body.appendChild(videoEl);
      }

      const playPromise = videoEl.play();
      if (playPromise) {
        playPromise.then(() => {
          isActive.value = true;
          method.value = 'video';
        }).catch((err) => {
          console.warn('Video Wake Lock fehlgeschlagen:', err.message);
        });
      }
      return true;
    } catch (err) {
      console.warn('Video Wake Lock fehlgeschlagen:', err.message);
      return false;
    }
  }

  function releaseVideo() {
    if (videoEl) {
      videoEl.pause();
      videoEl.remove();
      videoEl = null;
    }
  }

  // ── Öffentliche API ───────────────────────────────

  async function request() {
    if (!isSupported.value) return false;

    // Erst native versuchen, dann Fallback
    if (nativeSupported) {
      const ok = await requestNative();
      if (ok) return true;
    }

    // Fallback: Video
    if (videoSupported) {
      return requestVideo();
    }

    return false;
  }

  async function release() {
    if (method.value === 'native') {
      await releaseNative();
    } else if (method.value === 'video') {
      releaseVideo();
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
