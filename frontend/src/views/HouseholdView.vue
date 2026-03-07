<!--
  ============================================
  HouseholdView - Haushaltsverwaltung
  ============================================
  Erstellen, Verwalten, Einladen und Beitreten
  von Haushalten für gemeinsame Nutzung.
-->
<template>
  <div class="mx-auto max-w-7xl">
    <!-- Header -->
    <div class="mb-6 sm:mb-8">
      <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl sm:text-3xl">
        🏠 Haushalt
      </h1>
      <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
        Teile Rezepte, Einkaufslisten und Wochenpläne mit deinem Haushalt
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full w-8 h-8 animate-spin"></div>
    </div>

    <template v-else>
      <!-- Kein Haushalt: Erstellen oder Beitreten -->
      <div v-if="!householdStore.hasHousehold" class="space-y-6">
        <!-- Beitreten -->
        <div class="bg-white dark:bg-stone-800 p-6 border border-stone-200 dark:border-stone-700 rounded-2xl">
          <h2 class="flex items-center gap-2 mb-4 font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
            <UserPlus class="w-5 h-5 text-primary-600" />
            Haushalt beitreten
          </h2>
          <p class="mb-4 text-stone-500 dark:text-stone-400 text-sm">
            Hast du einen Einladungscode erhalten? Gib ihn hier ein:
          </p>
          <div class="flex gap-3">
            <input
              v-model="joinCode"
              type="text"
              placeholder="Einladungscode eingeben"
              maxlength="8"
              class="flex-1 bg-stone-50 dark:bg-stone-900 px-4 py-3 border border-stone-200 dark:border-stone-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
              @keyup.enter="handleJoin"
            />
            <button
              @click="handleJoin"
              :disabled="!joinCode.trim() || joining"
              class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-5 py-3 rounded-xl font-medium text-white text-sm transition-colors"
            >
              {{ joining ? 'Beitritt...' : 'Beitreten' }}
            </button>
          </div>
        </div>

        <!-- Erstellen -->
        <div class="bg-white dark:bg-stone-800 p-6 border border-stone-200 dark:border-stone-700 rounded-2xl">
          <h2 class="flex items-center gap-2 mb-4 font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
            <Plus class="w-5 h-5 text-primary-600" />
            Neuen Haushalt erstellen
          </h2>
          <p class="mb-4 text-stone-500 dark:text-stone-400 text-sm">
            Erstelle einen Haushalt und lade andere Personen ein.
          </p>
          <div class="flex gap-3">
            <input
              v-model="newHouseholdName"
              type="text"
              placeholder="Name des Haushalts (z.B. Familie Müller)"
              maxlength="100"
              class="flex-1 bg-stone-50 dark:bg-stone-900 px-4 py-3 border border-stone-200 dark:border-stone-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
              @keyup.enter="handleCreate"
            />
            <button
              @click="handleCreate"
              :disabled="!newHouseholdName.trim() || creating"
              class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-5 py-3 rounded-xl font-medium text-white text-sm transition-colors"
            >
              {{ creating ? 'Erstelle...' : 'Erstellen' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Haushalt vorhanden -->
      <template v-else>
        <!-- Haushalt-Auswahl (wenn mehrere) -->
        <div v-if="householdStore.households.length > 1" class="flex flex-wrap gap-2 mb-6">
          <button
            v-for="hh in householdStore.households"
            :key="hh.id"
            @click="switchHousehold(hh.id)"
            :class="[
              'px-4 py-2 rounded-xl text-sm font-medium transition-colors border',
              hh.id === householdStore.activeHouseholdId
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-primary-300'
            ]"
          >
            {{ hh.name }}
          </button>
        </div>

        <!-- Aktiver Haushalt Details -->
        <div v-if="details" class="space-y-6">
          <!-- Header Card -->
          <div class="bg-linear-to-r from-primary-50 dark:from-primary-900/20 to-amber-50 dark:to-amber-900/10 p-5 sm:p-6 border border-primary-200 dark:border-primary-800/50 rounded-2xl">
            <div class="flex sm:flex-row flex-col sm:items-center gap-4">
              <div class="flex flex-1 items-center gap-3">
                <div class="flex justify-center items-center bg-primary-100 dark:bg-primary-900/40 rounded-xl w-12 h-12 shrink-0">
                  <Home class="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
                    {{ details.name }}
                  </h2>
                  <p class="text-stone-500 dark:text-stone-400 text-sm">
                    {{ details.members?.length || 0 }} Mitglied{{ (details.members?.length || 0) !== 1 ? 'er' : '' }}
                    · Erstellt {{ formatDate(details.created_at) }}
                  </p>
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  @click="showInviteModal = true"
                  class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 px-4 py-2.5 rounded-xl font-medium text-white text-sm transition-colors"
                >
                  <UserPlus class="w-4 h-4" />
                  Einladen
                </button>
                <button
                  @click="showSettingsModal = true"
                  class="flex items-center gap-2 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 px-4 py-2.5 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-600 dark:text-stone-300 text-sm transition-colors"
                >
                  <Settings class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Mitglieder -->
          <div class="bg-white dark:bg-stone-800 p-5 border border-stone-200 dark:border-stone-700 rounded-2xl">
            <h3 class="flex items-center gap-2 mb-4 font-display font-semibold text-stone-800 dark:text-stone-100">
              <Users class="w-5 h-5 text-primary-600" />
              Mitglieder
            </h3>
            <div class="space-y-3">
              <div
                v-for="member in details.members"
                :key="member.user_id"
                class="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors"
              >
                <div class="flex justify-center items-center bg-primary-100 dark:bg-primary-900/40 rounded-full w-10 h-10 shrink-0">
                  <span class="font-semibold text-primary-600 dark:text-primary-400 text-sm">
                    {{ (member.username || '?').charAt(0).toUpperCase() }}
                  </span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-stone-800 dark:text-stone-100 text-sm truncate">
                      {{ member.display_name || member.username }}
                    </span>
                    <span v-if="member.role === 'creator'" class="bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full text-amber-700 dark:text-amber-400 text-xs">
                      Ersteller
                    </span>
                  </div>
                  <span class="text-stone-400 dark:text-stone-500 text-xs">
                    Beigetreten {{ formatDate(member.joined_at) }}
                  </span>
                </div>
                <!-- Entfernen-Button nur für Creator und nicht sich selbst -->
                <button
                  v-if="isCreator && member.user_id !== currentUserId"
                  @click="confirmRemoveMember(member)"
                  class="p-2 rounded-lg text-stone-400 hover:text-red-500 transition-colors"
                  title="Mitglied entfernen"
                >
                  <UserMinus class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Aktivitäts-Feed -->
          <div class="bg-white dark:bg-stone-800 p-5 border border-stone-200 dark:border-stone-700 rounded-2xl">
            <h3 class="flex items-center gap-2 mb-4 font-display font-semibold text-stone-800 dark:text-stone-100">
              <Activity class="w-5 h-5 text-primary-600" />
              Letzte Aktivitäten
            </h3>
            <div v-if="activities.length === 0" class="py-4 text-center text-stone-400 dark:text-stone-500 text-sm">
              Noch keine Aktivitäten
            </div>
            <div v-else class="space-y-2 max-h-64 overflow-y-auto">
              <div
                v-for="act in activities"
                :key="act.id"
                class="flex items-start gap-3 p-2 text-sm"
              >
                <div class="bg-stone-100 dark:bg-stone-700 mt-0.5 rounded-full w-2 h-2 shrink-0"></div>
                <div>
                  <span class="text-stone-700 dark:text-stone-300">{{ act.action }}</span>
                  <span class="ml-2 text-stone-400 dark:text-stone-500 text-xs">
                    {{ formatDate(act.created_at) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Datenmigration -->
          <div class="bg-white dark:bg-stone-800 p-5 border border-stone-200 dark:border-stone-700 rounded-2xl">
            <h3 class="flex items-center gap-2 mb-4 font-display font-semibold text-stone-800 dark:text-stone-100">
              <FolderSync class="w-5 h-5 text-primary-600" />
              Daten migrieren
            </h3>
            <p class="mb-4 text-stone-500 dark:text-stone-400 text-sm">
              Verschiebe deine persönlichen Daten in den gemeinsamen Haushalt.
            </p>
            <button
              @click="handleMigrate"
              :disabled="migrating"
              class="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 px-4 py-2.5 rounded-xl font-medium text-white text-sm transition-colors"
            >
              <FolderSync class="w-4 h-4" />
              {{ migrating ? 'Migriere...' : 'Alle Daten migrieren' }}
            </button>
          </div>
        </div>

        <!-- Noch Beitreten (unterhalb, wenn schon in Haushalt) -->
        <div class="bg-white dark:bg-stone-800 mt-6 p-5 border border-stone-200 dark:border-stone-700 rounded-2xl">
          <h3 class="flex items-center gap-2 mb-3 font-semibold text-stone-800 dark:text-stone-100 text-sm">
            <UserPlus class="w-4 h-4 text-primary-600" />
            Weiterem Haushalt beitreten
          </h3>
          <div class="flex gap-3">
            <input
              v-model="joinCode"
              type="text"
              placeholder="Einladungscode"
              maxlength="8"
              class="flex-1 bg-stone-50 dark:bg-stone-900 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500"
              @keyup.enter="handleJoin"
            />
            <button
              @click="handleJoin"
              :disabled="!joinCode.trim() || joining"
              class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors"
            >
              Beitreten
            </button>
          </div>
        </div>
      </template>
    </template>

    <!-- Einladungs-Modal -->
    <Teleport to="body">
      <div v-if="showInviteModal" class="z-50 fixed inset-0 flex justify-center items-center bg-black/50 p-4" @click.self="showInviteModal = false">
        <div class="bg-white dark:bg-stone-800 p-6 rounded-2xl w-full max-w-md">
          <h3 class="mb-4 font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
            Einladungscode
          </h3>

          <div v-if="inviteCode" class="space-y-4">
            <div class="bg-stone-50 dark:bg-stone-900 p-4 rounded-xl text-center">
              <p class="font-mono font-bold text-2xl text-primary-600 tracking-wider select-all">
                {{ inviteCode }}
              </p>
              <p class="mt-2 text-stone-400 text-xs">
                Gültig für {{ inviteExpiry }}
              </p>
            </div>
            <button
              @click="copyInviteCode"
              class="bg-primary-600 hover:bg-primary-700 px-4 py-2.5 rounded-xl w-full font-medium text-white text-sm transition-colors"
            >
              {{ copied ? '✓ Kopiert!' : 'Code kopieren' }}
            </button>
          </div>

          <div v-else>
            <p class="mb-4 text-stone-500 dark:text-stone-400 text-sm">
              Erstelle einen Einladungscode, den andere eingeben können um beizutreten.
            </p>
            <button
              @click="generateInvite"
              :disabled="generatingInvite"
              class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2.5 rounded-xl w-full font-medium text-white text-sm transition-colors"
            >
              {{ generatingInvite ? 'Erstelle...' : 'Code generieren' }}
            </button>
          </div>

          <button
            @click="showInviteModal = false; inviteCode = null"
            class="mt-3 p-2 rounded-lg w-full text-stone-500 text-sm hover:text-stone-700 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Einstellungen-Modal -->
    <Teleport to="body">
      <div v-if="showSettingsModal" class="z-50 fixed inset-0 flex justify-center items-center bg-black/50 p-4" @click.self="showSettingsModal = false">
        <div class="bg-white dark:bg-stone-800 p-6 rounded-2xl w-full max-w-md">
          <h3 class="mb-4 font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
            Haushalt-Einstellungen
          </h3>

          <div class="space-y-4">
            <!-- Umbenennen -->
            <div>
              <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">Name</label>
              <input
                v-model="editName"
                type="text"
                maxlength="100"
                class="bg-stone-50 dark:bg-stone-900 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg w-full text-sm outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <button
              @click="handleRename"
              :disabled="!editName.trim() || editName === details?.name"
              class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2.5 rounded-xl w-full font-medium text-white text-sm transition-colors"
            >
              Umbenennen
            </button>

            <hr class="border-stone-200 dark:border-stone-700" />

            <!-- Gefährliche Aktionen -->
            <div class="space-y-3">
              <button
                @click="handleLeave"
                class="flex justify-center items-center gap-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 px-4 py-2.5 rounded-xl w-full text-red-600 dark:text-red-400 text-sm transition-colors"
              >
                <LogOut class="w-4 h-4" />
                Haushalt verlassen
              </button>

              <button
                v-if="isCreator"
                @click="handleDelete"
                class="flex justify-center items-center gap-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 px-4 py-2.5 rounded-xl w-full text-red-600 dark:text-red-400 text-sm transition-colors"
              >
                <Trash2 class="w-4 h-4" />
                Haushalt auflösen
              </button>
            </div>
          </div>

          <button
            @click="showSettingsModal = false"
            class="mt-3 p-2 rounded-lg w-full text-stone-500 text-sm hover:text-stone-700 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-if="confirmAction"
      :title="confirmAction.title"
      :message="confirmAction.message"
      :confirmLabel="confirmAction.confirmLabel"
      :danger="confirmAction.danger"
      @confirm="confirmAction.onConfirm(); confirmAction = null"
      @cancel="confirmAction = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useHouseholdStore } from '@/stores/household.js';
import { useAuthStore } from '@/stores/auth.js';
import { useNotification } from '@/composables/useNotification.js';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import { Home, Users, UserPlus, UserMinus, Plus, Settings, LogOut, Trash2, Activity, FolderSync } from 'lucide-vue-next';

const householdStore = useHouseholdStore();
const authStore = useAuthStore();
const { showSuccess, showError } = useNotification();

const loading = ref(true);
const details = ref(null);
const activities = ref([]);
const joinCode = ref('');
const joining = ref(false);
const newHouseholdName = ref('');
const creating = ref(false);
const migrating = ref(false);
const showInviteModal = ref(false);
const showSettingsModal = ref(false);
const inviteCode = ref(null);
const inviteExpiry = ref('');
const generatingInvite = ref(false);
const copied = ref(false);
const editName = ref('');
const confirmAction = ref(null);

const currentUserId = computed(() => authStore.user?.id);
const isCreator = computed(() => details.value?.created_by === currentUserId.value);

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function loadDetails() {
  if (!householdStore.activeHouseholdId) {
    details.value = null;
    activities.value = [];
    return;
  }
  try {
    details.value = await householdStore.fetchHouseholdDetails(householdStore.activeHouseholdId);
    editName.value = details.value.name;
    const acts = await householdStore.fetchActivity(householdStore.activeHouseholdId);
    activities.value = acts || [];
  } catch {
    // Fehler wird vom Store gehandelt
  }
}

async function handleCreate() {
  if (!newHouseholdName.value.trim()) return;
  creating.value = true;
  try {
    await householdStore.createHousehold(newHouseholdName.value.trim());
    newHouseholdName.value = '';
    showSuccess('Haushalt erstellt!');
    await loadDetails();
  } catch (err) {
    showError(err.message);
  } finally {
    creating.value = false;
  }
}

async function handleJoin() {
  if (!joinCode.value.trim()) return;
  joining.value = true;
  try {
    await householdStore.joinHousehold(joinCode.value.trim());
    joinCode.value = '';
    showSuccess('Haushalt beigetreten!');
    await loadDetails();
  } catch (err) {
    showError(err.message);
  } finally {
    joining.value = false;
  }
}

function switchHousehold(id) {
  householdStore.setActiveHousehold(id);
  loadDetails();
}

async function generateInvite() {
  generatingInvite.value = true;
  try {
    const result = await householdStore.createInvite(householdStore.activeHouseholdId);
    inviteCode.value = result.code;
    inviteExpiry.value = result.expires_at
      ? `${Math.round((new Date(result.expires_at) - new Date()) / 3600000)} Stunden`
      : 'unbegrenzt';
  } catch (err) {
    showError(err.message);
  } finally {
    generatingInvite.value = false;
  }
}

async function copyInviteCode() {
  if (!inviteCode.value) return;
  try {
    await navigator.clipboard.writeText(inviteCode.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    showError('Kopieren fehlgeschlagen');
  }
}

async function handleRename() {
  if (!editName.value.trim() || editName.value === details.value?.name) return;
  try {
    await householdStore.renameHousehold(householdStore.activeHouseholdId, editName.value.trim());
    showSuccess('Haushalt umbenannt');
    showSettingsModal.value = false;
    await householdStore.fetchHouseholds();
    await loadDetails();
  } catch (err) {
    showError(err.message);
  }
}

async function handleMigrate() {
  confirmAction.value = {
    title: 'Daten migrieren',
    message: 'Alle deine persönlichen Rezepte, Wochenpläne, Einkaufslisten und Vorräte werden in den gemeinsamen Haushalt verschoben. Diese Aktion kann nicht rückgängig gemacht werden.',
    confirmLabel: 'Migrieren',
    danger: false,
    onConfirm: async () => {
      migrating.value = true;
      try {
        const result = await householdStore.migrateData(householdStore.activeHouseholdId);
        showSuccess(result.message || 'Daten erfolgreich migriert!');
      } catch (err) {
        showError(err.message);
      } finally {
        migrating.value = false;
      }
    },
  };
}

function confirmRemoveMember(member) {
  confirmAction.value = {
    title: 'Mitglied entfernen',
    message: `Möchtest du "${member.display_name || member.username}" wirklich aus dem Haushalt entfernen?`,
    confirmLabel: 'Entfernen',
    danger: true,
    onConfirm: async () => {
      try {
        await householdStore.removeMember(householdStore.activeHouseholdId, member.user_id);
        showSuccess('Mitglied entfernt');
        await loadDetails();
      } catch (err) {
        showError(err.message);
      }
    },
  };
}

async function handleLeave() {
  confirmAction.value = {
    title: 'Haushalt verlassen',
    message: 'Möchtest du diesen Haushalt wirklich verlassen? Deine geteilten Daten bleiben im Haushalt erhalten.',
    confirmLabel: 'Verlassen',
    danger: true,
    onConfirm: async () => {
      try {
        await householdStore.leaveHousehold(householdStore.activeHouseholdId);
        showSuccess('Haushalt verlassen');
        showSettingsModal.value = false;
        details.value = null;
      } catch (err) {
        showError(err.message);
      }
    },
  };
}

async function handleDelete() {
  confirmAction.value = {
    title: 'Haushalt auflösen',
    message: 'Möchtest du diesen Haushalt wirklich auflösen? Alle geteilten Daten werden den einzelnen Benutzern zurückgegeben.',
    confirmLabel: 'Auflösen',
    danger: true,
    onConfirm: async () => {
      try {
        await householdStore.deleteHousehold(householdStore.activeHouseholdId);
        showSuccess('Haushalt aufgelöst');
        showSettingsModal.value = false;
        details.value = null;
      } catch (err) {
        showError(err.message);
      }
    },
  };
}

// Beim Laden der View alle Infos holen
onMounted(async () => {
  await householdStore.fetchHouseholds();
  await loadDetails();
  loading.value = false;
});

// Bei Haushaltswechsel Details aktualisieren
watch(() => householdStore.activeHouseholdId, () => {
  if (householdStore.activeHouseholdId) {
    loadDetails();
  }
});
</script>
