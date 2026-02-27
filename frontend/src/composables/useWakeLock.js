/**
 * ============================================
 * useWakeLock – Screen Wake Lock API Composable
 * ============================================
 * Hält den Bildschirm wach, solange aktiv.
 * Nutzt die native Screen Wake Lock API (Chrome, Safari 16.4+, Edge).
 *
 * Wird automatisch re-aktiviert wenn der Tab wieder sichtbar wird
 * (Wake Lock wird vom Browser bei Tab-Wechsel freigegeben).
 *
 * Wird automatisch freigegeben beim Unmount der Komponente.
 */

import { ref, onUnmounted, watch } from 'vue';

export function useWakeLock() {
  const isActive = ref(false);
  const isSupported = ref('wakeLock' in navigator);
  let wakeLock = null;

  async function request() {
    if (!isSupported.value) return false;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      isActive.value = true;

      // Wake Lock wird vom Browser freigegeben wenn Tab hidden wird
      wakeLock.addEventListener('release', () => {
        isActive.value = false;
        wakeLock = null;
      });

      return true;
    } catch (err) {
      console.warn('Wake Lock fehlgeschlagen:', err.message);
      isActive.value = false;
      return false;
    }
  }

  async function release() {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
    isActive.value = false;
  }

  async function toggle() {
    if (isActive.value) {
      await release();
    } else {
      await request();
    }
    return isActive.value;
  }

  // Re-acquire wenn Tab wieder sichtbar wird (nur wenn vorher aktiv gewünscht)
  let wantActive = false;

  watch(isActive, (val) => {
    wantActive = val;
  });

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && wantActive && !wakeLock) {
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
    request,
    release,
    toggle,
  };
}
