<!--
  ============================================
  ShoppingView - Einkaufsliste
  ============================================
  Intelligente Einkaufsliste mit:
  - Generierung aus Wochenplan
  - Gruppierung nach Abteilungen
  - Abhaken der Produkte
  - REWE-Integration (Produktsuche/Matching)
  - Einkauf abschließen → Vorratsschrank
-->
<template>
  <div class="space-y-6 animate-fade-in">
    <!-- Header -->
    <div class="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl">🛒 Einkaufsliste</h1>
        <p v-if="shoppingStore.activeList" class="text-stone-500 dark:text-stone-400 text-sm">
          {{ checkedCount }} / {{ totalCount }} erledigt
        </p>
      </div>
      <div class="flex gap-2">
        <button
          @click="generateList"
          :disabled="shoppingStore.loading"
          class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-xl font-medium text-white text-sm transition-colors"
        >
          <ListPlus class="w-4 h-4" />
          Aus Wochenplan erstellen
        </button>
        <button
          v-if="shoppingStore.activeList"
          @click="matchWithRewe"
          :disabled="reweLoading"
          class="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded-xl font-medium text-white text-sm transition-colors"
        >
          🏪 REWE-Zuordnung
        </button>
      </div>
    </div>

    <!-- Fortschrittsbalken -->
    <div v-if="shoppingStore.activeList" class="bg-stone-200 dark:bg-stone-700 rounded-full w-full h-2">
      <div
        class="rounded-full h-2 transition-all duration-500 bg-accent-500"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>

    <!-- Einkaufsliste -->
    <div v-if="shoppingStore.activeList" class="space-y-4">
      <div v-for="(items, category) in groupedItems" :key="category">
        <h3 class="flex items-center gap-2 mb-2 font-semibold text-stone-500 dark:text-stone-400 text-sm">
          {{ categoryIcon(category) }} {{ category || 'Sonstiges' }}
        </h3>
        <div class="space-y-1">
          <div
            v-for="item in items"
            :key="item.id"
            :class="[
              'flex items-center gap-3 p-3 rounded-lg transition-all',
              item.is_checked
                ? 'bg-stone-50 dark:bg-stone-800/50 opacity-60'
                : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800'
            ]"
          >
            <!-- Checkbox -->
            <button
              @click="toggleItem(item)"
              :class="[
                'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                item.is_checked
                  ? 'bg-accent-500 border-accent-500'
                  : 'border-stone-300 dark:border-stone-600 hover:border-accent-400'
              ]"
            >
              <Check v-if="item.is_checked" class="w-3 h-3 text-white" />
            </button>

            <!-- Artikelname -->
            <div class="flex-1 min-w-0">
              <div :class="['text-sm', item.is_checked ? 'line-through text-stone-400' : 'text-stone-800 dark:text-stone-200']">
                {{ item.name }}
              </div>
              <!-- REWE-Produkt -->
              <div v-if="item.rewe_product" class="flex items-center gap-1 mt-0.5 text-red-500 text-xs">
                🏪 {{ item.rewe_product.name }} – {{ formatPrice(item.rewe_product.price) }}
                <span v-if="item.rewe_product.surplus" class="text-stone-400">
                  ({{ item.rewe_product.surplus }} übrig)
                </span>
              </div>
            </div>

            <!-- Menge -->
            <span class="text-stone-500 dark:text-stone-400 text-sm shrink-0">
              {{ item.amount }} {{ item.unit }}
            </span>
          </div>
        </div>
      </div>

      <!-- Einkauf abschließen -->
      <div class="flex sm:flex-row flex-col justify-between items-center gap-3 mt-8 pt-6 border-stone-200 dark:border-stone-800 border-t">
        <div class="text-stone-500 dark:text-stone-400 text-sm">
          <span v-if="estimatedTotal > 0" class="font-medium text-stone-700 dark:text-stone-300">
            Geschätzte Kosten: {{ formatPrice(estimatedTotal) }}
          </span>
        </div>
        <button
          @click="completePurchase"
          :disabled="checkedCount === 0"
          class="flex items-center gap-2 disabled:opacity-50 px-6 py-3 rounded-xl font-medium text-white transition-colors bg-accent-600 hover:bg-accent-700"
        >
          <ShoppingBag class="w-4 h-4" />
          Einkauf abschließen
        </button>
      </div>
    </div>

    <!-- Keine Liste vorhanden -->
    <div v-else-if="!shoppingStore.loading" class="py-16 text-center">
      <div class="mb-4 text-6xl">🛒</div>
      <h2 class="mb-2 font-semibold text-stone-700 dark:text-stone-300 text-xl">Keine aktive Einkaufsliste</h2>
      <p class="mx-auto mb-6 max-w-md text-stone-500 dark:text-stone-400">
        Erstelle eine Einkaufsliste aus deinem Wochenplan. Vorhandene Vorräte werden automatisch berücksichtigt.
      </p>
    </div>

    <!-- Laden -->
    <div v-else class="flex justify-center py-16">
      <div class="border-2 border-primary-200 border-t-primary-600 rounded-full w-8 h-8 animate-spin" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useShoppingStore } from '@/stores/shopping.js';
import { useNotification } from '@/composables/useNotification.js';
import { ListPlus, Check, ShoppingBag } from 'lucide-vue-next';

const shoppingStore = useShoppingStore();
const { showSuccess, showError } = useNotification();
const reweLoading = ref(false);

const totalCount = computed(() => shoppingStore.activeList?.items?.length || 0);
const checkedCount = computed(() => shoppingStore.activeList?.items?.filter(i => i.is_checked).length || 0);
const progressPercent = computed(() => totalCount.value ? (checkedCount.value / totalCount.value * 100) : 0);

const estimatedTotal = computed(() => {
  if (!shoppingStore.activeList?.items) return 0;
  return shoppingStore.activeList.items.reduce((sum, item) => sum + (item.rewe_product?.price || 0), 0);
});

// Artikel nach Kategorie gruppieren
const groupedItems = computed(() => {
  const items = shoppingStore.activeList?.items || [];
  const groups = {};
  for (const item of items) {
    const cat = item.category || 'Sonstiges';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  // Nicht-abgehakte zuerst
  for (const cat of Object.keys(groups)) {
    groups[cat].sort((a, b) => (a.is_checked ? 1 : 0) - (b.is_checked ? 1 : 0));
  }
  return groups;
});

function categoryIcon(cat) {
  const icons = {
    'Obst & Gemüse': '🥬',
    'Milchprodukte': '🧀',
    'Fleisch & Fisch': '🥩',
    'Backwaren': '🍞',
    'Gewürze': '🧂',
    'Getränke': '🥤',
    'Tiefkühl': '🧊',
    'Konserven': '🥫',
    'Sonstiges': '📦',
  };
  return icons[cat] || '📦';
}

function formatPrice(cents) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

async function generateList() {
  try {
    await shoppingStore.generateList();
    showSuccess('Einkaufsliste erstellt! 📝');
  } catch (err) {
    showError(err.message);
  }
}

async function toggleItem(item) {
  await shoppingStore.toggleItem(item.id, !item.is_checked);
}

async function matchWithRewe() {
  reweLoading.value = true;
  try {
    await shoppingStore.matchWithRewe();
    showSuccess('REWE-Produkte zugeordnet! 🏪');
  } catch (err) {
    showError('REWE-Zuordnung fehlgeschlagen: ' + err.message);
  } finally {
    reweLoading.value = false;
  }
}

async function completePurchase() {
  try {
    await shoppingStore.completePurchase();
    showSuccess('Einkauf abgeschlossen! Vorräte aktualisiert. 🎉');
  } catch (err) {
    showError(err.message);
  }
}

onMounted(() => {
  shoppingStore.fetchActiveList();
});
</script>
