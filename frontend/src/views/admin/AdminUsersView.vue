<!--
  ============================================
  Admin Benutzerverwaltung
  ============================================
  Benutzer anzeigen, Rollen ändern, Konten sperren/löschen.
-->
<template>
  <div class="mx-auto max-w-7xl">
    <!-- Header -->
    <div class="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
      <div>
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl sm:text-3xl">
          Benutzerverwaltung
        </h1>
        <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
          {{ users.length }} Benutzer registriert
        </p>
      </div>

      <!-- Suche -->
      <div class="relative w-full sm:w-72">
        <Search class="top-1/2 left-3 absolute w-4 h-4 text-stone-400 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Benutzer suchen..."
          class="bg-white dark:bg-stone-800 py-2 pr-4 pl-10 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-full text-stone-800 dark:text-stone-200 placeholder:text-stone-400 text-sm"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full w-8 h-8 animate-spin"></div>
    </div>

    <!-- Benutzer-Liste -->
    <div v-else class="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden">
      <!-- Desktop-Tabelle -->
      <div class="hidden sm:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-stone-50 dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 border-b">
              <th class="px-4 py-3 font-medium text-stone-500 dark:text-stone-400 text-left">Benutzer</th>
              <th class="px-4 py-3 font-medium text-stone-500 dark:text-stone-400 text-left">E-Mail</th>
              <th class="px-4 py-3 font-medium text-stone-500 dark:text-stone-400 text-center">Rolle</th>
              <th class="px-4 py-3 font-medium text-stone-500 dark:text-stone-400 text-center">Rezepte</th>
              <th class="px-4 py-3 font-medium text-stone-500 dark:text-stone-400 text-center">Status</th>
              <th class="px-4 py-3 font-medium text-stone-500 dark:text-stone-400 text-left">Registriert</th>
              <th class="px-4 py-3 font-medium text-stone-500 dark:text-stone-400 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100 dark:divide-stone-700">
            <tr
              v-for="u in filteredUsers"
              :key="u.id"
              class="hover:bg-stone-50 dark:hover:bg-stone-700/30 transition-colors"
            >
              <td class="px-4 py-3">
                <div>
                  <p class="font-medium text-stone-800 dark:text-stone-200">{{ u.display_name || u.username }}</p>
                  <p class="text-stone-400 text-xs">@{{ u.username }}</p>
                </div>
              </td>
              <td class="px-4 py-3 text-stone-600 dark:text-stone-300">{{ u.email }}</td>
              <td class="px-4 py-3 text-center">
                <span
                  :class="[
                    'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                    u.role === 'admin'
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                      : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                  ]"
                >
                  {{ u.role === 'admin' ? 'Admin' : 'Benutzer' }}
                </span>
              </td>
              <td class="px-4 py-3 text-stone-600 dark:text-stone-300 text-center">{{ u.recipe_count }}</td>
              <td class="px-4 py-3 text-center">
                <span
                  :class="[
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    u.is_active
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  ]"
                >
                  <span class="rounded-full w-1.5 h-1.5" :class="u.is_active ? 'bg-green-500' : 'bg-red-500'"></span>
                  {{ u.is_active ? 'Aktiv' : 'Gesperrt' }}
                </span>
              </td>
              <td class="px-4 py-3 text-stone-500 dark:text-stone-400 text-xs">{{ formatDate(u.created_at) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end items-center gap-1">
                  <!-- Rolle ändern -->
                  <button
                    @click="toggleRole(u)"
                    :title="u.role === 'admin' ? 'Zum Benutzer degradieren' : 'Zum Admin befördern'"
                    class="hover:bg-amber-50 dark:hover:bg-amber-900/30 p-1.5 rounded-lg text-stone-400 hover:text-amber-600 transition-colors"
                    :disabled="u.id === currentUserId"
                  >
                    <ShieldCheck v-if="u.role === 'admin'" class="w-4 h-4" />
                    <Shield v-else class="w-4 h-4" />
                  </button>
                  <!-- Sperren/Entsperren -->
                  <button
                    @click="toggleActive(u)"
                    :title="u.is_active ? 'Konto sperren' : 'Konto entsperren'"
                    class="hover:bg-orange-50 dark:hover:bg-orange-900/30 p-1.5 rounded-lg text-stone-400 hover:text-orange-600 transition-colors"
                    :disabled="u.id === currentUserId"
                  >
                    <UserX v-if="u.is_active" class="w-4 h-4" />
                    <UserCheck v-else class="w-4 h-4" />
                  </button>
                  <!-- Passwort zurücksetzen -->
                  <button
                    @click="openPasswordReset(u)"
                    title="Passwort zurücksetzen"
                    class="hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1.5 rounded-lg text-stone-400 hover:text-blue-600 transition-colors"
                  >
                    <KeyRound class="w-4 h-4" />
                  </button>
                  <!-- Löschen -->
                  <button
                    @click="confirmDelete(u)"
                    title="Benutzer löschen"
                    class="hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-lg text-stone-400 hover:text-red-600 transition-colors"
                    :disabled="u.id === currentUserId"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile-Karten -->
      <div class="sm:hidden divide-y divide-stone-100 dark:divide-stone-700">
        <div
          v-for="u in filteredUsers"
          :key="u.id"
          class="space-y-2 p-4"
        >
          <div class="flex justify-between items-center">
            <div>
              <p class="font-medium text-stone-800 dark:text-stone-200">{{ u.display_name || u.username }}</p>
              <p class="text-stone-400 text-xs">@{{ u.username }} · {{ u.email }}</p>
            </div>
            <div class="flex items-center gap-1.5">
              <span
                :class="[
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  u.role === 'admin' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                ]"
              >
                {{ u.role === 'admin' ? 'Admin' : 'User' }}
              </span>
              <span
                :class="[
                  'w-2 h-2 rounded-full',
                  u.is_active ? 'bg-green-500' : 'bg-red-500'
                ]"
              ></span>
            </div>
          </div>
          <div class="flex justify-between items-center text-stone-400 text-xs">
            <span>{{ u.recipe_count }} Rezepte · {{ formatDate(u.created_at) }}</span>
            <div class="flex items-center gap-1">
              <button
                @click="toggleRole(u)"
                class="p-1.5 rounded-lg text-stone-400 hover:text-amber-600"
                :disabled="u.id === currentUserId"
              >
                <ShieldCheck v-if="u.role === 'admin'" class="w-4 h-4" />
                <Shield v-else class="w-4 h-4" />
              </button>
              <button
                @click="toggleActive(u)"
                class="p-1.5 rounded-lg text-stone-400 hover:text-orange-600"
                :disabled="u.id === currentUserId"
              >
                <UserX v-if="u.is_active" class="w-4 h-4" />
                <UserCheck v-else class="w-4 h-4" />
              </button>
              <button
                @click="openPasswordReset(u)"
                class="p-1.5 rounded-lg text-stone-400 hover:text-blue-600"
              >
                <KeyRound class="w-4 h-4" />
              </button>
              <button
                @click="confirmDelete(u)"
                class="p-1.5 rounded-lg text-stone-400 hover:text-red-600"
                :disabled="u.id === currentUserId"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Leerer Zustand -->
      <div v-if="!filteredUsers.length && !loading" class="p-8 text-stone-400 dark:text-stone-500 text-center">
        <Users class="opacity-40 mx-auto mb-2 w-10 h-10" />
        <p>{{ searchQuery ? 'Keine Benutzer gefunden.' : 'Noch keine Benutzer registriert.' }}</p>
      </div>
    </div>

    <!-- Passwort-Reset Modal -->
    <Teleport to="body">
      <transition name="page">
        <div
          v-if="passwordModal.show"
          class="z-50 fixed inset-0 flex justify-center items-center bg-black/50 p-4"
          @click.self="passwordModal.show = false"
        >
          <div class="bg-white dark:bg-stone-800 shadow-xl p-6 border border-stone-200 dark:border-stone-700 rounded-xl w-full max-w-sm">
            <h3 class="mb-4 font-display font-semibold text-stone-800 dark:text-stone-100 text-lg">
              Passwort zurücksetzen
            </h3>
            <p class="mb-4 text-stone-500 dark:text-stone-400 text-sm">
              Neues Passwort für <strong class="text-stone-700 dark:text-stone-200">{{ passwordModal.user?.username }}</strong>
            </p>
            <input
              v-model="passwordModal.newPassword"
              type="password"
              placeholder="Neues Passwort (min. 6 Zeichen)"
              class="bg-white dark:bg-stone-900 mb-4 px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-full text-stone-800 dark:text-stone-200 placeholder:text-stone-400 text-sm"
              @keydown.enter="resetPassword"
            />
            <div class="flex justify-end gap-2">
              <button
                @click="passwordModal.show = false"
                class="hover:bg-stone-50 dark:hover:bg-stone-700 px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-600 dark:text-stone-300 text-sm transition-colors"
              >
                Abbrechen
              </button>
              <button
                @click="resetPassword"
                :disabled="passwordModal.newPassword.length < 6"
                class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-lg text-white text-sm transition-colors disabled:cursor-not-allowed"
              >
                Zurücksetzen
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Bestätigungs-Modal -->
    <Teleport to="body">
      <transition name="page">
        <div
          v-if="confirmModal.show"
          class="z-50 fixed inset-0 flex justify-center items-center bg-black/50 p-4"
          @click.self="confirmModal.show = false"
        >
          <div class="bg-white dark:bg-stone-800 shadow-xl p-6 border border-stone-200 dark:border-stone-700 rounded-xl w-full max-w-sm">
            <h3 class="mb-2 font-display font-semibold text-stone-800 dark:text-stone-100 text-lg">
              {{ confirmModal.title }}
            </h3>
            <p class="mb-6 text-stone-500 dark:text-stone-400 text-sm">
              {{ confirmModal.message }}
            </p>
            <div class="flex justify-end gap-2">
              <button
                @click="confirmModal.show = false"
                class="hover:bg-stone-50 dark:hover:bg-stone-700 px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-600 dark:text-stone-300 text-sm transition-colors"
              >
                Abbrechen
              </button>
              <button
                @click="confirmModal.action?.()"
                :class="[
                  'px-4 py-2 text-sm rounded-lg text-white transition-colors',
                  confirmModal.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'
                ]"
              >
                {{ confirmModal.confirmText || 'Bestätigen' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useAuthStore } from '@/stores/auth.js';
import { useNotification } from '@/composables/useNotification.js';
import {
  Search,
  Users,
  Shield,
  ShieldCheck,
  UserX,
  UserCheck,
  KeyRound,
  Trash2,
} from 'lucide-vue-next';

const api = useApi();
const authStore = useAuthStore();
const { showSuccess } = useNotification();

const loading = ref(true);
const users = ref([]);
const searchQuery = ref('');

const currentUserId = computed(() => authStore.user?.id);

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value;
  const q = searchQuery.value.toLowerCase();
  return users.value.filter(u =>
    u.username.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.display_name || '').toLowerCase().includes(q)
  );
});

// Passwort-Reset Modal
const passwordModal = reactive({
  show: false,
  user: null,
  newPassword: '',
});

// Bestätigungs-Modal
const confirmModal = reactive({
  show: false,
  title: '',
  message: '',
  confirmText: '',
  danger: false,
  action: null,
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function loadUsers() {
  try {
    const data = await api.get('/admin/users');
    users.value = data.users || data;
  } catch {
    // Fehler von useApi gehandelt
  } finally {
    loading.value = false;
  }
}

function toggleRole(user) {
  const newRole = user.role === 'admin' ? 'user' : 'admin';
  const verb = newRole === 'admin' ? 'zum Admin befördern' : 'zum Benutzer degradieren';
  confirmModal.title = 'Rolle ändern';
  confirmModal.message = `Möchtest du "${user.username}" wirklich ${verb}?`;
  confirmModal.confirmText = 'Ja, ändern';
  confirmModal.danger = false;
  confirmModal.show = true;
  confirmModal.action = async () => {
    confirmModal.show = false;
    try {
      await api.put(`/admin/users/${user.id}`, { role: newRole });
      user.role = newRole;
      showSuccess(`Rolle von "${user.username}" geändert.`);
    } catch {
      // Fehler wird von useApi gehandelt
    }
  };
}

function toggleActive(user) {
  const newState = user.is_active ? 0 : 1;
  const verb = newState ? 'entsperren' : 'sperren';
  confirmModal.title = `Konto ${verb}`;
  confirmModal.message = `Möchtest du das Konto von "${user.username}" wirklich ${verb}?`;
  confirmModal.confirmText = newState ? 'Entsperren' : 'Sperren';
  confirmModal.danger = !newState;
  confirmModal.show = true;
  confirmModal.action = async () => {
    confirmModal.show = false;
    try {
      await api.put(`/admin/users/${user.id}`, { is_active: newState });
      user.is_active = newState;
      showSuccess(`Konto von "${user.username}" ${newState ? 'entsperrt' : 'gesperrt'}.`);
    } catch {
      // Fehler wird von useApi gehandelt
    }
  };
}

function openPasswordReset(user) {
  passwordModal.user = user;
  passwordModal.newPassword = '';
  passwordModal.show = true;
}

async function resetPassword() {
  if (passwordModal.newPassword.length < 6) return;
  try {
    await api.post(`/admin/users/${passwordModal.user.id}/reset-password`, {
      new_password: passwordModal.newPassword,
    });
    showSuccess(`Passwort von "${passwordModal.user.username}" wurde zurückgesetzt.`);
    passwordModal.show = false;
  } catch {
    // Fehler wird von useApi gehandelt
  }
}

function confirmDelete(user) {
  confirmModal.title = 'Benutzer löschen';
  confirmModal.message = `Möchtest du "${user.username}" und alle zugehörigen Daten wirklich unwiderruflich löschen?`;
  confirmModal.confirmText = 'Endgültig löschen';
  confirmModal.danger = true;
  confirmModal.show = true;
  confirmModal.action = async () => {
    confirmModal.show = false;
    try {
      await api.del(`/admin/users/${user.id}`);
      users.value = users.value.filter(u => u.id !== user.id);
      showSuccess(`Benutzer "${user.username}" wurde gelöscht.`);
    } catch {
      // Fehler wird von useApi gehandelt
    }
  };
}

onMounted(loadUsers);
</script>
