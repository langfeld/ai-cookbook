<!--
  ============================================
  PantryView - Vorratsschrank
  ============================================
  Übersicht über vorhandene Vorräte:
  - Gruppiert nach Kategorie
  - Ablaufdatum-Warnung
  - Hinzufügen / Bearbeiten / Verbrauchen
-->
<template>
  <div class="space-y-6 animate-fade-in">
    <!-- Header -->
    <div class="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl">🗄️ Vorratsschrank</h1>
        <p class="text-stone-500 dark:text-stone-400 text-sm">
          {{ pantryStore.items.length }} Artikel vorrätig
        </p>
      </div>
      <div class="flex flex-wrap items-stretch gap-2 w-full sm:w-auto">
        <!-- Ansicht-Toggle: Kategorie / Rezept -->
        <button
          @click="toggleViewMode"
          :title="viewMode === 'category' ? 'Rezept-Ansicht' : 'Kategorie-Ansicht'"
          :class="[
            'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors',
            viewMode === 'recipe'
              ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
              : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700'
          ]"
        >
          <UtensilsCrossed v-if="viewMode === 'recipe'" class="w-4 h-4" />
          <LayoutGrid v-else class="w-4 h-4" />
          <span class="hidden sm:inline">{{ viewMode === 'recipe' ? 'Rezept-Ansicht' : 'Kategorie-Ansicht' }}</span>
        </button>
        <!-- Auswahl-Modus -->
        <button
          @click="toggleSelectMode"
          :class="[
            'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors',
            selectMode
              ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
              : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700'
          ]"
        >
          <CheckSquare v-if="selectMode" class="w-4 h-4" />
          <Square v-else class="w-4 h-4" />
          <span class="hidden sm:inline">{{ selectMode ? 'Abbrechen' : 'Auswählen' }}</span>
        </button>
        <button
          @click="showAddModal = true"
          class="flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-xl w-full sm:w-auto font-medium text-white text-sm transition-colors"
        >
          <Plus class="w-4 h-4" />
          Vorrat hinzufügen
        </button>
      </div>
    </div>

    <!-- Ablaufende Artikel Warnung -->
    <div v-if="expiringItems.length" class="bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-200 dark:border-amber-800 rounded-xl">
      <div class="flex items-center gap-2 mb-2">
        <AlertTriangle class="w-5 h-5 text-amber-500" />
        <span class="font-medium text-amber-700 dark:text-amber-400 text-sm">Bald ablaufend</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="item in expiringItems"
          :key="item.id"
          class="bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded-lg text-amber-700 dark:text-amber-300 text-xs"
        >
          {{ item.ingredient_name }} – {{ formatDate(item.expiry_date) }}
        </span>
      </div>
    </div>

    <!-- Filter -->
    <div class="flex gap-2">
      <input
        v-model="search"
        type="text"
        placeholder="Vorrat suchen..."
        class="flex-1 bg-white dark:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 text-sm"
      />
    </div>

    <!-- Vorrats-Liste (gruppiert nach Kategorie) -->
    <div v-if="viewMode === 'category' && filteredGrouped && Object.keys(filteredGrouped).length" class="space-y-6">
      <div v-for="(items, category) in filteredGrouped" :key="category">
        <h3 class="flex items-center gap-2 mb-3 font-semibold text-stone-500 dark:text-stone-400 text-sm">
          {{ categoryIcon(category) }} {{ category }}
          <span class="font-normal text-xs">({{ items.length }})</span>
        </h3>
        <div class="gap-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="item in items"
            :key="item.id"
            class="relative bg-white dark:bg-stone-900 p-4 border border-stone-200 dark:border-stone-800 rounded-xl transition-colors"
            :class="{
              'cursor-pointer hover:border-red-300 dark:hover:border-red-700': selectMode,
              'hover:border-primary-300 dark:hover:border-primary-700': !selectMode,
              'ring-2 ring-red-500 ring-offset-2 dark:ring-offset-stone-950': selectMode && selectedIds.has(item.id),
            }"
            @click="selectMode ? toggleSelect(item.id) : null"
          >
            <!-- Auswahl-Checkbox Overlay -->
            <div v-if="selectMode" class="top-0 left-0 z-10 absolute -mt-2 -ml-2">
              <div
                :class="[
                  'w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shadow-sm',
                  selectedIds.has(item.id)
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'bg-white/90 dark:bg-stone-800/90 border-stone-300 dark:border-stone-600'
                ]"
              >
                <Check v-if="selectedIds.has(item.id)" class="w-4 h-4" />
              </div>
            </div>
            <div class="flex justify-between items-start">
              <div>
                <h4 class="flex items-center gap-1.5 font-medium text-stone-800 dark:text-stone-200 text-sm">
                  {{ item.ingredient_name }}
                  <span v-if="item.is_permanent" class="inline-flex items-center gap-0.5 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full text-[10px] text-blue-600 dark:text-blue-400" title="Dauerhaft verfügbar">
                    <Infinity class="w-3 h-3" />
                  </span>
                </h4>
                <p v-if="!item.is_permanent" class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                  {{ item.amount }} {{ item.unit }}
                </p>
                <p v-else class="mt-0.5 text-blue-500 dark:text-blue-400 text-xs">
                  Immer verfügbar
                </p>
              </div>
              <div v-if="!selectMode" class="flex gap-1">
                <button
                  v-if="!item.is_permanent"
                  @click="openUseModal(item)"
                  class="p-1.5 rounded-lg text-accent-600 hover:bg-accent-50 dark:hover:bg-accent-900/20"
                  title="Verbrauchen"
                >
                  <Minus class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="removeItem(item)"
                  class="hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg text-red-500"
                  title="Entfernen"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <!-- Ablaufdatum -->
            <div v-if="item.expiry_date && !item.is_permanent" class="mt-2">
              <span :class="[
                'text-xs px-2 py-0.5 rounded-full',
                isExpiringSoon(item.expiry_date)
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
              ]">
                MHD: {{ formatDate(item.expiry_date) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════ -->
    <!-- Rezept-Ansicht                              -->
    <!-- ═══════════════════════════════════════════ -->
    <template v-if="viewMode === 'recipe'">
      <!-- Wochen-Selektor -->
      <div class="flex items-center gap-2 flex-wrap">
        <button
          @click="changeRecipeWeek(-1)"
          :disabled="!prevWeek"
          class="p-2 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Vorherige Woche"
        >
          <ChevronLeft class="w-4 h-4 text-stone-600 dark:text-stone-400" />
        </button>
        <select
          v-model="pantryStore.selectedWeekStart"
          @change="pantryStore.fetchRecipeView(pantryStore.selectedWeekStart)"
          class="bg-white dark:bg-stone-800 px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg text-sm text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        >
          <option
            v-for="week in pantryStore.availableWeeks"
            :key="week.week_start"
            :value="week.week_start"
          >
            KW {{ getCalendarWeek(week.week_start) }} ({{ formatWeekRange(week.week_start) }}) – {{ week.meal_count }} Rezepte
          </option>
          <option v-if="!pantryStore.availableWeeks.length" :value="pantryStore.selectedWeekStart">
            Keine Wochen mit Rezepten
          </option>
        </select>
        <button
          @click="changeRecipeWeek(1)"
          :disabled="!nextWeek"
          class="p-2 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Nächste Woche"
        >
          <ChevronRight class="w-4 h-4 text-stone-600 dark:text-stone-400" />
        </button>
      </div>

      <!-- Loading -->
      <div v-if="pantryStore.recipeViewLoading" class="py-12 text-center">
        <div class="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
        <p class="mt-3 text-stone-500 text-sm">Rezept-Ansicht wird geladen...</p>
      </div>

      <!-- Rezept-Gruppen -->
      <div v-else-if="filteredRecipeGroups.length || filteredUnassigned.length" class="space-y-6">
        <!-- Pro Rezept -->
        <div
          v-for="recipe in filteredRecipeGroups"
          :key="recipe.entry_id"
          class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden"
        >
          <!-- Rezept-Header -->
          <button
            @click="toggleRecipeExpanded(recipe.entry_id)"
            class="w-full flex items-center gap-3 p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors text-left"
          >
            <img
              v-if="recipe.recipe_image_url"
              :src="recipe.recipe_image_url"
              :alt="recipe.recipe_title"
              class="w-10 h-10 rounded-lg object-cover shrink-0"
            />
            <div v-else class="w-10 h-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0">
              <UtensilsCrossed class="w-5 h-5 text-stone-400" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-stone-800 dark:text-stone-200 text-sm truncate">{{ recipe.recipe_title }}</h3>
              <p class="text-stone-500 dark:text-stone-400 text-xs">
                {{ recipe.day_label }} – {{ recipe.meal_type_label }} · {{ recipe.servings }} Portionen
              </p>
            </div>
            <!-- Deckungsstatus -->
            <div class="flex items-center gap-2 shrink-0">
              <span :class="[
                'text-xs font-medium px-2 py-0.5 rounded-full',
                recipeCoverageClass(recipe)
              ]">
                {{ recipeCoverageLabel(recipe) }}
              </span>
              <ChevronDown :class="['w-4 h-4 text-stone-400 transition-transform', expandedRecipes.has(recipe.entry_id) ? 'rotate-180' : '']" />
            </div>
          </button>

          <!-- Zutaten-Liste (aufklappbar) -->
          <Transition name="expand">
            <div v-if="expandedRecipes.has(recipe.entry_id)" class="border-t border-stone-100 dark:border-stone-800">
              <div class="divide-y divide-stone-100 dark:divide-stone-800">
                <div
                  v-for="ing in recipe.ingredients"
                  :key="ing.name"
                  class="flex items-center gap-3 px-4 py-2.5"
                >
                  <!-- Status-Icon -->
                  <div class="shrink-0">
                    <CheckCircle2 v-if="ing.is_covered || ing.is_permanent" class="w-4 h-4 text-green-500" />
                    <AlertCircle v-else-if="ing.is_partial" class="w-4 h-4 text-amber-500" />
                    <XCircle v-else class="w-4 h-4 text-red-400" />
                  </div>
                  <!-- Name & Menge -->
                  <div class="flex-1 min-w-0">
                    <span class="text-sm text-stone-700 dark:text-stone-300">{{ ing.name }}</span>
                  </div>
                  <div class="text-right shrink-0">
                    <span class="text-xs text-stone-500 dark:text-stone-400">
                      {{ formatIngAmount(ing.needed_amount) }} {{ ing.needed_unit }}
                    </span>
                    <span
                      v-if="ing.is_permanent"
                      class="ml-1 text-[10px] text-blue-500"
                      title="Dauerhaft verfügbar"
                    >∞</span>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Vorräte ohne Rezept -->
        <div v-if="filteredUnassigned.length" class="mt-8">
          <h3 class="flex items-center gap-2 mb-3 font-semibold text-stone-500 dark:text-stone-400 text-sm">
            📦 Vorräte ohne Rezept
            <span class="font-normal text-xs">({{ filteredUnassigned.length }})</span>
          </h3>
          <div class="gap-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="item in filteredUnassigned"
              :key="item.id"
              class="relative bg-white dark:bg-stone-900 p-4 border border-stone-200 dark:border-stone-800 rounded-xl hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div class="flex justify-between items-start">
                <div>
                  <h4 class="flex items-center gap-1.5 font-medium text-stone-800 dark:text-stone-200 text-sm">
                    {{ item.ingredient_name }}
                    <span v-if="item.is_permanent" class="inline-flex items-center gap-0.5 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full text-[10px] text-blue-600 dark:text-blue-400" title="Dauerhaft verfügbar">
                      <Infinity class="w-3 h-3" />
                    </span>
                  </h4>
                  <p v-if="!item.is_permanent" class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                    <template v-if="item.remaining_amount !== item.amount">
                      {{ item.remaining_amount }} {{ item.unit }}
                      <span class="text-stone-400 dark:text-stone-500">(von {{ item.amount }})</span>
                    </template>
                    <template v-else>
                      {{ item.amount }} {{ item.unit }}
                    </template>
                  </p>
                  <p v-else class="mt-0.5 text-blue-500 dark:text-blue-400 text-xs">
                    Immer verfügbar
                  </p>
                </div>
                <div class="flex gap-1">
                  <button
                    v-if="!item.is_permanent"
                    @click="openUseModal(item)"
                    class="p-1.5 rounded-lg text-accent-600 hover:bg-accent-50 dark:hover:bg-accent-900/20"
                    title="Verbrauchen"
                  >
                    <Minus class="w-3.5 h-3.5" />
                  </button>
                  <button
                    @click="removeItem(item)"
                    class="hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg text-red-500"
                    title="Entfernen"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <!-- Ablaufdatum -->
              <div v-if="item.expiry_date && !item.is_permanent" class="mt-2">
                <span :class="[
                  'text-xs px-2 py-0.5 rounded-full',
                  isExpiringSoon(item.expiry_date)
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                ]">
                  MHD: {{ formatDate(item.expiry_date) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Leerer Zustand Rezept-Ansicht -->
      <div v-else-if="!pantryStore.recipeViewLoading" class="py-16 text-center">
        <div class="mb-4 text-6xl">🍽️</div>
        <h2 class="mb-2 font-semibold text-stone-700 dark:text-stone-300 text-xl">Keine geplanten Rezepte</h2>
        <p class="mx-auto max-w-md text-stone-500 dark:text-stone-400">
          Für diese Woche sind keine ungekochten Rezepte eingeplant. Erstelle einen Wochenplan, um die Rezept-Ansicht zu nutzen.
        </p>
      </div>
    </template>

    <!-- Leerer Zustand (Kategorie-Ansicht) -->
    <div v-else-if="viewMode === 'category' && !pantryStore.loading" class="py-16 text-center">
      <div class="mb-4 text-6xl">🗄️</div>
      <h2 class="mb-2 font-semibold text-stone-700 dark:text-stone-300 text-xl">Vorratsschrank ist leer</h2>
      <p class="mx-auto max-w-md text-stone-500 dark:text-stone-400">
        Füge Vorräte hinzu oder schließe einen Einkauf ab – gekaufte Artikel landen automatisch hier.
      </p>
    </div>

    <!-- Hinzufügen-Modal -->
    <Teleport to="body">
      <div v-if="showAddModal" class="z-50 fixed inset-0 flex justify-center items-center bg-black/50 p-4" @click.self="showAddModal = false">
        <div class="space-y-4 bg-white dark:bg-stone-900 p-6 rounded-2xl w-full max-w-md animate-slide-up">
          <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">Vorrat hinzufügen</h2>

          <div>
            <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">Name *</label>
            <input v-model="addForm.name" type="text" class="form-input" placeholder="z.B. Mehl" />
          </div>
          <div v-if="!addForm.is_permanent" class="gap-3 grid grid-cols-2">
            <div>
              <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">Menge</label>
              <input v-model.number="addForm.amount" type="number" step="0.01" class="form-input" />
            </div>
            <div>
              <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">Einheit</label>
              <input v-model="addForm.unit" type="text" class="form-input" placeholder="kg, l, Stk." />
            </div>
          </div>
          <div>
            <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">Kategorie</label>
            <select v-model="addForm.category" class="form-input">
              <option value="">Sonstiges</option>
              <option v-for="cat in pantryCategories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>

          <!-- Dauerhaft verfügbar Toggle -->
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <div class="relative">
              <input type="checkbox" v-model="addForm.is_permanent" class="sr-only peer" />
              <div class="bg-stone-200 dark:bg-stone-700 peer-checked:bg-blue-500 rounded-full w-10 h-5 transition-colors"></div>
              <div class="top-0.5 left-0.5 absolute bg-white rounded-full w-4 h-4 transition-transform peer-checked:translate-x-5"></div>
            </div>
            <div>
              <span class="font-medium text-stone-700 dark:text-stone-300 text-sm">Dauerhaft verfügbar</span>
              <p class="text-stone-400 dark:text-stone-500 text-xs">z.B. Wasser, Salz, Pfeffer – immer vorhanden</p>
            </div>
          </label>

          <div v-if="!addForm.is_permanent">
            <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">MHD (optional)</label>
            <input v-model="addForm.expires_at" type="date" class="form-input" />
          </div>

          <div class="flex gap-2 pt-2">
            <button
              @click="addItem"
              :disabled="!addForm.name"
              class="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 py-2 rounded-lg font-medium text-white text-sm"
            >
              Hinzufügen
            </button>
            <button
              @click="showAddModal = false"
              class="px-4 py-2 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-700 dark:text-stone-300 text-sm"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Verbrauchen-Modal -->
    <Teleport to="body">
      <div v-if="useModal.show" class="z-50 fixed inset-0 flex justify-center items-center bg-black/50 p-4" @click.self="useModal.show = false">
        <div class="space-y-4 bg-white dark:bg-stone-900 p-6 rounded-2xl w-full max-w-sm animate-slide-up">
          <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">
            {{ useModal.item?.ingredient_name }} verbrauchen
          </h2>
          <p class="text-stone-500 text-sm">
            Vorrätig: {{ useModal.item?.amount }} {{ useModal.item?.unit }}
          </p>
          <div>
            <label class="block mb-1 text-stone-600 dark:text-stone-400 text-sm">Menge verbrauchen</label>
            <input v-model.number="useModal.amount" type="number" step="0.01" min="0" class="form-input" />
          </div>
          <div class="flex gap-2">
            <button
              @click="useAmount"
              :disabled="!useModal.amount"
              class="flex-1 disabled:opacity-50 py-2 rounded-lg font-medium text-white text-sm bg-accent-600 hover:bg-accent-700"
            >
              Verbrauchen
            </button>
            <button
              @click="useModal.show = false"
              class="px-4 py-2 border border-stone-300 dark:border-stone-600 rounded-lg text-sm"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Floating Aktionsleiste bei Auswahl -->
    <Teleport to="body">
      <Transition name="slide-up">
        <div
          v-if="selectMode && selectedIds.size > 0"
          class="right-0 bottom-0 left-0 z-40 fixed flex justify-center items-center gap-4 bg-white/95 dark:bg-stone-900/95 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] backdrop-blur-sm px-6 py-4 border-stone-200 dark:border-stone-700 border-t"
        >
          <div class="flex items-center gap-2 text-stone-600 dark:text-stone-300 text-sm">
            <CheckSquare class="w-4 h-4" />
            <span class="font-medium">{{ selectedIds.size }}</span> ausgewählt
          </div>
          <button
            @click="selectAll"
            class="hover:bg-stone-100 dark:hover:bg-stone-800 px-3 py-1.5 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-600 dark:text-stone-300 text-sm transition-colors"
          >
            Alle ({{ allFilteredItems.length }})
          </button>
          <button
            @click="showBatchDeleteConfirm = true"
            class="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-lg font-medium text-white text-sm transition-colors"
          >
            <Trash2 class="w-4 h-4" />
            Löschen ({{ selectedIds.size }})
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Bestätigungs-Dialog für Batch-Löschen -->
    <ConfirmDialog
      v-model="showBatchDeleteConfirm"
      variant="danger"
      :title="`${selectedIds.size} Artikel entfernen?`"
      :message="`${selectedIds.size} Artikel werden unwiderruflich aus dem Vorratsschrank entfernt.`"
      confirm-text="Endgültig entfernen"
      cancel-text="Abbrechen"
      :loading="batchDeleting"
      @confirm="executeBatchDelete"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { usePantryStore } from '@/stores/pantry.js';
import { useNotification } from '@/composables/useNotification.js';
import { Plus, Minus, Trash2, AlertTriangle, Download, Infinity, Check, CheckSquare, Square, UtensilsCrossed, LayoutGrid, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, XCircle } from 'lucide-vue-next';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const pantryStore = usePantryStore();
const { showSuccess, showError } = useNotification();

const search = ref('');
const showAddModal = ref(false);
const useModal = reactive({ show: false, item: null, amount: 0 });

// Mehrfachauswahl
const selectMode = ref(false);
const selectedIds = ref(new Set());
const showBatchDeleteConfirm = ref(false);
const batchDeleting = ref(false);

const addForm = reactive({
  name: '',
  amount: 1,
  unit: 'Stk.',
  category: '',
  expires_at: '',
  is_permanent: false,
});

// ─── Ansicht-Modus ───
const viewMode = ref(localStorage.getItem('pantry_viewMode') || 'category');
const expandedRecipes = ref(new Set());

function toggleViewMode() {
  viewMode.value = viewMode.value === 'category' ? 'recipe' : 'category';
  localStorage.setItem('pantry_viewMode', viewMode.value);
  if (viewMode.value === 'recipe' && !pantryStore.recipeViewData) {
    pantryStore.fetchRecipeView();
  }
}

// Rezept auf-/zuklappen
function toggleRecipeExpanded(entryId) {
  const s = new Set(expandedRecipes.value);
  if (s.has(entryId)) s.delete(entryId);
  else s.add(entryId);
  expandedRecipes.value = s;
}

// ─── Rezept-Ansicht Filterung ───
const filteredRecipeGroups = computed(() => {
  const query = search.value.toLowerCase();
  if (!query) return pantryStore.recipeGroups;
  return pantryStore.recipeGroups.filter(r =>
    r.recipe_title.toLowerCase().includes(query) ||
    r.ingredients.some(i => i.name.toLowerCase().includes(query))
  );
});

const filteredUnassigned = computed(() => {
  const query = search.value.toLowerCase();
  if (!query) return pantryStore.unassignedItems;
  return pantryStore.unassignedItems.filter(i => i.ingredient_name.toLowerCase().includes(query));
});

// ─── Wochen-Navigation ───
const sortedWeeks = computed(() => {
  return [...pantryStore.availableWeeks].sort((a, b) => a.week_start.localeCompare(b.week_start));
});

const currentWeekIndex = computed(() => {
  return sortedWeeks.value.findIndex(w => w.week_start === pantryStore.selectedWeekStart);
});

const prevWeek = computed(() => {
  const idx = currentWeekIndex.value;
  return idx > 0 ? sortedWeeks.value[idx - 1] : null;
});

const nextWeek = computed(() => {
  const idx = currentWeekIndex.value;
  return idx >= 0 && idx < sortedWeeks.value.length - 1 ? sortedWeeks.value[idx + 1] : null;
});

function changeRecipeWeek(dir) {
  const target = dir < 0 ? prevWeek.value : nextWeek.value;
  if (target) pantryStore.fetchRecipeView(target.week_start);
}

function getCalendarWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  return Math.round(((d - yearStart) / 86400000 + 1) / 7);
}

function formatWeekRange(weekStartStr) {
  const start = new Date(weekStartStr + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
}

// ─── Deckungsstatus ───
function recipeCoverageClass(recipe) {
  const ings = recipe.ingredients;
  if (!ings.length) return 'bg-stone-100 dark:bg-stone-800 text-stone-500';
  const allCovered = ings.every(i => i.is_covered || i.is_permanent);
  const someMissing = ings.some(i => i.is_missing && !i.is_permanent);
  if (allCovered) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  if (someMissing) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
}

function recipeCoverageLabel(recipe) {
  const ings = recipe.ingredients;
  if (!ings.length) return 'Keine Zutaten';
  const covered = ings.filter(i => i.is_covered || i.is_permanent).length;
  return `${covered}/${ings.length}`;
}

function formatIngAmount(amount) {
  if (!amount) return '';
  if (Number.isInteger(amount)) return amount.toString();
  return amount.toFixed(1).replace(/\.0$/, '');
}

const pantryCategories = [
  'Obst & Gemüse', 'Milchprodukte', 'Fleisch & Fisch', 'Backwaren',
  'Gewürze', 'Getränke', 'Tiefkühl', 'Konserven', 'Grundzutaten',
];

// Ablaufende Artikel (< 3 Tage)
const expiringItems = computed(() => {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 3);
  return pantryStore.items.filter(i => i.expiry_date && new Date(i.expiry_date) <= threshold);
});

// Nach Suche filtern und gruppieren
const filteredGrouped = computed(() => {
  const query = search.value.toLowerCase();
  const items = pantryStore.items.filter(i => !query || i.ingredient_name.toLowerCase().includes(query));
  const groups = {};
  for (const item of items) {
    const cat = item.category || 'Sonstiges';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
});

function categoryIcon(cat) {
  const icons = {
    'Obst & Gemüse': '🥬', 'Milchprodukte': '🧀', 'Fleisch & Fisch': '🥩',
    'Backwaren': '🍞', 'Gewürze': '🧂', 'Getränke': '🥤', 'Tiefkühl': '🧊',
    'Konserven': '🥫', 'Grundzutaten': '🌾', 'Sonstiges': '📦',
  };
  return icons[cat] || '📦';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function isExpiringSoon(dateStr) {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 3);
  return new Date(dateStr) <= threshold;
}

function openUseModal(item) {
  useModal.item = item;
  useModal.amount = item.amount;
  useModal.show = true;
}

async function addItem() {
  try {
    await pantryStore.addItem({
      ingredient_name: addForm.name,
      amount: addForm.is_permanent ? 1 : addForm.amount,
      unit: addForm.is_permanent ? '' : addForm.unit,
      category: addForm.category || undefined,
      expiry_date: addForm.is_permanent ? undefined : (addForm.expires_at || undefined),
      is_permanent: addForm.is_permanent ? 1 : 0,
    });
    showSuccess(`${addForm.name} hinzugefügt!`);
    showAddModal.value = false;
    Object.assign(addForm, { name: '', amount: 1, unit: 'Stk.', category: '', expires_at: '', is_permanent: false });
  } catch {
    // Fehler wird von useApi angezeigt
  }
}

async function useAmount() {
  try {
    await pantryStore.useAmount(useModal.item.id, useModal.amount);
    showSuccess(`${useModal.amount} ${useModal.item.unit} verbraucht`);
    useModal.show = false;
  } catch {
    // Fehler wird von useApi angezeigt
  }
}

async function removeItem(item) {
  if (!confirm(`${item.ingredient_name} wirklich entfernen?`)) return;
  try {
    await pantryStore.removeItem(item.id);
    showSuccess(`${item.ingredient_name} entfernt`);
  } catch {
    // Fehler wird von useApi angezeigt
  }
}

// Alle gefilterten Items (für "Alle auswählen")
const allFilteredItems = computed(() => {
  const query = search.value.toLowerCase();
  return pantryStore.items.filter(i => !query || i.ingredient_name.toLowerCase().includes(query));
});

// Auswahl-Modus
function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  selectedIds.value = new Set();
}

function toggleSelect(id) {
  const s = new Set(selectedIds.value);
  if (s.has(id)) {
    s.delete(id);
  } else {
    s.add(id);
  }
  selectedIds.value = s;
}

function selectAll() {
  selectedIds.value = new Set(allFilteredItems.value.map(i => i.id));
}

async function executeBatchDelete() {
  batchDeleting.value = true;
  try {
    const ids = [...selectedIds.value];
    const result = await pantryStore.deleteItemsBatch(ids);
    showSuccess(`${result.deletedCount} Artikel entfernt! 🗑️`);
    showBatchDeleteConfirm.value = false;
    selectMode.value = false;
    selectedIds.value = new Set();
  } catch {
    showError('Löschen fehlgeschlagen.');
  } finally {
    batchDeleting.value = false;
  }
}

onMounted(() => {
  pantryStore.fetchItems();
  if (viewMode.value === 'recipe') {
    pantryStore.fetchRecipeView();
  }
});
</script>

<style scoped>
.form-input {
  width: 100%;
  padding-inline: calc(var(--spacing) * 3);
  padding-block: calc(var(--spacing) * 2);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-stone-200);
  background-color: white;
  color: var(--color-stone-800);
  font-size: var(--text-sm);
  line-height: var(--text-sm--line-height);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.form-input:focus {
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary-500) 30%, transparent);
}
:is(.dark .form-input) {
  border-color: var(--color-stone-700);
  background-color: var(--color-stone-800);
  color: var(--color-stone-200);
}

/* Expand/Collapse-Animation */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>
