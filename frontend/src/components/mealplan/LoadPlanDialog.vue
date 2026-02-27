<!--
  ============================================
  LoadPlanDialog – Gespeicherte Wochenpläne laden
  ============================================
  Zeigt die Plan-Historie und ermöglicht:
  - Zur Woche eines Plans navigieren
  - Einen Plan auf die aktuelle Woche kopieren
-->
<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="z-50 fixed inset-0 flex justify-center items-center p-4" @click.self="$emit('close')">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')" />

        <!-- Modal -->
        <div class="z-10 relative bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden">

          <!-- Header -->
          <div class="flex justify-between items-center p-5 border-stone-200 dark:border-stone-700 border-b">
            <div>
              <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">📂 Gespeicherte Pläne</h2>
              <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">Vergangene Wochenpläne laden oder kopieren</p>
            </div>
            <button @click="$emit('close')" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors">
              <X class="w-5 h-5 text-stone-500" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-4 max-h-[65vh] overflow-y-auto">

            <!-- Leer -->
            <div v-if="!plans.length" class="py-10 text-center">
              <div class="mb-2 text-4xl">📋</div>
              <p class="text-stone-500 dark:text-stone-400 text-sm">Noch keine gespeicherten Pläne vorhanden.</p>
            </div>

            <!-- Plan-Liste -->
            <div v-else class="space-y-2">
              <div v-for="plan in plans" :key="plan.id"
                :class="[
                  'group relative p-3.5 rounded-xl border transition-all',
                  plan.week_start === currentWeekStart
                    ? 'bg-primary-50 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800'
                    : 'bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700 hover:border-primary-300 dark:hover:border-primary-700'
                ]">

                <!-- Obere Zeile: Woche + Badges -->
                <div class="flex justify-between items-start gap-2 mb-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-semibold text-stone-800 dark:text-stone-100 text-sm">
                        {{ formatWeek(plan.week_start) }}
                      </span>
                      <span v-if="plan.week_start === currentWeekStart"
                        class="bg-primary-100 dark:bg-primary-900 px-2 py-0.5 rounded-full font-medium text-[10px] text-primary-700 dark:text-primary-300">
                        Aktuell
                      </span>
                      <span v-if="plan.is_locked"
                        class="flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded-full text-[10px] text-amber-700 dark:text-amber-300">
                        <Lock class="w-2.5 h-2.5" /> Fixiert
                      </span>
                    </div>
                    <div class="flex items-center gap-3 mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                      <span class="flex items-center gap-1">
                        <UtensilsCrossed class="w-3 h-3" />
                        {{ plan.meal_count }} {{ plan.meal_count === 1 ? 'Gericht' : 'Gerichte' }}
                      </span>
                      <span class="flex items-center gap-1">
                        <Clock class="w-3 h-3" />
                        {{ formatRelativeDate(plan.created_at) }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Aktionen -->
                <div class="flex items-center gap-2 mt-2">
                  <!-- Zur Woche navigieren -->
                  <button @click="navigateToWeek(plan)"
                    class="flex items-center gap-1.5 bg-white hover:bg-stone-100 dark:bg-stone-900 dark:hover:bg-stone-800 px-3 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 text-xs transition-colors">
                    <Eye class="w-3.5 h-3.5" />
                    <span>Anzeigen</span>
                  </button>

                  <!-- Plan auf aktuelle Woche kopieren (nur wenn nicht bereits aktuelle Woche) -->
                  <button v-if="plan.week_start !== currentWeekStart"
                    @click="startCopy(plan)"
                    :disabled="copying"
                    class="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-3 py-1.5 rounded-lg font-medium text-white text-xs transition-colors">
                    <Loader2 v-if="copying && copyingPlanId === plan.id" class="w-3.5 h-3.5 animate-spin" />
                    <Copy v-else class="w-3.5 h-3.5" />
                    <span>Auf aktuelle Woche kopieren</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Bestätigungs-Dialog -->
    <Transition name="modal">
      <div v-if="confirmDialog.show" class="z-60 fixed inset-0 flex justify-center items-center p-4">
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="confirmDialog.show = false" />
        <div class="z-10 relative bg-white dark:bg-stone-900 shadow-2xl p-6 rounded-2xl w-full max-w-sm">
          <h3 class="mb-2 font-semibold text-stone-800 dark:text-stone-100 text-base">Plan kopieren?</h3>
          <p class="mb-1 text-stone-600 dark:text-stone-400 text-sm">
            Plan von <strong>{{ confirmDialog.sourceLabel }}</strong> auf die aktuelle Woche
            (<strong>{{ confirmDialog.targetLabel }}</strong>) kopieren?
          </p>
          <p v-if="hasExistingPlan" class="mb-4 text-amber-600 dark:text-amber-400 text-xs">
            ⚠️ Der bestehende Plan für diese Woche wird dabei ersetzt.
          </p>
          <p v-else class="mb-4"></p>
          <div class="flex justify-end gap-2">
            <button @click="confirmDialog.show = false"
              class="hover:bg-stone-100 dark:hover:bg-stone-800 px-4 py-2 rounded-lg text-stone-600 dark:text-stone-400 text-sm transition-colors">
              Abbrechen
            </button>
            <button @click="doCopy" :disabled="copying"
              class="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors">
              <Loader2 v-if="copying" class="w-4 h-4 animate-spin" />
              <Copy v-else class="w-4 h-4" />
              Kopieren
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMealPlanStore } from '@/stores/mealplan.js';
import { useNotification } from '@/composables/useNotification.js';
import { X, Eye, Copy, Clock, UtensilsCrossed, Lock, Loader2 } from 'lucide-vue-next';

const props = defineProps({
  show: { type: Boolean, default: false },
  currentWeekStart: { type: String, required: true },
});
const emit = defineEmits(['close', 'navigate-to-week', 'plan-copied']);

const store = useMealPlanStore();
const { showSuccess, showError } = useNotification();

const copying = ref(false);
const copyingPlanId = ref(null);
const confirmDialog = ref({ show: false, plan: null, sourceLabel: '', targetLabel: '' });

const plans = computed(() => store.planHistory || []);

const hasExistingPlan = computed(() => !!store.currentPlan);

function formatWeek(weekStart) {
  if (!weekStart) return '';
  const [y, m, d] = weekStart.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const mon = monday.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const sun = sunday.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // KW-Nummer berechnen (ISO 8601)
  const jan4 = new Date(monday.getFullYear(), 0, 4);
  const dayDiff = (monday - jan4) / 86400000;
  const kw = Math.ceil((dayDiff + jan4.getDay() + 1) / 7);

  return `KW ${kw}: ${mon} – ${sun}`;
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Heute erstellt';
  if (diffDays === 1) return 'Gestern erstellt';
  if (diffDays < 7) return `Vor ${diffDays} Tagen`;
  if (diffDays < 30) return `Vor ${Math.floor(diffDays / 7)} Wochen`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function navigateToWeek(plan) {
  emit('navigate-to-week', plan.week_start);
  emit('close');
}

function startCopy(plan) {
  const sourceLabel = formatWeek(plan.week_start);
  const targetLabel = formatWeek(props.currentWeekStart);
  confirmDialog.value = { show: true, plan, sourceLabel, targetLabel };
}

async function doCopy() {
  const plan = confirmDialog.value.plan;
  if (!plan) return;

  copying.value = true;
  copyingPlanId.value = plan.id;
  confirmDialog.value.show = false;

  try {
    const data = await store.duplicatePlan(plan.id, props.currentWeekStart);
    showSuccess(data.message || 'Plan erfolgreich kopiert! 📋');
    emit('plan-copied');
    emit('close');
  } catch (err) {
    showError(err.message || 'Kopieren fehlgeschlagen');
  } finally {
    copying.value = false;
    copyingPlanId.value = null;
  }
}
</script>
