<!--
  ============================================
  LoginView - Anmelde- und Registrierungsseite
  ============================================
  Freundliches Design mit Wechsel zwischen Login und Registrierung.
-->
<template>
  <div class="flex justify-center items-center bg-gradient-to-br from-primary-50 dark:from-stone-950 via-white dark:via-stone-900 dark:to-stone-950 p-4 min-h-screen to-accent-50">
    <div class="w-full max-w-md">
      <!-- Logo und Willkommen -->
      <div class="mb-8 text-center">
        <div class="mb-4 text-6xl">🍳</div>
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-3xl">
          AI Cookbook
        </h1>
        <p class="mt-2 text-stone-500 dark:text-stone-400">
          Dein intelligenter Kochassistent
        </p>
      </div>

      <!-- Setup-Banner: Ersteinrichtung -->
      <div
        v-if="needsSetup"
        class="bg-primary-50 dark:bg-primary-950/40 mb-4 p-4 border border-primary-200 dark:border-primary-800 rounded-2xl"
      >
        <div class="flex gap-3">
          <div class="text-2xl shrink-0">🚀</div>
          <div>
            <p class="font-semibold text-primary-800 dark:text-primary-200 text-sm">
              Willkommen zur Ersteinrichtung!
            </p>
            <p class="mt-1 text-primary-700 dark:text-primary-300 text-xs leading-relaxed">
              Registriere dein Konto — es wird automatisch zum <strong>Administrator</strong>.
              Danach kannst du im Admin-Bereich KI-Keys und weitere Einstellungen konfigurieren.
            </p>
          </div>
        </div>
      </div>

      <!-- Formular-Karte -->
      <div class="bg-white dark:bg-stone-900 shadow-xl p-8 border border-stone-200 dark:border-stone-800 rounded-2xl">
        <!-- Tab-Umschalter -->
        <div v-if="showTabs" class="flex bg-stone-100 dark:bg-stone-800 mb-6 p-1 rounded-lg">
          <button
            v-for="tab in availableTabs"
            :key="tab"
            @click="activeTab = tab"
            :class="[
              'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
              activeTab === tab
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300',
            ]"
          >
            {{ tab === 'login' ? 'Anmelden' : 'Registrieren' }}
          </button>
        </div>

        <form @submit.prevent="handleSubmit">
          <!-- Registrierungs-Felder -->
          <template v-if="activeTab === 'register'">
            <div class="mb-4">
              <label class="block mb-1 font-medium text-stone-700 dark:text-stone-300 text-sm">
                Anzeigename
              </label>
              <input
                v-model="form.displayName"
                type="text"
                placeholder="Wie sollen wir dich nennen?"
                class="input-field"
              />
            </div>
            <div class="mb-4">
              <label class="block mb-1 font-medium text-stone-700 dark:text-stone-300 text-sm">
                Benutzername
              </label>
              <input
                v-model="form.username"
                type="text"
                required
                placeholder="dein_username"
                class="input-field"
              />
            </div>
            <div class="mb-4">
              <label class="block mb-1 font-medium text-stone-700 dark:text-stone-300 text-sm">
                E-Mail
              </label>
              <input
                v-model="form.email"
                type="email"
                required
                placeholder="deine@email.de"
                class="input-field"
              />
            </div>
          </template>

          <!-- Login-Felder -->
          <template v-else>
            <div class="mb-4">
              <label class="block mb-1 font-medium text-stone-700 dark:text-stone-300 text-sm">
                Benutzername oder E-Mail
              </label>
              <input
                v-model="form.login"
                type="text"
                required
                placeholder="dein_username oder email"
                class="input-field"
              />
            </div>
          </template>

          <!-- Passwort (immer) -->
          <div class="mb-6">
            <label class="block mb-1 font-medium text-stone-700 dark:text-stone-300 text-sm">
              Passwort
            </label>
            <input
              v-model="form.password"
              type="password"
              required
              :placeholder="activeTab === 'register' ? 'Min. 6 Zeichen' : 'Dein Passwort'"
              class="input-field"
            />
          </div>

          <!-- Fehlermeldung -->
          <div v-if="error" class="bg-red-50 dark:bg-red-950/50 mb-4 p-3 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-red-700 dark:text-red-300 text-sm">{{ error }}</p>
          </div>

          <!-- Submit-Button -->
          <button
            type="submit"
            :disabled="authStore.loading"
            class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-3 rounded-lg w-full font-medium text-white transition-colors disabled:cursor-not-allowed"
          >
            <span v-if="authStore.loading" class="flex justify-center items-center gap-2">
              <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Bitte warten...
            </span>
            <span v-else>
              {{ activeTab === 'login' ? 'Anmelden' : (needsSetup ? 'Admin-Account erstellen' : 'Registrieren') }}
            </span>
          </button>
        </form>
      </div>

      <!-- Theme Toggle -->
      <div class="flex justify-center mt-6">
        <ThemeToggle />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { apiRaw } from '@/composables/useApi.js';
import ThemeToggle from '@/components/layout/ThemeToggle.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const activeTab = ref('login');
const needsSetup = ref(false);
const registrationEnabled = ref(true);
const error = ref('');
const form = reactive({
  login: '',
  username: '',
  email: '',
  password: '',
  displayName: '',
});

// Tabs abhängig vom Status: Setup → nur Register, Registration disabled → nur Login
const availableTabs = computed(() => {
  if (needsSetup.value) return ['register'];
  if (!registrationEnabled.value) return ['login'];
  return ['login', 'register'];
});

// Tabs nur anzeigen, wenn es mehr als einen gibt
const showTabs = computed(() => availableTabs.value.length > 1);

// Setup-Status beim Laden prüfen
onMounted(async () => {
  try {
    const data = await apiRaw('/auth/setup-status');
    needsSetup.value = data.needsSetup;
    registrationEnabled.value = data.registrationEnabled;

    // Bei Ersteinrichtung direkt auf Register wechseln
    if (data.needsSetup) {
      activeTab.value = 'register';
    }
  } catch {
    // Fallback: Beide Tabs anzeigen
  }
});

async function handleSubmit() {
  error.value = '';

  try {
    if (activeTab.value === 'login') {
      await authStore.login(form.login, form.password);
    } else {
      await authStore.register(form.username, form.email, form.password, form.displayName);
    }

    // Nach Login zur gewünschten Seite oder Dashboard
    const redirect = route.query.redirect || '/';
    router.push(redirect);
  } catch (err) {
    error.value = err.message;
  }
}
</script>

<style scoped>
.input-field {
  width: 100%;
  padding-inline: calc(var(--spacing) * 4);
  padding-block: calc(var(--spacing) * 2.5);
  border-radius: var(--radius-lg);
  background-color: var(--color-stone-50);
  border: 1px solid var(--color-stone-200);
  color: var(--color-stone-900);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.input-field::placeholder {
  color: var(--color-stone-400);
}
.input-field:focus {
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 1px var(--color-primary-400);
}
:is(.dark .input-field) {
  background-color: var(--color-stone-800);
  border-color: var(--color-stone-700);
  color: var(--color-stone-100);
}
:is(.dark .input-field)::placeholder {
  color: var(--color-stone-500);
}
:is(.dark .input-field):focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 1px var(--color-primary-500);
}
:is(.dark .input-field) {
  background-color: var(--color-stone-800);
  border-color: var(--color-stone-700);
  color: var(--color-stone-100);
}
:is(.dark .input-field)::placeholder {
  color: var(--color-stone-500);
}
</style>
