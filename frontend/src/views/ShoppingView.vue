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
          @click="toggleRecipeLinks"
          :title="showRecipeLinks ? 'Rezept-Links ausblenden' : 'Rezept-Links einblenden'"
          :class="[
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border',
            showRecipeLinks
              ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
              : 'bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-600 text-stone-500 dark:text-stone-400'
          ]"
        >
          <BookOpen v-if="showRecipeLinks" class="w-4 h-4" />
          <BookX v-else class="w-4 h-4" />
          <span class="hidden sm:inline">{{ showRecipeLinks ? 'Rezepte' : 'Rezepte' }}</span>
        </button>
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

    <!-- Manuell hinzufügen -->
    <form
      v-if="shoppingStore.activeList || !shoppingStore.loading"
      @submit.prevent="addManualItem"
      class="flex flex-wrap items-end gap-2 bg-white dark:bg-stone-900 p-4 border border-stone-200 dark:border-stone-800 rounded-xl"
    >
      <div class="flex-1 min-w-[160px]">
        <label class="block mb-1 font-medium text-stone-500 dark:text-stone-400 text-xs">Artikel</label>
        <input
          v-model="newItem.name"
          type="text"
          placeholder="z.B. Toilettenpapier"
          required
          class="bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-300 focus:border-transparent dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-primary-500 w-full text-stone-800 dark:text-stone-200 placeholder:text-stone-400 text-sm"
        />
      </div>
      <div class="w-20">
        <label class="block mb-1 font-medium text-stone-500 dark:text-stone-400 text-xs">Menge</label>
        <input
          v-model.number="newItem.amount"
          type="number"
          step="any"
          min="0"
          placeholder="1"
          class="bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-300 focus:border-transparent dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-primary-500 w-full text-stone-800 dark:text-stone-200 placeholder:text-stone-400 text-sm"
        />
      </div>
      <div class="w-20">
        <label class="block mb-1 font-medium text-stone-500 dark:text-stone-400 text-xs">Einheit</label>
        <input
          v-model="newItem.unit"
          type="text"
          placeholder="Stk"
          class="bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-300 focus:border-transparent dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-primary-500 w-full text-stone-800 dark:text-stone-200 placeholder:text-stone-400 text-sm"
        />
      </div>
      <button
        type="submit"
        :disabled="!newItem.name.trim()"
        class="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors"
      >
        <Plus class="w-4 h-4" />
        Hinzufügen
      </button>
    </form>

    <!-- Einkaufsliste -->
    <div v-if="shoppingStore.activeList" class="space-y-6">
      <!-- Kategorien als Masonry-Layout auf breiten Screens -->
      <div class="gap-6 space-y-6 lg:columns-2">
        <div
          v-for="(items, category) in groupedItems"
          :key="category"
          class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden break-inside-avoid"
        >
          <!-- Kategorie-Header -->
          <div class="flex justify-between items-center bg-stone-50 dark:bg-stone-800/60 px-4 py-2.5 border-stone-200 dark:border-stone-700 border-b">
            <h3 class="flex items-center gap-2 font-semibold text-stone-600 dark:text-stone-300 text-sm">
              {{ categoryIcon(category) }} {{ category || 'Sonstiges' }}
            </h3>
            <span class="text-stone-400 dark:text-stone-500 text-xs">{{ items.length }} Artikel</span>
          </div>
          <!-- Artikel-Liste -->
          <div class="divide-y divide-stone-100 dark:divide-stone-800">
            <div
              v-for="item in items"
              :key="item.id"
              :class="[
                'flex items-center gap-3 px-4 py-2.5 transition-all hover:bg-stone-50 dark:hover:bg-stone-800/30',
                item.is_checked ? 'opacity-50' : ''
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

              <!-- Artikelname + Rezept-Thumbnails + Vorrats-Hinweis -->
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span :class="['text-sm', item.is_checked ? 'line-through text-stone-400' : 'text-stone-800 dark:text-stone-200']">
                    {{ item.ingredient_name }}
                  </span>
                  <!-- Mini Rezept-Thumbnails -->
                  <div v-if="showRecipeLinks && item.recipes?.length" class="flex -space-x-1.5">
                    <router-link
                      v-for="recipe in item.recipes"
                      :key="recipe.id"
                      :to="`/recipes/${recipe.id}`"
                      :title="recipe.title"
                      class="hover:z-10 relative bg-stone-200 dark:bg-stone-700 border-2 border-white dark:border-stone-900 rounded-full w-5 h-5 overflow-hidden hover:scale-125 transition-transform shrink-0"
                    >
                      <img
                        v-if="recipe.image_url"
                        :src="recipe.image_url"
                        :alt="recipe.title"
                        class="w-full h-full object-cover"
                      />
                      <span v-else class="flex justify-center items-center w-full h-full text-[8px]">🍽️</span>
                    </router-link>
                  </div>
                </div>
                <!-- Vorrats-Hinweis -->
                <div v-if="item.pantry_deducted > 0" class="flex items-center gap-1 mt-0.5 text-emerald-600 dark:text-emerald-400 text-xs">
                  <Package class="w-3 h-3" />
                  {{ item.pantry_deducted }} {{ item.unit }} im Vorrat
                </div>
                <!-- REWE-Produkt -->
                <div v-if="item.rewe_product" class="flex items-center gap-1 mt-0.5 text-red-500 text-xs">
                  🏪 {{ item.rewe_product.name }} – {{ formatPrice(item.rewe_product.price) }}
                </div>
              </div>

              <!-- Menge -->
              <span class="font-medium tabular-nums text-stone-400 dark:text-stone-500 text-xs shrink-0">
                {{ item.amount }} {{ item.unit }}
              </span>
            </div>
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
import { useMealPlanStore } from '@/stores/mealplan.js';
import { useNotification } from '@/composables/useNotification.js';
import { ListPlus, Check, ShoppingBag, Plus, Package, BookOpen, BookX } from 'lucide-vue-next';

const shoppingStore = useShoppingStore();
const mealPlanStore = useMealPlanStore();
const { showSuccess, showError } = useNotification();
const reweLoading = ref(false);

// Manuelles Hinzufügen
const newItem = ref({ name: '', amount: null, unit: '' });

// Rezept-Links ein-/ausblenden (persistent via localStorage)
const showRecipeLinks = ref(localStorage.getItem('shopping_showRecipeLinks') !== 'false');
function toggleRecipeLinks() {
  showRecipeLinks.value = !showRecipeLinks.value;
  localStorage.setItem('shopping_showRecipeLinks', showRecipeLinks.value);
}

const totalCount = computed(() => shoppingStore.activeList?.items?.length || 0);
const checkedCount = computed(() => shoppingStore.activeList?.items?.filter(i => i.is_checked).length || 0);
const progressPercent = computed(() => totalCount.value ? (checkedCount.value / totalCount.value * 100) : 0);

const estimatedTotal = computed(() => {
  if (!shoppingStore.activeList?.items) return 0;
  return shoppingStore.activeList.items.reduce((sum, item) => sum + (item.rewe_product?.price || 0), 0);
});

/** Zutat → Supermarkt-Abteilung zuordnen */
const categoryKeywords = {
  'Obst & Gemüse': [
    'apfel', 'banane', 'birne', 'orange', 'zitrone', 'lime', 'mango', 'avocado', 'tomate',
    'gurke', 'paprika', 'zwiebel', 'knoblauch', 'kartoffel', 'karotte', 'möhre', 'sellerie',
    'lauch', 'porree', 'brokkoli', 'blumenkohl', 'zucchini', 'aubergine', 'spinat', 'salat',
    'rucola', 'petersilie', 'basilikum', 'koriander', 'dill', 'schnittlauch', 'minze',
    'ingwer', 'chili', 'jalapeño', 'frühlingszwiebel', 'schalotte', 'pilz', 'champignon',
    'radieschen', 'kohlrabi', 'fenchel', 'kürbis', 'süßkartoffel', 'mais', 'erbsen',
    'bohnen', 'linsen', 'kichererbsen', 'cocktailtomaten', 'kirschtomate', 'blattpetersilie',
    'rosmarin', 'thymian', 'salbei', 'oregano', 'gemüse', 'obst', 'beere', 'himbeere',
    'erdbeere', 'blaubeere', 'trauben', 'ananas', 'melone', 'kiwi', 'granatapfel',
  ],
  'Milchprodukte': [
    'milch', 'butter', 'sahne', 'schmand', 'joghurt', 'quark', 'käse', 'frischkäse',
    'mozzarella', 'parmesan', 'gouda', 'emmentaler', 'feta', 'halloumi', 'mascarpone',
    'ricotta', 'crème fraîche', 'creme fraiche', 'sauerrahm', 'schlagsahne', 'ei', 'eier',
  ],
  'Fleisch & Fisch': [
    'fleisch', 'hähnchen', 'huhn', 'chicken', 'pute', 'rind', 'schwein', 'hack', 'gehackt',
    'steak', 'schnitzel', 'wurst', 'schinken', 'speck', 'bacon', 'lachs', 'thunfisch',
    'garnele', 'shrimp', 'fisch', 'filet', 'burger', 'bratwurst', 'salami', 'chorizo',
  ],
  'Backwaren': [
    'brot', 'brötchen', 'toast', 'baguette', 'ciabatta', 'croissant', 'tortilla', 'wrap',
    'pizzateig', 'blätterteig', 'hefeteig', 'mehl', 'hefe', 'backpulver', 'burgerbrötchen',
  ],
  'Gewürze & Öle': [
    'salz', 'pfeffer', 'paprika pulver', 'kurkuma', 'kreuzkümmel', 'kümmel', 'zimt',
    'muskat', 'cayenne', 'chili pulver', 'curry', 'gewürz', 'öl', 'olivenöl', 'sonnenblumenöl',
    'sesamöl', 'essig', 'balsamico', 'sojasoße', 'sojasauce', 'worcester', 'senf', 'ketchup',
    'mayonnaise', 'tabasco', 'sriracha', 'honig', 'zucker', 'vanille', 'estragon',
  ],
  'Getränke': [
    'wasser', 'saft', 'limonade', 'bier', 'wein', 'milch', 'tee', 'kaffee', 'cola',
  ],
  'Reis, Pasta & Co.': [
    'reis', 'nudel', 'pasta', 'spaghetti', 'penne', 'fusilli', 'tagliatelle', 'couscous',
    'bulgur', 'quinoa', 'haferflocken', 'müsli', 'cornflakes', 'basmatireis',
  ],
  'Konserven & Saucen': [
    'dose', 'konserve', 'passata', 'tomatenmark', 'kokosmilch', 'kokosnussmilch',
    'brühe', 'fond', 'sauce', 'pesto', 'currysauce', 'tomatensauce', 'sambal',
  ],
};

function guessCategory(ingredientName) {
  const lower = ingredientName.toLowerCase();
  let bestCategory = 'Sonstiges';
  let bestLength = 0;

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const kw of keywords) {
      if (lower.includes(kw) && kw.length > bestLength) {
        bestLength = kw.length;
        bestCategory = category;
      }
    }
  }
  return bestCategory;
}

// Artikel nach Kategorie gruppieren
const groupedItems = computed(() => {
  const items = shoppingStore.activeList?.items || [];
  const groups = {};
  for (const item of items) {
    const cat = guessCategory(item.ingredient_name || '');
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
    'Gewürze & Öle': '🧂',
    'Getränke': '🥤',
    'Reis, Pasta & Co.': '🍚',
    'Konserven & Saucen': '🥫',
    'Sonstiges': '📦',
  };
  return icons[cat] || '📦';
}

function formatPrice(cents) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

async function addManualItem() {
  const name = newItem.value.name.trim();
  if (!name) return;
  try {
    await shoppingStore.addItem({
      ingredient_name: name,
      amount: newItem.value.amount || undefined,
      unit: newItem.value.unit.trim() || undefined,
    });
    newItem.value = { name: '', amount: null, unit: '' };
    showSuccess(`${name} hinzugefügt! ✏️`);
  } catch {
    showError('Artikel konnte nicht hinzugefügt werden.');
  }
}

async function generateList() {
  // Aktuellen Wochenplan laden, falls noch nicht vorhanden
  if (!mealPlanStore.currentPlan) {
    await mealPlanStore.fetchCurrentPlan();
  }
  const planId = mealPlanStore.currentPlan?.id;
  if (!planId) {
    showError('Kein Wochenplan vorhanden. Erstelle zuerst einen Plan im Wochenplaner.');
    return;
  }
  try {
    await shoppingStore.generateList(planId);
    showSuccess('Einkaufsliste erstellt! 📝');
  } catch {
    // Fehler wird von useApi angezeigt
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
  } catch {
    // Fehler wird von useApi angezeigt
  } finally {
    reweLoading.value = false;
  }
}

async function completePurchase() {
  try {
    await shoppingStore.completePurchase();
    showSuccess('Einkauf abgeschlossen! Vorräte aktualisiert. 🎉');
  } catch {
    // Fehler wird von useApi angezeigt
  }
}

onMounted(() => {
  shoppingStore.fetchActiveList();
});
</script>
