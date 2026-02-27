<!--
  ============================================
  Admin: Zutaten-Icons verwalten
  ============================================
  Zeigt alle Keyword→Emoji Mappings in einer Tabelle.
  Ermöglicht Suchen, Hinzufügen, Bearbeiten und Löschen.
  Enthält einen integrierten Emoji-Picker mit Lebensmittel-Emojis.
-->
<template>
  <div class="mx-auto max-w-7xl">
    <!-- Header -->
    <div class="flex sm:flex-row flex-col sm:items-center gap-4 mb-6 sm:mb-8">
      <div class="flex-1">
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl sm:text-3xl">
          Zutaten-Icons
        </h1>
        <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
          Emoji-Zuordnungen für Zutaten verwalten · {{ icons.length }} Mappings · {{ allIngredients.length }} Zutaten
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
        :placeholder="activeTab === 'mappings' ? 'Mapping suchen...' : activeTab === 'used' ? 'Verwendete Zutat suchen...' : 'Zutat ohne Icon suchen...'"
        class="bg-white dark:bg-stone-900 py-2.5 pr-4 pl-10 border border-stone-200 dark:border-stone-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-400 w-full text-sm"
      />
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-stone-100 dark:bg-stone-800 mb-4 p-1 rounded-xl">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id; searchQuery = ''"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center',
          activeTab === tab.id
            ? 'bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 shadow-sm'
            : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
        ]"
      >
        <component :is="tab.icon" class="w-4 h-4" />
        <span class="hidden sm:inline">{{ tab.label }}</span>
        <span
          v-if="tab.count !== null"
          :class="[
            'px-1.5 py-0.5 rounded-full text-xs font-semibold',
            activeTab === tab.id
              ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
              : 'bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400'
          ]"
        >
          {{ tab.count }}
        </span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full w-8 h-8 animate-spin"></div>
    </div>

    <!-- ====== TAB: Alle Mappings ====== -->
    <template v-else-if="activeTab === 'mappings'">
      <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
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
    </template>

    <!-- ====== TAB: Verwendete Icons ====== -->
    <template v-else-if="activeTab === 'used'">
      <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700 border-b text-left">
                <th class="px-4 py-3 w-16 font-semibold text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Icon</th>
                <th class="px-4 py-3 font-semibold text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Zutat</th>
                <th class="px-4 py-3 font-semibold text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Gematchtes Keyword</th>
                <th class="px-4 py-3 w-24 font-semibold text-stone-500 dark:text-stone-400 text-xs text-right uppercase tracking-wider">Rezepte</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100 dark:divide-stone-800">
              <tr
                v-for="item in filteredUsedIngredients"
                :key="item.name"
                class="hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors"
              >
                <td class="px-4 py-3 text-2xl text-center">{{ item.emoji }}</td>
                <td class="px-4 py-3 font-medium text-stone-700 dark:text-stone-300 text-sm">{{ item.name }}</td>
                <td class="px-4 py-3 text-stone-400 text-xs">
                  <span class="bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded">{{ item.matchedKeyword }}</span>
                </td>
                <td class="px-4 py-3 font-medium text-stone-500 text-sm text-right">{{ item.count }}×</td>
              </tr>
              <tr v-if="filteredUsedIngredients.length === 0">
                <td colspan="4" class="px-4 py-12 text-stone-400 text-sm text-center italic">
                  {{ searchQuery ? 'Keine Ergebnisse gefunden.' : 'Keine verwendeten Zutaten mit Icon-Match.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ====== TAB: Ohne Zuordnung ====== -->
    <template v-else-if="activeTab === 'unmatched'">
      <div v-if="filteredUnmatchedIngredients.length > 0" class="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 mb-4 p-4 border border-amber-200 dark:border-amber-800 rounded-xl">
        <AlertTriangle class="mt-0.5 w-5 h-5 text-amber-500 shrink-0" />
        <p class="text-amber-700 dark:text-amber-300 text-sm">
          Diese Zutaten aus deinen Rezepten haben kein passendes Emoji-Mapping.
          Klicke auf <strong>+</strong>, um direkt ein Mapping zu erstellen.
        </p>
      </div>
      <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700 border-b text-left">
                <th class="px-4 py-3 w-16 font-semibold text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Icon</th>
                <th class="px-4 py-3 font-semibold text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Zutat</th>
                <th class="px-4 py-3 w-24 font-semibold text-stone-500 dark:text-stone-400 text-xs text-right uppercase tracking-wider">Rezepte</th>
                <th class="px-4 py-3 w-20 font-semibold text-stone-500 dark:text-stone-400 text-xs text-right uppercase tracking-wider">Aktion</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100 dark:divide-stone-800">
              <tr
                v-for="item in filteredUnmatchedIngredients"
                :key="item.name"
                class="hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors"
              >
                <td class="px-4 py-3 text-stone-300 dark:text-stone-600 text-lg text-center">•</td>
                <td class="px-4 py-3 font-medium text-stone-700 dark:text-stone-300 text-sm">{{ item.name }}</td>
                <td class="px-4 py-3 font-medium text-stone-500 text-sm text-right">{{ item.count }}×</td>
                <td class="px-4 py-3 text-right">
                  <button
                    @click="openAddForIngredient(item.name)"
                    class="flex justify-center items-center hover:bg-primary-50 dark:hover:bg-primary-900/30 ml-auto rounded-lg w-8 h-8 text-stone-400 hover:text-primary-600 transition-colors"
                    title="Mapping erstellen"
                  >
                    <PlusCircle class="w-4 h-4" />
                  </button>
                </td>
              </tr>
              <tr v-if="filteredUnmatchedIngredients.length === 0">
                <td colspan="4" class="px-4 py-12 text-stone-400 text-sm text-center italic">
                  <template v-if="searchQuery">Keine Ergebnisse gefunden.</template>
                  <template v-else>
                    <span class="text-green-500">✓</span> Alle Zutaten haben ein Icon-Mapping! 🎉
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

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

  <!-- Bestätigungs-Dialog für Mapping löschen -->
  <ConfirmDialog
    v-model="showDeleteConfirm"
    variant="danger"
    :title="`Mapping löschen?`"
    :message="`Mapping \u201E${deleteTarget?.keyword}\u201C \u2192 ${deleteTarget?.emoji} wirklich löschen?`"
    confirm-text="Löschen"
    cancel-text="Abbrechen"
    @confirm="executeDeleteIcon"
  />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@/composables/useApi.js';
import { useNotification } from '@/composables/useNotification.js';
import { useIngredientIcons } from '@/composables/useIngredientIcons.js';
import {
  Search, PlusCircle, Pencil, Trash2, X, ExternalLink, Info, AlertTriangle,
  List, CheckCircle, CircleOff,
} from 'lucide-vue-next';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const api = useApi();
const { showSuccess, showError } = useNotification();
const { invalidate: invalidateIconCache, getEmoji: getEmojiFromCache } = useIngredientIcons();

const icons = ref([]);
const allIngredients = ref([]); // Alle verwendeten Zutatennamen aus Rezepten
const loading = ref(true);
const searchQuery = ref('');
const activeTab = ref('mappings');
const showModal = ref(false);
const editId = ref(null);
const formKeyword = ref('');
const formEmoji = ref('');
const emojiSearch = ref('');
const showDeleteConfirm = ref(false);
const deleteTarget = ref(null);
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

// Lokales Fuzzy-Matching (gleiche Logik wie im Composable, aber mit Keyword-Info)
function getEmojiWithKeyword(ingredientName) {
  if (!ingredientName || !icons.value.length) return null;
  const name = ingredientName.trim().toLowerCase();

  // 1. Exakter Match
  const exact = icons.value.find(i => i.keyword === name);
  if (exact) return { emoji: exact.emoji, keyword: exact.keyword };

  // 2. Keyword ist Teilstring des Zutatennamens (längste zuerst)
  const sorted = [...icons.value].sort((a, b) => b.keyword.length - a.keyword.length);
  const partial = sorted.find(i => name.includes(i.keyword));
  if (partial) return { emoji: partial.emoji, keyword: partial.keyword };

  // 3. Zutatenname ist Teilstring eines Keywords
  const reverse = sorted.find(i => i.keyword.includes(name));
  if (reverse) return { emoji: reverse.emoji, keyword: reverse.keyword };

  return null;
}

// Zutaten mit Match (verwendete Icons)
const usedIngredients = computed(() => {
  return allIngredients.value
    .map(ing => {
      const match = getEmojiWithKeyword(ing.name);
      if (!match) return null;
      return { name: ing.name, count: ing.count, emoji: match.emoji, matchedKeyword: match.keyword };
    })
    .filter(Boolean);
});

// Zutaten ohne Match
const unmatchedIngredients = computed(() => {
  return allIngredients.value
    .filter(ing => !getEmojiWithKeyword(ing.name))
    .sort((a, b) => b.count - a.count);
});

// Gefilterte Listen für Suche
const filteredUsedIngredients = computed(() => {
  if (!searchQuery.value) return usedIngredients.value;
  const q = searchQuery.value.toLowerCase();
  return usedIngredients.value.filter(i =>
    i.name.includes(q) || i.emoji.includes(q) || i.matchedKeyword.includes(q)
  );
});

const filteredUnmatchedIngredients = computed(() => {
  if (!searchQuery.value) return unmatchedIngredients.value;
  const q = searchQuery.value.toLowerCase();
  return unmatchedIngredients.value.filter(i => i.name.includes(q));
});

// Tabs-Definition
const tabs = computed(() => [
  { id: 'mappings', label: 'Alle Mappings', icon: List, count: icons.value.length },
  { id: 'used', label: 'Verwendet', icon: CheckCircle, count: usedIngredients.value.length },
  { id: 'unmatched', label: 'Ohne Zuordnung', icon: CircleOff, count: unmatchedIngredients.value.length },
]);

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

function openAddForIngredient(ingredientName) {
  editId.value = null;
  formKeyword.value = ingredientName;
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

function deleteIcon(icon) {
  deleteTarget.value = icon;
  showDeleteConfirm.value = true;
}

async function executeDeleteIcon() {
  const icon = deleteTarget.value;
  showDeleteConfirm.value = false;
  if (!icon) return;
  try {
    await api.del(`/ingredient-icons/${icon.id}`);
    showSuccess('Mapping gelöscht! 🗑️');
    invalidateIconCache();
    await fetchIcons();
  } catch {
    // Fehler wird von useApi angezeigt
  }
  deleteTarget.value = null;
}

async function fetchIcons() {
  loading.value = true;
  try {
    const [iconsData, usageData] = await Promise.all([
      api.get('/ingredient-icons'),
      api.get('/ingredient-icons/usage'),
    ]);
    icons.value = iconsData.icons || [];
    allIngredients.value = usageData.ingredients || [];
  } catch {
    // handled
  } finally {
    loading.value = false;
  }
}

onMounted(fetchIcons);
</script>
