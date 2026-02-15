<!--
  ============================================
  Admin: Zutaten-Icons verwalten
  ============================================
  Zeigt alle Keyword→Emoji Mappings in einer Tabelle.
  Ermöglicht Suchen, Hinzufügen, Bearbeiten und Löschen.
  Enthält einen integrierten Emoji-Picker mit Lebensmittel-Emojis.
-->
<template>
  <div class="mx-auto p-4 sm:p-6 lg:p-8 max-w-5xl">
    <!-- Header -->
    <div class="flex sm:flex-row flex-col sm:items-center gap-4 mb-6 sm:mb-8">
      <div class="flex-1">
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl sm:text-3xl">
          Zutaten-Icons
        </h1>
        <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
          Emoji-Zuordnungen für Zutaten verwalten · {{ filteredIcons.length }} Einträge
        </p>
      </div>
      <button
        @click="openAdd"
        class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 px-4 py-2.5 rounded-lg font-medium text-white text-sm transition-colors"
      >
        <PlusCircle class="w-4 h-4" />
        Neues Mapping
      </button>
    </div>

    <!-- Suche -->
    <div class="relative mb-4">
      <Search class="top-1/2 left-3 absolute w-4 h-4 text-stone-400 -translate-y-1/2" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Zutat suchen..."
        class="bg-white dark:bg-stone-900 py-2.5 pr-4 pl-10 border border-stone-200 dark:border-stone-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 w-full text-sm"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full w-8 h-8 animate-spin"></div>
    </div>

    <!-- Tabelle -->
    <div v-else class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700 border-b text-left">
              <th class="px-4 py-3 w-16 font-semibold text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Icon</th>
              <th class="px-4 py-3 font-semibold text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Keyword</th>
              <th class="px-4 py-3 w-28 font-semibold text-stone-500 dark:text-stone-400 text-xs text-right uppercase tracking-wider">Aktionen</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100 dark:divide-stone-800">
            <tr
              v-for="icon in filteredIcons"
              :key="icon.id"
              class="hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors"
            >
              <td class="px-4 py-3 text-2xl text-center">{{ icon.emoji }}</td>
              <td class="px-4 py-3 font-medium text-stone-700 dark:text-stone-300 text-sm">{{ icon.keyword }}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-1">
                  <button
                    @click="openEdit(icon)"
                    class="hover:bg-stone-100 dark:hover:bg-stone-700 p-1.5 rounded-lg text-stone-400 hover:text-primary-600 transition-colors"
                    title="Bearbeiten"
                  >
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button
                    @click="deleteIcon(icon)"
                    class="hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg text-stone-400 hover:text-red-600 transition-colors"
                    title="Löschen"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredIcons.length === 0">
              <td colspan="3" class="px-4 py-12 text-stone-400 text-sm text-center italic">
                {{ searchQuery ? 'Keine Ergebnisse gefunden.' : 'Noch keine Mappings vorhanden.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Hinweis-Box -->
    <div class="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 mt-6 p-4 border border-blue-200 dark:border-blue-800 rounded-xl">
      <Info class="mt-0.5 w-5 h-5 text-blue-500 shrink-0" />
      <div class="text-blue-700 dark:text-blue-300 text-sm">
        <p class="mb-1 font-medium">Wie funktioniert das Matching?</p>
        <ul class="space-y-1 text-blue-600 dark:text-blue-400 text-xs list-disc list-inside">
          <li><strong>Exakt:</strong> Keyword „tomate" → Zutat „Tomate" ✓</li>
          <li><strong>Teilstring:</strong> Keyword „tomate" → Zutat „Kirschtomaten" ✓</li>
          <li><strong>Fallback:</strong> Kein Match → dezenter Punkt wird angezeigt</li>
        </ul>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="z-50 fixed inset-0 flex justify-center items-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal" />
      <div class="relative bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-md animate-slide-up">
        <div class="flex justify-between items-center p-6 border-stone-200 dark:border-stone-800 border-b">
          <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">
            {{ editId ? 'Mapping bearbeiten' : 'Neues Mapping' }}
          </h2>
          <button @click="closeModal" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1 rounded-lg">
            <X class="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div class="space-y-4 p-6">
          <!-- Keyword -->
          <div>
            <label class="block mb-1.5 font-medium text-stone-700 dark:text-stone-300 text-sm">Keyword (Zutat)</label>
            <input
              v-model="formKeyword"
              type="text"
              placeholder="z.B. tomate"
              class="bg-stone-50 dark:bg-stone-800 px-4 py-2.5 border border-stone-200 dark:border-stone-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 w-full text-sm"
            />
          </div>

          <!-- Emoji -->
          <div>
            <label class="block mb-1.5 font-medium text-stone-700 dark:text-stone-300 text-sm">Emoji</label>
            <div class="flex gap-2">
              <input
                v-model="formEmoji"
                type="text"
                placeholder="🍅"
                class="bg-stone-50 dark:bg-stone-800 px-4 py-2.5 border border-stone-200 dark:border-stone-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 w-20 text-2xl text-center"
              />
              <a
                href="https://www.emojis.com/search/emojis/"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 text-xs whitespace-nowrap transition-colors"
                title="Emojis auf emojis.com suchen und hierher kopieren"
              >
                <ExternalLink class="w-3.5 h-3.5" />
                emojis.com
              </a>
            </div>
          </div>

          <!-- Emoji-Picker: Schnellauswahl Lebensmittel -->
          <div>
            <label class="block mb-1.5 font-medium text-stone-700 dark:text-stone-300 text-sm">Schnellauswahl</label>
            <div class="relative mb-2">
              <Search class="top-1/2 left-2.5 absolute w-3.5 h-3.5 text-stone-400 -translate-y-1/2" />
              <input
                v-model="emojiSearch"
                type="text"
                placeholder="Emoji suchen..."
                class="bg-stone-50 dark:bg-stone-800 py-1.5 pr-3 pl-8 border border-stone-200 dark:border-stone-700 rounded-lg outline-none focus:ring-1 focus:ring-primary-400 w-full text-xs"
              />
            </div>
            <div class="gap-1 grid grid-cols-10 bg-stone-50 dark:bg-stone-800 p-2 border border-stone-200 dark:border-stone-700 rounded-xl max-h-36 overflow-y-auto">
              <button
                v-for="e in filteredEmojiPicker"
                :key="e.emoji"
                @click="formEmoji = e.emoji"
                :title="e.label"
                :class="[
                  'p-1 text-xl rounded-lg transition-colors text-center',
                  formEmoji === e.emoji
                    ? 'bg-primary-100 dark:bg-primary-900/50 ring-2 ring-primary-400'
                    : 'hover:bg-stone-200 dark:hover:bg-stone-700'
                ]"
              >
                {{ e.emoji }}
              </button>
              <div v-if="filteredEmojiPicker.length === 0" class="col-span-10 py-2 text-stone-400 text-xs text-center">
                Kein Emoji gefunden
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 p-6 border-stone-200 dark:border-stone-800 border-t">
          <button @click="closeModal" class="hover:bg-stone-100 dark:hover:bg-stone-800 px-4 py-2 rounded-lg text-stone-600 dark:text-stone-400 text-sm">
            Abbrechen
          </button>
          <button
            @click="saveMapping"
            :disabled="!formKeyword.trim() || !formEmoji.trim() || saving"
            class="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors"
          >
            {{ saving ? 'Speichern...' : 'Speichern' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useNotification } from '@/composables/useNotification.js';
import { useIngredientIcons } from '@/composables/useIngredientIcons.js';
import {
  Search, PlusCircle, Pencil, Trash2, X, ExternalLink, Info,
} from 'lucide-vue-next';

const api = useApi();
const { showSuccess, showError } = useNotification();
const { invalidate: invalidateIconCache } = useIngredientIcons();

const icons = ref([]);
const loading = ref(true);
const searchQuery = ref('');
const showModal = ref(false);
const editId = ref(null);
const formKeyword = ref('');
const formEmoji = ref('');
const emojiSearch = ref('');
const saving = ref(false);

// Emoji-Picker Datensatz (Lebensmittel-bezogene Emojis)
const emojiPickerData = [
  // Obst
  { emoji: '🍎', label: 'Apfel', keywords: 'apfel apple rot' },
  { emoji: '🍏', label: 'Grüner Apfel', keywords: 'apfel grün green' },
  { emoji: '🍐', label: 'Birne', keywords: 'birne pear' },
  { emoji: '🍊', label: 'Orange', keywords: 'orange mandarine zitrusfrucht' },
  { emoji: '🍋', label: 'Zitrone', keywords: 'zitrone limette lemon lime' },
  { emoji: '🍌', label: 'Banane', keywords: 'banane banana' },
  { emoji: '🍉', label: 'Wassermelone', keywords: 'wassermelone melone watermelon' },
  { emoji: '🍇', label: 'Traube', keywords: 'traube weintraube grape' },
  { emoji: '🍓', label: 'Erdbeere', keywords: 'erdbeere strawberry' },
  { emoji: '🫐', label: 'Blaubeere', keywords: 'blaubeere heidelbeere blueberry' },
  { emoji: '🍑', label: 'Pfirsich', keywords: 'pfirsich nektarine peach' },
  { emoji: '🍒', label: 'Kirsche', keywords: 'kirsche cherry' },
  { emoji: '🥭', label: 'Mango', keywords: 'mango' },
  { emoji: '🍍', label: 'Ananas', keywords: 'ananas pineapple' },
  { emoji: '🥝', label: 'Kiwi', keywords: 'kiwi' },
  { emoji: '🥥', label: 'Kokosnuss', keywords: 'kokosnuss kokos coconut' },
  // Gemüse
  { emoji: '🍅', label: 'Tomate', keywords: 'tomate tomato' },
  { emoji: '🥕', label: 'Karotte', keywords: 'karotte möhre carrot' },
  { emoji: '🥔', label: 'Kartoffel', keywords: 'kartoffel potato' },
  { emoji: '🧅', label: 'Zwiebel', keywords: 'zwiebel onion' },
  { emoji: '🧄', label: 'Knoblauch', keywords: 'knoblauch garlic' },
  { emoji: '🫑', label: 'Paprika', keywords: 'paprika pepper' },
  { emoji: '🌶️', label: 'Chili', keywords: 'chili scharf hot pepper' },
  { emoji: '🥒', label: 'Gurke', keywords: 'gurke zucchini cucumber' },
  { emoji: '🥬', label: 'Salat', keywords: 'salat spinat mangold blattgemüse lettuce' },
  { emoji: '🥦', label: 'Brokkoli', keywords: 'brokkoli broccoli' },
  { emoji: '🌽', label: 'Mais', keywords: 'mais corn' },
  { emoji: '🍄', label: 'Pilz', keywords: 'pilz champignon mushroom' },
  { emoji: '🍆', label: 'Aubergine', keywords: 'aubergine eggplant' },
  { emoji: '🥑', label: 'Avocado', keywords: 'avocado' },
  { emoji: '🫘', label: 'Bohne', keywords: 'bohne kidney linse hülsenfrucht bean' },
  { emoji: '🫛', label: 'Erbse', keywords: 'erbse pea' },
  { emoji: '🫚', label: 'Ingwer', keywords: 'ingwer ginger' },
  { emoji: '🫒', label: 'Olive', keywords: 'olive olivenöl oil' },
  { emoji: '🎃', label: 'Kürbis', keywords: 'kürbis pumpkin' },
  // Fleisch & Fisch
  { emoji: '🥩', label: 'Fleisch', keywords: 'fleisch steak rind schwein meat' },
  { emoji: '🍗', label: 'Hähnchen', keywords: 'hähnchen huhn hühnchen pute geflügel chicken' },
  { emoji: '🥓', label: 'Speck', keywords: 'speck schinken bacon' },
  { emoji: '🌭', label: 'Wurst', keywords: 'wurst würstchen hotdog' },
  { emoji: '🐟', label: 'Fisch', keywords: 'fisch lachs thunfisch forelle fish salmon' },
  { emoji: '🦐', label: 'Garnele', keywords: 'garnele shrimp scampi' },
  { emoji: '🦪', label: 'Muschel', keywords: 'muschel auster oyster' },
  { emoji: '🦑', label: 'Tintenfisch', keywords: 'tintenfisch calamari squid' },
  // Milch & Eier
  { emoji: '🥚', label: 'Ei', keywords: 'ei eier egg' },
  { emoji: '🧈', label: 'Butter', keywords: 'butter margarine' },
  { emoji: '🧀', label: 'Käse', keywords: 'käse parmesan gouda mozzarella cheese' },
  { emoji: '🥛', label: 'Milch', keywords: 'milch sahne joghurt quark schmand cream milk' },
  // Brot & Getreide
  { emoji: '🍞', label: 'Brot', keywords: 'brot brötchen toast bread' },
  { emoji: '🍚', label: 'Reis', keywords: 'reis rice' },
  { emoji: '🍝', label: 'Nudel', keywords: 'nudel pasta spaghetti' },
  { emoji: '🌾', label: 'Mehl', keywords: 'mehl weizen hafer dinkel flour grain' },
  { emoji: '🥐', label: 'Croissant', keywords: 'croissant gebäck' },
  { emoji: '🥨', label: 'Brezel', keywords: 'brezel pretzel' },
  { emoji: '🥞', label: 'Pfannkuchen', keywords: 'pfannkuchen pancake' },
  { emoji: '🫓', label: 'Fladenbrot', keywords: 'fladenbrot tortilla wrap naan' },
  // Gewürze & Saucen
  { emoji: '🧂', label: 'Salz', keywords: 'salz pfeffer salt pepper' },
  { emoji: '🍯', label: 'Honig', keywords: 'honig honey sirup' },
  { emoji: '🌿', label: 'Kräuter', keywords: 'basilikum petersilie oregano thymian rosmarin dill koriander kräuter herb' },
  { emoji: '🍬', label: 'Zucker', keywords: 'zucker süß sugar' },
  { emoji: '🫙', label: 'Glas', keywords: 'essig eingemacht marmelade jar' },
  { emoji: '🥫', label: 'Dose', keywords: 'dose sojasauce konserve can' },
  // Nüsse & Sonstiges
  { emoji: '🥜', label: 'Nuss', keywords: 'nuss erdnuss walnuss mandel cashew haselnuss pistazie nut peanut' },
  { emoji: '🍫', label: 'Schokolade', keywords: 'schokolade kakao chocolate' },
  { emoji: '🌻', label: 'Sonnenblume', keywords: 'sonnenblumenöl sonnenblumenkerne sunflower' },
  // Getränke
  { emoji: '💧', label: 'Wasser', keywords: 'wasser water' },
  { emoji: '🍷', label: 'Wein', keywords: 'wein rotwein weißwein wine' },
  { emoji: '🍺', label: 'Bier', keywords: 'bier beer' },
  { emoji: '☕', label: 'Kaffee', keywords: 'kaffee coffee' },
  { emoji: '🍵', label: 'Tee', keywords: 'tee tea' },
  { emoji: '🧃', label: 'Saft', keywords: 'saft juice' },
  // Ergänzungen
  { emoji: '🟡', label: 'Gelb', keywords: 'hefe gelatine vanille senf curry' },
  { emoji: '🟤', label: 'Braun', keywords: 'zimt muskat nelke' },
  { emoji: '🟠', label: 'Orange', keywords: 'paprikapulver kurkuma' },
  { emoji: '🔴', label: 'Rot', keywords: 'radieschen cranberry' },
  { emoji: '🟣', label: 'Lila', keywords: 'pflaume rote bete rotkohl' },
  { emoji: '🟨', label: 'Gelbes Quadrat', keywords: 'tofu tempeh' },
  { emoji: '🍽️', label: 'Teller', keywords: 'allgemein sonstige teller plate' },
];

const filteredIcons = computed(() => {
  if (!searchQuery.value) return icons.value;
  const q = searchQuery.value.toLowerCase();
  return icons.value.filter(i => i.keyword.includes(q) || i.emoji.includes(q));
});

const filteredEmojiPicker = computed(() => {
  if (!emojiSearch.value) return emojiPickerData;
  const q = emojiSearch.value.toLowerCase();
  return emojiPickerData.filter(e =>
    e.label.toLowerCase().includes(q) || e.keywords.includes(q)
  );
});

function openAdd() {
  editId.value = null;
  formKeyword.value = '';
  formEmoji.value = '';
  emojiSearch.value = '';
  showModal.value = true;
}

function openEdit(icon) {
  editId.value = icon.id;
  formKeyword.value = icon.keyword;
  formEmoji.value = icon.emoji;
  emojiSearch.value = '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

async function saveMapping() {
  saving.value = true;
  try {
    if (editId.value) {
      await api.put(`/ingredient-icons/${editId.value}`, {
        keyword: formKeyword.value,
        emoji: formEmoji.value,
      });
      showSuccess('Mapping aktualisiert! ✏️');
    } else {
      await api.post('/ingredient-icons', {
        keyword: formKeyword.value,
        emoji: formEmoji.value,
      });
      showSuccess('Mapping erstellt! ✨');
    }
    closeModal();
    invalidateIconCache();
    await fetchIcons();
  } catch {
    // Fehler wird von useApi angezeigt
  } finally {
    saving.value = false;
  }
}

async function deleteIcon(icon) {
  if (!confirm(`Mapping „${icon.keyword}" → ${icon.emoji} wirklich löschen?`)) return;
  try {
    await api.del(`/ingredient-icons/${icon.id}`);
    showSuccess('Mapping gelöscht! 🗑️');
    invalidateIconCache();
    await fetchIcons();
  } catch {
    // Fehler wird von useApi angezeigt
  }
}

async function fetchIcons() {
  loading.value = true;
  try {
    const data = await api.get('/ingredient-icons');
    icons.value = data.icons || [];
  } catch {
    // handled
  } finally {
    loading.value = false;
  }
}

onMounted(fetchIcons);
</script>
