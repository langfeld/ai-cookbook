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
      <div class="flex flex-wrap items-stretch gap-2">
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
        <!-- Verlauf (History-Button mit Dropdown) -->
        <div class="relative" ref="historyBtnRef">
          <button
            @click="openHistoryDropdown"
            :class="[
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border',
              showHistoryDropdown
                ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                : 'bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-600 text-stone-500 dark:text-stone-400'
            ]"
            title="Vorherige Einkaufslisten laden"
          >
            <History class="w-4 h-4" />
            <span class="hidden sm:inline">Verlauf</span>
          </button>
          <!-- Backdrop -->
          <Transition name="fade">
            <div v-if="showHistoryDropdown" class="z-30 fixed inset-0" @click="showHistoryDropdown = false" />
          </Transition>
          <!-- Dropdown -->
          <Transition name="fade">
            <div v-if="showHistoryDropdown" class="sm:top-full sm:right-0 z-40 fixed sm:absolute bg-white dark:bg-stone-800 shadow-lg sm:mt-1.5 border border-stone-200 dark:border-stone-700 rounded-xl sm:w-80 overflow-hidden" :style="historyDropdownStyle">
              <div class="px-4 py-3 border-stone-200 dark:border-stone-700 border-b">
                <p class="font-semibold text-stone-700 dark:text-stone-200 text-sm">Vorherige Einkaufslisten</p>
              </div>
              <div class="max-h-72 overflow-y-auto">
                <div v-if="shoppingStore.listHistory.length === 0" class="px-4 py-6 text-center">
                  <p class="text-stone-400 dark:text-stone-500 text-sm italic">Kein Verlauf vorhanden.</p>
                </div>
                <div
                  v-for="hl in shoppingStore.listHistory.slice(0, 15)"
                  :key="hl.id"
                  @click="reactivateHistoryList(hl.id); showHistoryDropdown = false"
                  :class="[
                    'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-stone-100 dark:border-stone-700/50 last:border-b-0',
                    hl.is_active
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'hover:bg-stone-50 dark:hover:bg-stone-700/50'
                  ]"
                >
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-stone-700 dark:text-stone-200 text-sm truncate">
                      {{ hl.name || 'Einkaufsliste' }}
                      <span v-if="hl.is_active" class="bg-primary-100 dark:bg-primary-900/40 ml-1.5 px-1.5 py-0.5 rounded font-semibold text-[10px] text-primary-700 dark:text-primary-300">AKTIV</span>
                    </p>
                    <p class="text-stone-400 dark:text-stone-500 text-xs">
                      {{ formatHistoryDate(hl.created_at) }}
                      · {{ hl.checked_count || 0 }}/{{ hl.item_count || 0 }} erledigt
                    </p>
                  </div>
                  <RotateCcw v-if="!hl.is_active" class="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 shrink-0" />
                </div>
              </div>
            </div>
          </Transition>
        </div>
        <!-- Zusammenfassen (Split-Button: Merge-Modus + Alias-Verwaltung) -->
        <div v-if="shoppingStore.activeList" class="flex items-stretch">
          <button
            @click="toggleMergeMode"
            :class="[
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border',
              mergeMode
                ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                : 'bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200',
              aliasStore.aliases.length > 0 ? 'rounded-l-xl border-r-0' : 'rounded-xl'
            ]"
            :title="mergeMode ? 'Zusammenfassen beenden' : 'Zutaten zusammenfassen'"
          >
            <Merge class="w-4 h-4" />
            <span class="hidden sm:inline">Zusammenfassen</span>
          </button>
          <button
            v-if="aliasStore.aliases.length > 0"
            @click="showAliasManager = true"
            :class="[
              'flex items-center px-2 rounded-r-xl text-sm transition-colors border',
              mergeMode
                ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 border-l-violet-400 dark:border-l-violet-600 text-violet-500 dark:text-violet-400 hover:text-violet-700'
                : 'bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-600 border-l-stone-400 dark:border-l-stone-500 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
            ]"
            title="Gespeicherte Zusammenfassungen verwalten"
          >
            <Settings class="w-3.5 h-3.5" />
          </button>
        </div>
        <!-- Blockieren (Split-Button: Block-Modus + Blockliste verwalten) -->
        <div v-if="shoppingStore.activeList" class="flex items-stretch">
          <button
            @click="toggleBlockMode"
            :class="[
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border',
              blockMode
                ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                : 'bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200',
              aliasStore.blockedIngredients.length > 0 ? 'rounded-l-xl border-r-0' : 'rounded-xl'
            ]"
            :title="blockMode ? 'Blockieren beenden' : 'Zutaten zum Blockieren auswählen'"
          >
            <Ban class="w-4 h-4" />
            <span class="hidden sm:inline">Blockieren</span>
          </button>
          <button
            v-if="aliasStore.blockedIngredients.length > 0"
            @click="showBlockManager = true"
            :class="[
              'flex items-center px-2 rounded-r-xl text-sm transition-colors border',
              blockMode
                ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 border-l-red-400 dark:border-l-red-600 text-red-500 dark:text-red-400 hover:text-red-700'
                : 'bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-600 border-l-stone-400 dark:border-l-stone-500 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
            ]"
            title="Blockierte Zutaten verwalten"
          >
            <Settings class="w-3.5 h-3.5" />
          </button>
        </div>
        <!-- Aus Wochenplan erstellen (Split-Button) -->
        <div class="relative flex items-stretch w-full sm:w-auto">
          <button
            @click="generateList"
            :disabled="shoppingStore.loading"
            class="flex sm:flex-initial flex-1 justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-l-xl font-medium text-white text-sm transition-colors"
          >
            <ListPlus class="w-4 h-4" />
            Aus Wochenplan erstellen
          </button>
          <button
            @click="showGenOptions = !showGenOptions"
            class="flex items-center bg-primary-600 hover:bg-primary-700 px-2.5 border-primary-500 border-l rounded-r-xl text-white transition-colors"
            title="Optionen"
          >
            <ChevronDown class="w-3.5 h-3.5" :class="showGenOptions ? 'rotate-180' : ''" />
          </button>
          <!-- Dropdown -->
          <Transition name="fade">
            <div v-if="showGenOptions" class="z-30 fixed inset-0" @click="showGenOptions = false" />
          </Transition>
          <Transition name="fade">
            <div v-if="showGenOptions" class="top-full sm:right-0 left-0 sm:left-auto z-30 absolute bg-white dark:bg-stone-800 shadow-lg mt-1.5 border border-stone-200 dark:border-stone-700 rounded-xl w-72 overflow-hidden">
              <div class="space-y-3 p-3">
                <!-- Wochen-Auswahl -->
                <div>
                  <p class="mb-2 font-medium text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wide">Woche auswählen</p>
                  <div class="flex items-center gap-1">
                    <button @click="genWeekOffset--" class="hover:bg-stone-100 dark:hover:bg-stone-700 p-1.5 rounded-lg transition-colors">
                      <ChevronLeft class="w-4 h-4 text-stone-500" />
                    </button>
                    <button @click="genWeekOffset = 0"
                      class="flex-1 py-1.5 rounded-lg font-medium text-sm text-center transition-colors"
                      :class="genWeekOffset === 0
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200'"
                    >
                      {{ genWeekLabel }}
                    </button>
                    <button @click="genWeekOffset++" class="hover:bg-stone-100 dark:hover:bg-stone-700 p-1.5 rounded-lg transition-colors">
                      <ChevronRight class="w-4 h-4 text-stone-500" />
                    </button>
                  </div>
                </div>

                <!-- Vergangene Tage Toggle -->
                <label class="group flex items-center gap-3 cursor-pointer select-none">
                  <div class="relative">
                    <input type="checkbox" v-model="genIncludePastDays" class="sr-only peer" />
                    <div class="bg-stone-200 dark:bg-stone-600 peer-checked:bg-primary-500 rounded-full w-9 h-5 transition-colors" />
                    <div class="top-0.5 left-0.5 absolute bg-white shadow-sm rounded-full w-4 h-4 transition-transform peer-checked:translate-x-4" />
                  </div>
                  <div>
                    <p class="font-medium text-stone-700 dark:text-stone-200 text-sm">Vergangene Tage</p>
                    <p class="text-stone-400 dark:text-stone-500 text-xs">Auch zurückliegende Wochentage einbeziehen</p>
                  </div>
                </label>
              </div>
            </div>
          </Transition>
        </div>
        <!-- REWE abgleichen (Split-Button: Match + Einstellungen) -->
        <div v-if="shoppingStore.activeList && reweEnabled" class="flex items-stretch w-full sm:w-auto">
          <button
            @click="matchWithRewe"
            :disabled="reweLoading"
            class="flex sm:flex-initial flex-1 justify-center items-center gap-2 bg-rewe-500 hover:bg-rewe-600 disabled:opacity-50 px-4 py-2 rounded-l-xl font-medium text-white text-sm transition-colors"
          >
            <Loader2 v-if="reweLoading" class="w-4 h-4 animate-spin" />
            <span v-else>🏪</span>
            REWE abgleichen
          </button>
          <button
            @click="showReweSettings = true; loadReweMarketSettings()"
            class="flex items-center bg-rewe-500 hover:bg-rewe-600 px-3 border-rewe-400 border-l rounded-r-xl text-white transition-colors"
            title="REWE-Einstellungen"
          >
            <Settings class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Fortschrittsbalken -->
    <div v-if="shoppingStore.activeList" class="bg-stone-200 dark:bg-stone-700 rounded-full w-full h-2">
      <div
        class="rounded-full h-2 transition-all duration-500 bg-accent-500"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>

    <!-- REWE-Matching Fortschritt -->
    <Transition name="slide">
      <div v-if="shoppingStore.reweProgress" class="bg-white dark:bg-stone-900 border border-rewe-200 dark:border-rewe-800/40 rounded-xl overflow-hidden">
        <!-- Fortschrittsbalken -->
        <div class="bg-rewe-100 dark:bg-rewe-900/20 w-full h-1.5">
          <div
            class="bg-rewe-500 h-1.5 transition-all duration-300 ease-out"
            :style="{ width: `${reweMatchPercent}%` }"
          />
        </div>
        <div class="px-4 py-3">
          <div class="flex justify-between items-center gap-4">
            <!-- Links: Status -->
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative flex justify-center items-center w-9 h-9 shrink-0">
                <svg class="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3" class="text-rewe-100 dark:text-rewe-900/40" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3"
                    class="text-rewe-500 transition-all duration-300"
                    :stroke-dasharray="`${reweMatchPercent * 0.942} 100`"
                  />
                </svg>
                <span class="absolute font-bold text-[10px] text-rewe-600 dark:text-rewe-400">{{ reweMatchPercent }}%</span>
              </div>
              <div class="min-w-0">
                <p class="font-medium text-stone-800 dark:text-stone-200 text-sm truncate">
                  <span v-if="reweMatchPercent < 100">
                    <span v-if="shoppingStore.reweProgress.fromPreference">⭐</span>
                    <span v-else>🔍</span>
                    {{ shoppingStore.reweProgress.itemName }}…
                  </span>
                  <span v-else>✅ Fertig!</span>
                </p>
                <p class="text-stone-500 dark:text-stone-400 text-xs">
                  {{ shoppingStore.reweProgress.current }} / {{ shoppingStore.reweProgress.total }} Zutaten
                  · {{ shoppingStore.reweProgress.matchedCount }} zugeordnet
                </p>
              </div>
            </div>
            <!-- Rechts: Letzter Match -->
            <div v-if="shoppingStore.reweProgress.matched && shoppingStore.reweProgress.productName" class="hidden sm:block text-right shrink-0">
              <p class="max-w-50 text-green-600 dark:text-green-400 text-xs truncate">
                ✓ {{ shoppingStore.reweProgress.productName }}
              </p>
              <p v-if="shoppingStore.reweProgress.price" class="font-medium text-stone-600 dark:text-stone-300 text-xs">
                {{ shoppingStore.reweProgress.price }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Manuell hinzufügen -->
    <form
      v-if="shoppingStore.activeList || !shoppingStore.loading"
      @submit.prevent="addManualItem"
      class="flex flex-wrap items-end gap-2 bg-white dark:bg-stone-900 p-4 border border-stone-200 dark:border-stone-800 rounded-xl"
    >
      <div class="flex-1 min-w-40">
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
      <!-- Merge-Mode Hinweis -->
      <Transition name="slide">
        <div v-if="mergeMode" class="flex items-center gap-3 bg-violet-50 dark:bg-violet-900/20 p-4 border border-violet-200 dark:border-violet-800 rounded-xl">
          <Merge class="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0" />
          <div class="flex-1">
            <p class="font-medium text-violet-800 dark:text-violet-200 text-sm">
              <template v-if="mergeSelection.length === 0">Klicke auf die Zutaten, die zusammengefasst werden sollen.</template>
              <template v-else>
                <span v-for="(sel, i) in mergeSelection" :key="sel.id">
                  <span v-if="i > 0" class="text-violet-400"> + </span>
                  <span class="bg-violet-200 dark:bg-violet-800 px-1.5 py-0.5 rounded font-semibold">{{ sel.ingredient_name }}</span>
                </span>
                <span v-if="mergeSelection.length < 2" class="ml-1">– wähle weitere aus.</span>
              </template>
            </p>
          </div>
          <button
            v-if="mergeSelection.length >= 2"
            @click="openMergeDialog"
            class="bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-colors shrink-0"
          >
            Zusammenfassen ({{ mergeSelection.length }})
          </button>
          <button @click="toggleMergeMode" class="hover:bg-violet-100 dark:hover:bg-violet-800/50 p-1.5 rounded-lg text-violet-500 transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>
      </Transition>

      <!-- Block-Mode Hinweis -->
      <Transition name="slide">
        <div v-if="blockMode" class="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800 rounded-xl">
          <Ban class="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <div class="flex-1">
            <p class="font-medium text-red-800 dark:text-red-200 text-sm">
              <template v-if="blockSelection.length === 0">Klicke auf die Zutaten, die zukünftig blockiert werden sollen.</template>
              <template v-else>
                <span v-for="(sel, i) in blockSelection" :key="sel.id">
                  <span v-if="i > 0" class="text-red-400">, </span>
                  <span class="bg-red-200 dark:bg-red-800 px-1.5 py-0.5 rounded font-semibold">{{ sel.ingredient_name }}</span>
                </span>
              </template>
            </p>
          </div>
          <button
            v-if="blockSelection.length >= 1"
            @click="confirmBlockSelection"
            class="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-colors shrink-0"
          >
            Blockieren ({{ blockSelection.length }})
          </button>
          <button @click="toggleBlockMode" class="hover:bg-red-100 dark:hover:bg-red-800/50 p-1.5 rounded-lg text-red-500 transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>
      </Transition>

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
              @click="mergeMode ? handleMergeClick(item) : blockMode ? handleBlockClick(item) : null"
              :class="[
                'transition-all',
                (mergeMode || blockMode)
                  ? 'cursor-pointer'
                  : '',
                mergeMode ? 'hover:bg-violet-50 dark:hover:bg-violet-900/20' : '',
                blockMode ? 'hover:bg-red-50 dark:hover:bg-red-900/20' : '',
                item.is_checked ? 'opacity-50' : '',
                mergeMode && mergeSelection.some(s => s.id === item.id)
                  ? 'bg-violet-100 dark:bg-violet-900/30 ring-2 ring-violet-400 ring-inset'
                  : '',
                blockMode && blockSelection.some(s => s.id === item.id)
                  ? 'bg-red-100 dark:bg-red-900/30 ring-2 ring-red-400 ring-inset'
                  : ''
              ]"
            >
              <!-- Obere Zeile: Checkbox + Name + Menge + Aktionen -->
              <div class="flex items-center gap-3 px-4 py-3">
                <!-- Checkbox (im Merge-Modus: Merge-Indikator, im Block-Modus: Block-Indikator) -->
                <button
                  v-if="!mergeMode && !blockMode"
                  @click.stop="toggleItem(item)"
                  :class="[
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    item.is_checked
                      ? 'bg-accent-500 border-accent-500'
                      : 'border-stone-300 dark:border-stone-600 hover:border-accent-400'
                  ]"
                >
                  <Check v-if="item.is_checked" class="w-3.5 h-3.5 text-white" />
                </button>
                <div
                  v-else-if="mergeMode"
                  :class="[
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    mergeSelection.some(s => s.id === item.id)
                      ? 'bg-violet-500 border-violet-500'
                      : 'border-violet-300 dark:border-violet-600'
                  ]"
                >
                  <Check v-if="mergeSelection.some(s => s.id === item.id)" class="w-3.5 h-3.5 text-white" />
                </div>
                <div
                  v-else-if="blockMode"
                  :class="[
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    blockSelection.some(s => s.id === item.id)
                      ? 'bg-red-500 border-red-500'
                      : 'border-red-300 dark:border-red-600'
                  ]"
                >
                  <Check v-if="blockSelection.some(s => s.id === item.id)" class="w-3.5 h-3.5 text-white" />
                </div>

                <!-- Artikelname + Rezept-Thumbnails -->
                <div class="flex-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span :class="['font-medium text-sm', item.is_checked ? 'line-through text-stone-400' : 'text-stone-800 dark:text-stone-200']">
                      {{ item.ingredient_name }}
                    </span>
                    <!-- Source-Icons -->
                    <span v-if="item.source === 'manual'" title="Manuell hinzugefügt" class="text-stone-400 dark:text-stone-500">
                      <PenLine class="w-3 h-3" />
                    </span>
                    <span v-else-if="item.source === 'bring'" title="Aus Bring! importiert" class="text-teal-400 dark:text-teal-500">
                      <Download class="w-3 h-3" />
                    </span>
                    <span v-if="item.amount" class="text-stone-400 dark:text-stone-500 text-xs">
                      {{ item.amount }} {{ item.unit }}
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
                        <img v-if="recipe.image_url" :src="recipe.image_url" :alt="recipe.title" class="w-full h-full object-cover" />
                        <span v-else class="flex justify-center items-center w-full h-full text-[8px]">🍽️</span>
                      </router-link>
                    </div>
                  </div>
                  <!-- Vorrats-Hinweis -->
                  <div v-if="item.pantry_deducted > 0" class="flex items-center gap-1 mt-0.5 text-emerald-600 dark:text-emerald-400 text-xs">
                    <Package class="w-3 h-3" />
                    {{ item.pantry_deducted }} {{ item.unit }} im Vorrat
                  </div>
                </div>

                <!-- Aktionen (immer sichtbar, größere Touch-Targets) -->
                <div v-if="!mergeMode && !blockMode" class="flex items-center gap-0.5 shrink-0">
                  <button
                    @click.stop="moveToPantry(item)"
                    class="hover:bg-amber-50 dark:hover:bg-amber-900/30 p-2 rounded-lg text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 dark:text-stone-500 transition-colors"
                    title="In den Vorratsschrank"
                  >
                    <Archive class="w-4 h-4" />
                  </button>
                  <button
                    @click.stop="deleteItem(item)"
                    class="hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg text-stone-400 hover:text-red-500 dark:hover:text-red-400 dark:text-stone-500 transition-colors"
                    title="Artikel entfernen"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- REWE-Produkt-Karte (wenn zugewiesen) -->
              <div v-if="item.rewe_product" class="mx-3 mb-3" :class="(mergeMode || blockMode) ? 'opacity-40 pointer-events-none select-none' : ''">
                <div class="bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden">
                  <!-- Produktinfo mit Bild -->
                  <div class="flex items-center gap-3 p-3">
                    <!-- Produktbild -->
                    <div class="flex justify-center items-center bg-white dark:bg-stone-700 rounded-lg w-14 h-14 overflow-hidden shrink-0">
                      <img
                        v-if="item.rewe_product.imageUrl"
                        :src="item.rewe_product.imageUrl"
                        :alt="item.rewe_product.name"
                        class="w-full h-full object-contain"
                        loading="lazy"
                      />
                      <span v-else class="text-2xl">🏪</span>
                    </div>
                    <!-- Name + Packungsgröße -->
                    <div class="flex-1 min-w-0">
                      <a
                        v-if="item.rewe_product.url"
                        :href="item.rewe_product.url"
                        target="_blank"
                        rel="noopener"
                        @click.stop
                        class="font-medium text-stone-800 hover:text-rewe-600 dark:hover:text-rewe-400 dark:text-stone-200 text-sm line-clamp-2 transition-colors"
                      >
                        {{ item.rewe_product.name }}
                      </a>
                      <p v-else class="font-medium text-stone-800 dark:text-stone-200 text-sm line-clamp-2">
                        {{ item.rewe_product.name }}
                      </p>
                      <p v-if="item.rewe_product.packageSize" class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                        {{ item.rewe_product.packageSize }}
                      </p>
                    </div>
                    <!-- Preis -->
                    <div class="text-right shrink-0">
                      <p class="font-bold tabular-nums text-stone-800 dark:text-stone-200 text-sm">
                        {{ formatPrice(item.rewe_product.price * (item.rewe_product.quantity || 1)) }}
                      </p>
                      <p v-if="(item.rewe_product.quantity || 1) > 1" class="tabular-nums text-stone-400 dark:text-stone-500 text-xs">
                        Einzelpreis {{ formatPrice(item.rewe_product.price) }}
                      </p>
                    </div>
                  </div>

                  <!-- Menge + Alternative -->
                  <div class="flex justify-between items-center gap-2 px-3 py-2 border-stone-200 dark:border-stone-700 border-t">
                    <!-- Mengen-Steuerung -->
                    <div class="flex items-center gap-1">
                      <button
                        @click.stop="decreaseQuantity(item)"
                        :disabled="(item.rewe_product.quantity || 1) <= 1"
                        class="flex justify-center items-center bg-white hover:bg-stone-100 dark:bg-stone-700 dark:hover:bg-stone-600 disabled:opacity-30 border border-stone-300 dark:border-stone-600 rounded-lg w-8 h-8 text-stone-600 dark:text-stone-300 transition-colors disabled:cursor-not-allowed"
                      >
                        <Minus class="w-3.5 h-3.5" />
                      </button>
                      <span class="w-8 font-semibold tabular-nums text-stone-800 dark:text-stone-200 text-sm text-center">
                        {{ item.rewe_product.quantity || 1 }}
                      </span>
                      <button
                        @click.stop="increaseQuantity(item)"
                        class="flex justify-center items-center bg-white hover:bg-stone-100 dark:bg-stone-700 dark:hover:bg-stone-600 border border-stone-300 dark:border-stone-600 rounded-lg w-8 h-8 text-stone-600 dark:text-stone-300 transition-colors"
                      >
                        <Plus class="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <!-- Alternative wählen -->
                    <button
                      @click.stop="openProductPicker(item)"
                      class="flex items-center gap-1.5 hover:bg-rewe-50 dark:hover:bg-rewe-900/20 px-3 py-1.5 rounded-lg font-medium text-rewe-600 dark:text-rewe-400 text-xs transition-colors"
                    >
                      <ArrowRightLeft class="w-3.5 h-3.5" />
                      Alternative wählen
                    </button>
                  </div>
                </div>
              </div>

              <!-- Kein REWE-Produkt → Suche anbieten -->
              <div v-else-if="(shoppingStore.reweLinkedItems.length > 0 || reweLoading) && !item.rewe_product" class="-mt-1 px-4 pb-3" :class="(mergeMode || blockMode) ? 'opacity-40 pointer-events-none select-none' : ''">
                <button
                  @click.stop="openProductPicker(item)"
                  class="flex items-center gap-1.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 px-3 py-1.5 rounded-lg text-stone-400 hover:text-rewe-600 dark:hover:text-rewe-400 text-xs transition-colors"
                >
                  <Search class="w-3.5 h-3.5" />
                  REWE-Produkt suchen…
                </button>
              </div>
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
        <div class="flex sm:flex-row flex-col sm:flex-wrap gap-2 w-full sm:w-auto">
          <!-- An Bring! senden -->
          <div v-if="shoppingStore.bringStatus?.connected" class="flex items-stretch w-full sm:w-auto">
            <button
              v-if="shoppingStore.openItemsCount > 0"
              @click="sendToBring"
              :disabled="shoppingStore.bringSending"
              class="flex sm:flex-initial flex-1 justify-center items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-5 py-3 rounded-l-xl font-medium text-white transition-colors"
            >
              <Loader2 v-if="shoppingStore.bringSending" class="w-4 h-4 animate-spin" />
              <Send v-else class="w-4 h-4" />
              An Bring! senden
            </button>
            <button
              @click="showBringModal = true"
              class="flex items-center bg-teal-600 hover:bg-teal-700 px-3 font-medium text-white transition-colors"
              :class="shoppingStore.openItemsCount > 0 ? 'rounded-r-xl border-l border-teal-500' : 'rounded-xl py-3'"
              title="Bring!-Einstellungen"
            >
              <Settings class="w-4 h-4" />
            </button>
          </div>
          <button
            v-else
            @click="showBringModal = true"
            class="flex justify-center items-center gap-2 bg-teal-600 hover:bg-teal-700 px-5 py-3 rounded-xl w-full sm:w-auto font-medium text-white transition-colors"
          >
            <Link2 class="w-4 h-4" />
            Bring! verbinden
          </button>

          <!-- Bei REWE bestellen (Split-Button) -->
          <div v-if="reweEnabled && shoppingStore.reweLinkedItems.length" class="flex items-stretch w-full sm:w-auto">
            <button
              @click="handleReweMainAction"
              :disabled="cartScriptLoading"
              class="flex sm:flex-initial flex-1 justify-center items-center gap-2 bg-rewe-500 hover:bg-rewe-600 disabled:opacity-50 px-5 py-3 rounded-l-xl font-medium text-white transition-colors"
            >
              <Loader2 v-if="cartScriptLoading" class="w-4 h-4 animate-spin" />
              <ShoppingCart v-else class="w-4 h-4" />
              Bei REWE bestellen ({{ shoppingStore.reweLinkedItems.length }})
            </button>
            <button
              @click="showReweOrderSettings = true"
              class="flex items-center bg-rewe-500 hover:bg-rewe-600 px-3 border-rewe-400 border-l rounded-r-xl font-medium text-white transition-colors"
              title="Bestell-Einstellungen"
            >
              <Settings class="w-4 h-4" />
            </button>
          </div>
          <button
            @click="completePurchase"
            :disabled="checkedCount === 0"
            class="flex justify-center items-center gap-2 disabled:opacity-50 px-6 py-3 rounded-xl w-full sm:w-auto font-medium text-white transition-colors bg-accent-600 hover:bg-accent-700"
          >
            <ShoppingBag class="w-4 h-4" />
            Einkauf abschließen
          </button>
        </div>
      </div>

      <!-- REWE Einstellungen Modal (Markt + Präferenzen) -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showReweSettings" class="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="showReweSettings = false">
            <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden">

              <!-- Header -->
              <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-700 border-b shrink-0">
                <div>
                  <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">🏪 REWE-Einstellungen</h2>
                  <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">Markt auswählen und Produkt-Präferenzen verwalten</p>
                </div>
                <button @click="showReweSettings = false" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <div class="space-y-5 p-5 overflow-y-auto">

                <!-- Mein REWE-Markt -->
                <div>
                  <h3 class="flex items-center gap-2 mb-3 font-medium text-stone-700 dark:text-stone-300 text-sm">
                    <MapPin class="w-4 h-4 text-rewe-500" />
                    Mein REWE-Markt
                  </h3>

                  <!-- Aktueller Markt -->
                  <div v-if="reweMarketId" class="bg-rewe-50 dark:bg-rewe-900/20 mb-3 p-3 border border-rewe-200 dark:border-rewe-800 rounded-xl">
                    <div class="flex justify-between items-start gap-2">
                      <div class="min-w-0">
                        <span class="font-medium text-stone-800 dark:text-stone-200 text-sm">
                          {{ reweMarketName || 'REWE Markt' }}
                        </span>
                        <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                          <span v-if="reweZipCode">PLZ {{ reweZipCode }} · </span>
                          ID: {{ reweMarketId }}
                        </p>
                      </div>
                      <button
                        @click="resetReweMarket"
                        class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1 rounded-lg text-stone-400 hover:text-stone-600 transition-colors shrink-0"
                        title="REWE-Markt entfernen"
                      >
                        <RotateCcw class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div v-else-if="!reweMarketSettingsLoading" class="bg-amber-50 dark:bg-amber-900/20 mb-3 p-3 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <p class="text-amber-700 dark:text-amber-300 text-xs">
                      ⚠️ Kein REWE-Markt konfiguriert. Bitte PLZ eingeben und Markt auswählen.
                    </p>
                  </div>

                  <!-- Markt-Suche -->
                  <div class="flex gap-2">
                    <input
                      v-model="reweMarketSearch"
                      type="text"
                      placeholder="PLZ eingeben…"
                      @keyup.enter="searchReweMarkets"
                      class="flex-1 bg-stone-50 dark:bg-stone-800 px-3 py-2 border border-stone-300 focus:border-transparent dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-rewe-500 text-stone-800 dark:text-stone-200 placeholder:text-stone-400 text-sm"
                    />
                    <button
                      @click="searchReweMarkets"
                      :disabled="!reweMarketSearch.trim() || reweMarketSearchLoading"
                      class="flex items-center gap-1.5 bg-rewe-500 hover:bg-rewe-600 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors"
                    >
                      <Loader2 v-if="reweMarketSearchLoading" class="w-4 h-4 animate-spin" />
                      <Search v-else class="w-4 h-4" />
                    </button>
                  </div>

                  <!-- Suchergebnisse -->
                  <div v-if="reweMarketResults.length" class="space-y-1.5 mt-3 max-h-48 overflow-y-auto">
                    <button
                      v-for="market in reweMarketResults"
                      :key="market.id"
                      @click="selectReweMarket(market)"
                      :class="[
                        'w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm',
                        reweMarketId === String(market.id)
                          ? 'bg-rewe-50 dark:bg-rewe-900/20 border-rewe-300 dark:border-rewe-700 ring-1 ring-rewe-300 dark:ring-rewe-700'
                          : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-rewe-300 dark:hover:border-rewe-600'
                      ]"
                    >
                      <div class="flex justify-between items-start gap-2">
                        <div class="min-w-0">
                          <span class="font-medium text-stone-800 dark:text-stone-200">{{ market.name }}</span>
                          <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                            {{ market.street }}, {{ market.zipCode }} {{ market.city }}
                          </p>
                        </div>
                        <div class="flex flex-col items-end gap-0.5 shrink-0">
                          <span class="bg-stone-200 dark:bg-stone-700 px-2 py-0.5 rounded font-mono text-[10px] text-stone-500 dark:text-stone-400">
                            ID: {{ market.id }}
                          </span>
                          <span v-if="market.distance != null" class="text-[10px] text-stone-400 dark:text-stone-500">
                            {{ market.distance >= 1000 ? (market.distance / 1000).toFixed(1) + ' km' : market.distance + ' m' }}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                  <p v-if="reweMarketSearchError" class="mt-2 text-amber-600 dark:text-amber-400 text-xs">
                    {{ reweMarketSearchError }}
                  </p>
                </div>

                <!-- Trennlinie -->
                <div class="border-stone-200 dark:border-stone-700 border-t"></div>

                <!-- Bevorzugte Produkte -->
                <button
                  @click="showReweSettings = false; openRewePreferences()"
                  class="group flex items-center gap-3 bg-stone-50 hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 p-4 border border-stone-200 dark:border-stone-700 rounded-xl w-full text-left transition-colors"
                >
                  <div class="flex justify-center items-center bg-rewe-100 dark:bg-rewe-900/30 rounded-lg w-10 h-10 shrink-0">
                    <Star class="w-5 h-5 text-rewe-500" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="font-medium text-stone-800 dark:text-stone-200 text-sm">Bevorzugte Produkte</span>
                    <p class="text-stone-500 dark:text-stone-400 text-xs">Gespeicherte Zuordnungen von Zutaten zu REWE-Produkten verwalten</p>
                  </div>
                  <ChevronRight class="w-4 h-4 text-stone-400 dark:group-hover:text-stone-300 group-hover:text-stone-600 transition-colors shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- REWE Bestell-Einstellungen Modal -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showReweOrderSettings" class="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="showReweOrderSettings = false">
            <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden">

              <!-- Header -->
              <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-700 border-b shrink-0">
                <div>
                  <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">🛒 Bestell-Einstellungen</h2>
                  <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">Bestell-Methode und Userscript verwalten</p>
                </div>
                <button @click="showReweOrderSettings = false" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <div class="space-y-5 p-5 overflow-y-auto">

                <!-- Bestell-Methode wählen -->
                <div>
                  <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Bestell-Methode</label>
                  <div class="space-y-2">
                    <label
                      v-for="opt in reweActionOptions"
                      :key="opt.value"
                      :class="[
                        'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                        reweAction === opt.value
                          ? 'bg-rewe-50 dark:bg-rewe-900/20 border-rewe-300 dark:border-rewe-700'
                          : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
                      ]"
                    >
                      <input
                        type="radio"
                        :value="opt.value"
                        v-model="reweAction"
                        @change="saveReweSettings"
                        class="mt-0.5 accent-rewe-600"
                      />
                      <div>
                        <span class="font-medium text-stone-800 dark:text-stone-200 text-sm">{{ opt.icon }} {{ opt.label }}</span>
                        <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">{{ opt.description }}</p>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Vorschau-Option -->
                <label class="flex items-center gap-3 cursor-pointer select-none">
                  <div class="relative">
                    <input type="checkbox" v-model="reweShowPreview" @change="saveReweSettings" class="sr-only peer" />
                    <div class="bg-stone-200 dark:bg-stone-700 peer-checked:bg-rewe-500 rounded-full w-10 h-5 transition-colors"></div>
                    <div class="top-0.5 left-0.5 absolute bg-white rounded-full w-4 h-4 transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <div>
                    <span class="font-medium text-stone-700 dark:text-stone-300 text-sm">Vorschau anzeigen</span>
                    <p class="text-stone-400 dark:text-stone-500 text-xs">Produkt-Übersicht vor dem Bestellen zeigen</p>
                  </div>
                </label>

                <!-- Trennlinie -->
                <div class="border-stone-200 dark:border-stone-700 border-t"></div>

                <!-- Userscript-Bereich -->
                <div>
                  <h3 class="mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">🧩 Tampermonkey Userscript</h3>
                  <p class="mb-3 text-stone-500 dark:text-stone-400 text-xs leading-relaxed">
                    Einmal installieren – dann legt der 🍳-Button auf rewe.de deine Einkaufsliste direkt in den Warenkorb.
                  </p>
                  <div class="flex gap-2">
                    <button
                      @click="installUserscript"
                      class="flex flex-1 justify-center items-center gap-2 bg-purple-600 hover:bg-purple-700 py-2.5 rounded-xl font-medium text-white text-sm transition-colors"
                    >
                      <Download class="w-3.5 h-3.5" />
                      Userscript installieren
                    </button>
                    <button
                      @click="regenerateToken"
                      class="flex items-center gap-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 px-3 py-2.5 rounded-xl font-medium text-stone-700 dark:text-stone-300 text-sm transition-colors"
                      title="Neues API-Token für das Userscript erzeugen und Userscript neu installieren"
                    >
                      <RefreshCw class="w-3.5 h-3.5" />
                      Token erneuern
                    </button>
                  </div>
                  <p class="mt-2 text-[10px] text-stone-400 dark:text-stone-500 text-center">
                    ℹ️ Das Userscript enthält deinen Login-Token. Bei Ablauf hier „Token erneuern" klicken.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- REWE Produkt-Präferenzen Modal -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showRewePreferences" class="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="showRewePreferences = false">
            <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden">

              <!-- Header -->
              <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-700 border-b shrink-0">
                <div>
                  <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">🏪 Bevorzugte Produkte</h2>
                  <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                    {{ rewePreferences.length }} gespeicherte Zuordnungen
                  </p>
                </div>
                <button @click="showRewePreferences = false" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Suche -->
              <div class="px-4 pt-3 shrink-0" v-if="rewePreferences.length > 5">
                <div class="relative">
                  <Search class="top-1/2 left-3 absolute w-4 h-4 text-stone-400 -translate-y-1/2" />
                  <input
                    v-model="prefSearch"
                    type="text"
                    placeholder="Zutat suchen…"
                    class="bg-stone-50 dark:bg-stone-800 py-2 pr-4 pl-9 border border-stone-200 dark:border-stone-700 rounded-lg outline-none w-full text-sm"
                  />
                </div>
              </div>

              <!-- Liste -->
              <div class="flex-1 overflow-y-auto">
                <div v-if="rewePreferencesLoading" class="flex justify-center py-12">
                  <Loader2 class="w-6 h-6 text-stone-400 animate-spin" />
                </div>

                <div v-else-if="filteredPreferences.length === 0" class="px-5 py-12 text-center">
                  <Package class="mx-auto mb-3 w-12 h-12 text-stone-300 dark:text-stone-600" />
                  <p class="font-medium text-stone-500 dark:text-stone-400 text-sm">
                    {{ rewePreferences.length === 0 ? 'Noch keine Zuordnungen gespeichert' : 'Keine Treffer' }}
                  </p>
                  <p v-if="rewePreferences.length === 0" class="mt-1 text-stone-400 dark:text-stone-500 text-xs">
                    Beim REWE-Abgleich werden deine Produktauswahlen automatisch gespeichert.
                  </p>
                </div>

                <div v-else class="divide-y divide-stone-100 dark:divide-stone-800">
                  <div
                    v-for="pref in filteredPreferences"
                    :key="pref.id"
                    class="flex items-start gap-3 px-4 py-3 transition-colors"
                  >
                    <!-- Produktbild -->
                    <img
                      v-if="pref.rewe_image_url"
                      :src="pref.rewe_image_url"
                      :alt="pref.rewe_product_name"
                      class="rounded-lg w-12 h-12 object-contain shrink-0"
                    />
                    <div v-else class="flex justify-center items-center bg-stone-100 dark:bg-stone-800 rounded-lg w-12 h-12 text-xl shrink-0">🏪</div>

                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-stone-800 dark:text-stone-200 text-sm capitalize">{{ pref.ingredient_name }}</p>
                      <a
                        v-if="pref.rewe_product_id"
                        :href="reweProductUrl(pref.rewe_product_name, pref.rewe_product_id)"
                        target="_blank"
                        rel="noopener"
                        class="block mt-0.5 text-stone-500 hover:text-rewe-600 dark:hover:text-rewe-400 dark:text-stone-400 text-xs truncate transition-colors"
                      >
                        → {{ pref.rewe_product_name }}
                        <ExternalLink class="inline-block -mt-0.5 ml-0.5 w-3 h-3" />
                      </a>
                      <p v-else class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs truncate">
                        → {{ pref.rewe_product_name }}
                      </p>
                      <div class="flex items-center gap-3 mt-1">
                        <span v-if="pref.rewe_price" class="font-medium text-stone-600 dark:text-stone-300 text-xs">{{ formatPrice(pref.rewe_price) }}</span>
                        <span v-if="pref.rewe_package_size" class="text-[11px] text-stone-400 dark:text-stone-500">{{ pref.rewe_package_size }}</span>
                        <span class="text-[11px] text-stone-400 dark:text-stone-500">{{ pref.times_selected }}× gewählt</span>
                      </div>
                    </div>

                    <!-- Aktionen -->
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        @click="startChangePref(pref)"
                        class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 hover:text-rewe-600 transition-colors"
                        title="Anderes Produkt wählen"
                      >
                        <ArrowRightLeft class="w-4 h-4" />
                      </button>
                      <button
                        @click="removePref(pref)"
                        class="hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg text-stone-400 hover:text-red-500 transition-colors"
                        title="Zuordnung vergessen"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div v-if="rewePreferences.length > 0" class="flex justify-between items-center px-5 py-3 border-stone-200 dark:border-stone-700 border-t shrink-0">
                <button
                  @click="clearAllPrefs"
                  class="flex items-center gap-1.5 text-red-500 hover:text-red-600 text-sm transition-colors"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  Alle zurücksetzen
                </button>
                <button
                  @click="showRewePreferences = false"
                  class="bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-4 py-2 rounded-lg font-medium text-stone-700 dark:text-stone-300 text-sm transition-colors"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Präferenz ändern: Produkt-Suche (Inline-Overlay) -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="changingPref" class="z-[60] fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="changingPref = null">
            <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden">
              <!-- Header -->
              <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-700 border-b shrink-0">
                <div>
                  <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-base">Produkt ändern</h2>
                  <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs capitalize">{{ changingPref.ingredient_name }}</p>
                </div>
                <button @click="changingPref = null" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Suche -->
              <div class="px-4 pt-3 shrink-0">
                <div class="relative">
                  <Search class="top-1/2 left-3 absolute w-4 h-4 text-stone-400 -translate-y-1/2" />
                  <input
                    ref="prefProductSearchInput"
                    v-model="prefProductQuery"
                    @input="debouncedPrefSearch"
                    type="text"
                    placeholder="REWE-Produkt suchen…"
                    class="bg-stone-50 dark:bg-stone-800 py-2 pr-4 pl-9 border border-stone-200 dark:border-stone-700 rounded-lg outline-none w-full text-sm"
                  />
                </div>
              </div>

              <!-- Ergebnisse -->
              <div class="flex-1 overflow-y-auto">
                <div v-if="prefProductSearching" class="flex justify-center py-8">
                  <Loader2 class="w-5 h-5 text-stone-400 animate-spin" />
                </div>
                <div v-else-if="prefProductResults.length === 0 && prefProductQuery" class="px-5 py-8 text-center">
                  <p class="text-stone-400 text-sm">Keine Produkte gefunden.</p>
                </div>
                <div v-else class="divide-y divide-stone-100 dark:divide-stone-800">
                  <button
                    v-for="product in prefProductResults"
                    :key="product.id"
                    @click="selectPrefProduct(product)"
                    class="flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800 px-4 py-3 w-full text-left transition-colors"
                  >
                    <img
                      v-if="product.imageUrl"
                      :src="product.imageUrl"
                      :alt="product.name"
                      class="rounded-lg w-10 h-10 object-contain shrink-0"
                    />
                    <div v-else class="flex justify-center items-center bg-stone-100 dark:bg-stone-800 rounded-lg w-10 h-10 text-lg shrink-0">🏪</div>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-stone-800 dark:text-stone-200 text-sm truncate">{{ product.name }}</p>
                      <p class="text-stone-400 dark:text-stone-500 text-xs">{{ product.packageSize }}</p>
                    </div>
                    <span class="font-semibold text-stone-700 dark:text-stone-200 text-sm shrink-0">{{ formatPrice(product.price) }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- REWE Vorschau-Modal -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showRewePreview" class="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="showRewePreview = false">
            <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
              <!-- Header -->
              <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-700 border-b">
                <div>
                  <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">🏪 REWE-Bestellung</h2>
                  <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                    {{ shoppingStore.reweLinkedItems.length }} Produkte · {{ formatPrice(estimatedTotal) }}
                  </p>
                </div>
                <button @click="showRewePreview = false" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Produktliste -->
              <div class="flex-1 divide-y divide-stone-100 dark:divide-stone-800 overflow-y-auto">
                <div
                  v-for="item in shoppingStore.reweLinkedItems"
                  :key="item.id"
                  class="flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/30 px-5 py-3 transition-colors"
                >
                  <!-- Produktbild -->
                  <div class="flex justify-center items-center bg-white dark:bg-stone-700 rounded-lg w-10 h-10 overflow-hidden shrink-0">
                    <img
                      v-if="item.rewe_product.imageUrl"
                      :src="item.rewe_product.imageUrl"
                      :alt="item.rewe_product.name"
                      class="w-full h-full object-contain"
                      loading="lazy"
                    />
                    <span v-else class="text-lg">🏪</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-stone-800 dark:text-stone-200 text-sm truncate">{{ item.ingredient_name }}</p>
                    <p class="text-stone-500 dark:text-stone-400 text-xs truncate">
                      <span v-if="item.rewe_product.quantity > 1" class="font-semibold text-rewe-500">{{ item.rewe_product.quantity }}×</span>
                      {{ item.rewe_product.name }}
                    </p>
                    <p v-if="item.rewe_product.packageSize" class="text-[10px] text-stone-400 dark:text-stone-500">{{ item.rewe_product.packageSize }}</p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="font-semibold tabular-nums text-stone-700 dark:text-stone-300 text-sm">{{ formatPrice(item.rewe_product.price * (item.rewe_product.quantity || 1)) }}</span>
                    <a
                      :href="item.rewe_product.url"
                      target="_blank"
                      rel="noopener"
                      class="flex items-center gap-1 bg-rewe-50 hover:bg-rewe-100 dark:bg-rewe-900/30 dark:hover:bg-rewe-900/50 px-2.5 py-1.5 rounded-lg font-medium text-rewe-600 dark:text-rewe-400 text-xs transition-colors"
                    >
                      <ExternalLink class="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              <!-- Footer mit Aktions-Button -->
              <div class="bg-stone-50 dark:bg-stone-800/50 px-5 py-4 border-stone-200 dark:border-stone-700 border-t">
                <button
                  @click="executeReweAction"
                  :disabled="cartScriptLoading"
                  class="flex justify-center items-center gap-2 bg-rewe-500 hover:bg-rewe-600 disabled:opacity-50 py-3 rounded-xl w-full font-medium text-white transition-colors"
                >
                  <Loader2 v-if="cartScriptLoading" class="w-4 h-4 animate-spin" />
                  <component v-else :is="currentReweActionIcon" class="w-4 h-4" />
                  {{ currentReweActionLabel }}
                </button>
                <p class="mt-2 text-[10px] text-stone-400 dark:text-stone-500 text-center">
                  Geschätzte Kosten: {{ formatPrice(estimatedTotal) }}
                </p>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- REWE Produkt-Picker Modal -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="pickerItem" class="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="closeProductPicker">
            <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">

              <!-- Header -->
              <div class="px-5 py-4 border-stone-200 dark:border-stone-700 border-b">
                <div class="flex justify-between items-start">
                  <div>
                    <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
                      <Search class="inline -mt-0.5 mr-1 w-4 h-4" />
                      Produkt wählen
                    </h2>
                    <p class="mt-1 text-stone-500 dark:text-stone-400 text-sm">
                      {{ pickerItem.ingredient_name }}
                      <span v-if="pickerItem.amount" class="text-stone-400 dark:text-stone-500">
                        · {{ pickerItem.amount }}{{ pickerItem.unit ? ' ' + pickerItem.unit : '' }}
                      </span>
                    </p>
                  </div>
                  <button @click="closeProductPicker" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                    <X class="w-5 h-5" />
                  </button>
                </div>
                <!-- Aktuell zugewiesenes Produkt -->
                <div v-if="pickerItem.rewe_product" class="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 mt-2 px-2.5 py-1.5 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-xs">
                  <Check class="w-3 h-3 shrink-0" />
                  Aktuell: <span v-if="pickerItem.rewe_product.quantity > 1">{{ pickerItem.rewe_product.quantity }}× </span>{{ pickerItem.rewe_product.name }} – {{ formatPrice(pickerItem.rewe_product.price * (pickerItem.rewe_product.quantity || 1)) }}
                </div>
                <!-- Suchfeld -->
                <form @submit.prevent="searchInPicker" class="flex gap-2 mt-3">
                  <div class="relative flex-1">
                    <Search class="top-1/2 left-3 absolute w-4 h-4 text-stone-400 -translate-y-1/2 pointer-events-none" />
                    <input
                      v-model="pickerSearch"
                      type="text"
                      placeholder="Suchbegriff ändern…"
                      class="bg-stone-50 dark:bg-stone-800 py-2 pr-3 pl-9 border border-stone-300 focus:border-transparent dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-rewe-500 w-full text-stone-800 dark:text-stone-200 placeholder:text-stone-400 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    :disabled="pickerLoading || pickerSearch.trim().length < 2"
                    class="bg-rewe-500 hover:bg-rewe-600 disabled:opacity-50 px-3 py-2 rounded-lg font-medium text-white text-sm transition-colors shrink-0"
                  >
                    Suchen
                  </button>
                </form>
              </div>

              <!-- Produktliste -->
              <div class="flex-1 overflow-y-auto">
                <!-- Ladezustand -->
                <div v-if="pickerLoading" class="flex flex-col items-center gap-3 py-12">
                  <div class="border-2 border-rewe-200 border-t-rewe-600 rounded-full w-8 h-8 animate-spin" />
                  <p class="text-stone-500 dark:text-stone-400 text-sm">Suche bei REWE…</p>
                </div>

                <!-- Keine Ergebnisse -->
                <div v-else-if="pickerProducts.length === 0" class="py-12 text-center">
                  <div class="mb-2 text-4xl">🔍</div>
                  <p class="text-stone-500 dark:text-stone-400 text-sm">Keine Produkte gefunden.</p>
                </div>

                <!-- Ergebnisliste -->
                <div v-else class="divide-y divide-stone-100 dark:divide-stone-800">
                  <button
                    v-for="(product, idx) in pickerProducts"
                    :key="product.id"
                    @click="selectProduct(product)"
                    class="group flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/40 px-5 py-3 w-full text-left transition-colors"
                    :class="{
                      'bg-green-50/50 dark:bg-green-900/10': pickerItem.rewe_product?.id === product.id,
                    }"
                  >
                    <!-- Produktbild -->
                    <div class="flex justify-center items-center bg-white dark:bg-stone-700 border border-stone-100 dark:border-stone-600 rounded-lg w-12 h-12 overflow-hidden shrink-0">
                      <img
                        v-if="product.imageUrl"
                        :src="product.imageUrl"
                        :alt="product.name"
                        class="w-full h-full object-contain"
                        loading="lazy"
                      />
                      <div v-else class="flex justify-center items-center rounded-full w-7 h-7 font-bold text-xs shrink-0"
                        :class="idx === 0
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'"
                      >
                        <Tag v-if="idx === 0" class="w-3.5 h-3.5" />
                        <span v-else>{{ idx + 1 }}</span>
                      </div>
                    </div>

                    <!-- Produktinfo -->
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-stone-800 dark:group-hover:text-rewe-400 dark:text-stone-200 group-hover:text-rewe-600 text-sm truncate transition-colors">
                        {{ product.name }}
                      </p>
                      <p class="flex items-center gap-2 mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                        <span v-if="product.packageSize">{{ product.packageSize }}</span>
                        <span v-if="idx === 0" class="inline-flex items-center gap-0.5 bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded font-medium text-[10px] text-green-700 dark:text-green-400">
                          Relevantester
                        </span>
                        <span v-if="pickerItem.rewe_product?.id === product.id" class="inline-flex items-center gap-0.5 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded font-medium text-[10px] text-blue-700 dark:text-blue-400">
                          <Check class="w-2.5 h-2.5" /> Ausgewählt
                        </span>
                      </p>
                    </div>

                    <!-- Preis -->
                    <div class="text-right shrink-0">
                      <p class="font-bold tabular-nums text-sm"
                        :class="idx === 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-stone-700 dark:text-stone-300'"
                      >
                        {{ formatPrice(product.price) }}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Footer -->
              <div class="bg-stone-50 dark:bg-stone-800/50 px-5 py-3 border-stone-200 dark:border-stone-700 border-t">
                <p class="text-[10px] text-stone-400 dark:text-stone-500 text-center">
                  <Heart class="inline -mt-0.5 mr-0.5 w-3 h-3" />
                  Deine Auswahl wird gespeichert und beim nächsten Matching automatisch verwendet.
                </p>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Bring! Verbinden / Verwalten Modal -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showBringModal" class="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="showBringModal = false">
            <div class="bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden">

              <!-- Header -->
              <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-700 border-b">
                <div>
                  <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
                    🛍️ Bring! Einkaufsliste
                  </h2>
                  <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                    Sende deine Einkaufsliste direkt an die Bring!-App.
                  </p>
                </div>
                <button @click="showBringModal = false" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Verbunden: Status + Listen-Auswahl -->
              <div v-if="shoppingStore.bringStatus?.connected" class="space-y-4 p-5">
                <div class="flex items-center gap-3 bg-teal-50 dark:bg-teal-900/20 px-4 py-3 border border-teal-200 dark:border-teal-800 rounded-xl">
                  <div class="flex justify-center items-center bg-teal-500 rounded-full w-8 h-8 text-white shrink-0">
                    <Check class="w-4 h-4" />
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium text-teal-800 dark:text-teal-300 text-sm">Verbunden</p>
                    <p class="text-teal-600 dark:text-teal-400 text-xs truncate">{{ shoppingStore.bringStatus.email }}</p>
                  </div>
                </div>

                <!-- Listenauswahl -->
                <div>
                  <label class="block mb-1.5 font-medium text-stone-600 dark:text-stone-400 text-sm">
                    Bring!-Liste
                  </label>
                  <div class="relative">
                    <select
                      v-model="selectedBringList"
                      @change="changeBringList"
                      class="bg-stone-50 dark:bg-stone-800 px-3 py-2.5 pr-10 border border-stone-300 dark:border-stone-600 rounded-lg w-full text-stone-800 dark:text-stone-200 text-sm appearance-none"
                    >
                      <option v-for="list in shoppingStore.bringLists" :key="list.uuid" :value="list.uuid">
                        {{ list.name }}
                      </option>
                    </select>
                    <ChevronDown class="top-1/2 right-3 absolute w-4 h-4 text-stone-400 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <!-- Senden + Importieren Buttons -->
                <div class="flex gap-2">
                  <button
                    @click="sendToBring"
                    :disabled="shoppingStore.bringSending || shoppingStore.openItemsCount === 0"
                    class="flex flex-1 justify-center items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 py-3 rounded-xl font-medium text-white transition-colors"
                  >
                    <Loader2 v-if="shoppingStore.bringSending" class="w-4 h-4 animate-spin" />
                    <Send v-else class="w-4 h-4" />
                    {{ shoppingStore.openItemsCount }} senden
                  </button>
                  <button
                    @click="importFromBring"
                    :disabled="shoppingStore.bringImporting"
                    class="flex flex-1 justify-center items-center gap-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 disabled:opacity-50 py-3 border border-stone-300 dark:border-stone-600 rounded-xl font-medium text-stone-700 dark:text-stone-300 transition-colors"
                  >
                    <Loader2 v-if="shoppingStore.bringImporting" class="w-4 h-4 animate-spin" />
                    <Download v-else class="w-4 h-4" />
                    Importieren
                  </button>
                </div>

                <!-- Trennen -->
                <button
                  @click="disconnectBring"
                  class="flex justify-center items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 py-2 rounded-lg w-full text-red-500 text-sm transition-colors"
                >
                  <Unlink class="w-3.5 h-3.5" />
                  Verbindung trennen
                </button>
              </div>

              <!-- Nicht verbunden: Login-Formular -->
              <form v-else @submit.prevent="connectBring" class="space-y-4 p-5">
                <p class="text-stone-500 dark:text-stone-400 text-sm">
                  Melde dich mit deinem Bring!-Account an, um Einkaufslisten direkt an die App zu senden.
                </p>
                <div>
                  <label class="block mb-1 font-medium text-stone-600 dark:text-stone-400 text-sm">E-Mail</label>
                  <input
                    v-model="bringEmail"
                    type="email"
                    placeholder="deine@email.de"
                    required
                    autocomplete="email"
                    class="bg-stone-50 dark:bg-stone-800 px-3 py-2.5 border border-stone-300 focus:border-transparent dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-teal-500 w-full text-stone-800 dark:text-stone-200 placeholder:text-stone-400 text-sm"
                  />
                </div>
                <div>
                  <label class="block mb-1 font-medium text-stone-600 dark:text-stone-400 text-sm">Passwort</label>
                  <input
                    v-model="bringPassword"
                    type="password"
                    placeholder="Bring!-Passwort"
                    required
                    autocomplete="current-password"
                    class="bg-stone-50 dark:bg-stone-800 px-3 py-2.5 border border-stone-300 focus:border-transparent dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-teal-500 w-full text-stone-800 dark:text-stone-200 placeholder:text-stone-400 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  :disabled="bringConnecting || !bringEmail.trim() || !bringPassword"
                  class="flex justify-center items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 py-3 rounded-xl w-full font-medium text-white transition-colors"
                >
                  <Loader2 v-if="bringConnecting" class="w-4 h-4 animate-spin" />
                  <LogIn v-else class="w-4 h-4" />
                  Verbinden
                </button>
                <p class="text-[10px] text-stone-400 dark:text-stone-500 text-center">
                  🔒 Dein Passwort wird verschlüsselt gespeichert und nur zur Kommunikation mit Bring! verwendet.
                </p>
              </form>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- REWE Warenkorb-Script Modal -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showCartScript" class="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="showCartScript = false">
            <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
              <!-- Header -->
              <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-700 border-b">
                <div>
                  <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">🛒 REWE Warenkorb-Script</h2>
                  <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">Automatisch Produkte in den Warenkorb legen</p>
                </div>
                <button @click="showCartScript = false" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Anleitung -->
              <div class="flex-1 space-y-4 p-5 overflow-y-auto">
                <div class="bg-amber-50 dark:bg-amber-900/20 px-4 py-3 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-sm">
                  <p class="mb-1 font-semibold">⚡ So funktioniert's:</p>
                  <ol class="space-y-1.5 text-xs list-decimal list-inside">
                    <li>Öffne <a href="https://www.rewe.de/shop/" target="_blank" rel="noopener" class="font-medium underline hover:no-underline">www.rewe.de/shop</a> und logge dich ein</li>
                    <li>Wähle deinen Markt bzw. dein Liefergebiet aus</li>
                    <li>Öffne die Browser-Konsole: <kbd class="bg-amber-200/60 dark:bg-amber-800/60 px-1 py-0.5 rounded font-mono text-[11px]">F12</kbd> → Tab „Konsole"</li>
                    <li>Kopiere das Script unten und füge es in die Konsole ein</li>
                    <li>Drücke <kbd class="bg-amber-200/60 dark:bg-amber-800/60 px-1 py-0.5 rounded font-mono text-[11px]">Enter</kbd> und warte kurz</li>
                  </ol>
                </div>

                <div class="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-800 dark:text-blue-300 text-xs">
                  <p class="mb-1 font-semibold">💡 Wie funktioniert das Script?</p>
                  <p>Das Script lädt für jedes Produkt die Produktseite, ermittelt daraus die marktspezifische <em>Listing-ID</em> und fügt es direkt über die REWE Basket-API in deinen Warenkorb ein. Falls die Listing-ID nicht gefunden wird, öffnet sich ein Popup als Fallback.</p>
                </div>

                <!-- Script zum Kopieren -->
                <div class="relative">
                  <pre class="bg-stone-900 dark:bg-stone-950 p-4 rounded-xl max-h-48 overflow-auto font-mono text-[11px] text-green-400 break-all leading-relaxed whitespace-pre-wrap select-all">{{ cartScript }}</pre>
                  <button
                    @click="copyCartScript"
                    :class="[
                      'absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      cartScriptCopied
                        ? 'bg-green-600 text-white'
                        : 'bg-stone-700 hover:bg-stone-600 text-stone-300'
                    ]"
                  >
                    <ClipboardCopy class="w-3.5 h-3.5" />
                    {{ cartScriptCopied ? 'Kopiert!' : 'Kopieren' }}
                  </button>
                </div>

                <p class="text-[10px] text-stone-400 dark:text-stone-500 text-center">
                  ⚠️ Experimentelles Feature – funktioniert nur auf www.rewe.de (eingeloggt, Markt gewählt).
                  Das Script nutzt die REWE Basket-API mit Listing-IDs. Keine Garantie.
                </p>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>

    <!-- Keine Liste vorhanden -->
    <div v-else-if="!shoppingStore.loading" class="py-10 text-center">
      <div class="mb-4 text-6xl">🛒</div>
      <h2 class="mb-2 font-semibold text-stone-700 dark:text-stone-300 text-xl">Keine aktive Einkaufsliste</h2>
      <p class="mx-auto mb-6 max-w-md text-stone-500 dark:text-stone-400">
        Erstelle eine Einkaufsliste aus deinem Wochenplan. Vorhandene Vorräte werden automatisch berücksichtigt.
      </p>

      <!-- Verlauf: vorherige Listen -->
      <div v-if="shoppingStore.listHistory.length > 0" class="mx-auto max-w-lg text-left">
        <h3 class="flex items-center gap-2 mb-3 font-semibold text-stone-600 dark:text-stone-400 text-sm">
          <History class="w-4 h-4" />
          Vorherige Einkaufslisten
        </h3>
        <div class="space-y-2">
          <div
            v-for="hl in shoppingStore.listHistory.slice(0, 10)"
            :key="hl.id"
            class="flex items-center gap-3 bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800 px-4 py-3 border border-stone-200 dark:border-stone-800 rounded-xl transition-colors cursor-pointer"
            @click="reactivateHistoryList(hl.id)"
          >
            <div class="flex-1 min-w-0">
              <p class="font-medium text-stone-700 dark:text-stone-200 text-sm truncate">
                {{ hl.name || 'Einkaufsliste' }}
              </p>
              <p class="text-stone-400 dark:text-stone-500 text-xs">
                {{ formatHistoryDate(hl.created_at) }}
                · {{ hl.checked_count || 0 }}/{{ hl.item_count || 0 }} erledigt
              </p>
            </div>
            <button
              class="flex items-center gap-1.5 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 px-3 py-1.5 rounded-lg font-medium text-primary-700 dark:text-primary-300 text-xs transition-colors shrink-0"
              @click.stop="reactivateHistoryList(hl.id)"
            >
              <RotateCcw class="w-3.5 h-3.5" />
              Laden
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Laden -->
    <div v-else class="flex justify-center py-16">
      <div class="border-2 border-primary-200 border-t-primary-600 rounded-full w-8 h-8 animate-spin" />
    </div>

    <!-- "Einkauf abschließen?"-Dialog nach Bring!/REWE -->
    <ConfirmDialog
      v-model="showCompletePurchasePrompt"
      variant="success"
      title="Einkauf abschließen?"
      message="Die Artikel wurden erfolgreich übermittelt. Soll der Einkauf jetzt abgeschlossen und die Zutaten in den Vorratsschrank übernommen werden?"
      confirm-text="Ja, abschließen 🎉"
      cancel-text="Nein, noch nicht"
      @confirm="confirmCompletePurchase"
    />

    <!-- Merge-Dialog -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showMergeDialog" class="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="cancelMerge">
          <div class="bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden">
            <!-- Header -->
            <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-700 border-b">
              <h2 class="flex items-center gap-2 font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
                <Merge class="w-5 h-5 text-violet-600" />
                {{ mergeSelection.length }} Zutaten zusammenfassen
              </h2>
              <button @click="cancelMerge" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                <X class="w-5 h-5" />
              </button>
            </div>
            <div class="space-y-4 p-5">
              <p class="text-stone-600 dark:text-stone-300 text-sm">Welchen Namen soll die zusammengefasste Zutat tragen?</p>
              <!-- Dynamische Optionen aus allen ausgewählten Items (unique names) -->
              <label
                v-for="name in mergeUniqueNames"
                :key="name"
                :class="[
                  'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                  mergeName === name
                    ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700'
                    : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-stone-300'
                ]"
              >
                <input type="radio" :value="name" v-model="mergeName" class="accent-violet-600" />
                <div>
                  <p class="font-medium text-stone-800 dark:text-stone-200 text-sm">{{ name }}</p>
                  <p class="text-stone-400 text-xs">
                    {{ mergeSelection.filter(s => s.ingredient_name === name).map(s => `${s.amount || '–'} ${s.unit || ''}`).join(', ') }}
                  </p>
                </div>
              </label>
              <!-- Info -->
              <div class="bg-stone-50 dark:bg-stone-800 px-3 py-2 rounded-lg text-stone-500 dark:text-stone-400 text-xs">
                💡 Die Zusammenfassung wird gespeichert und künftig bei neuen Einkaufslisten automatisch angewandt.
              </div>
              <!-- Aktionen -->
              <div class="flex gap-2">
                <button @click="cancelMerge" class="flex-1 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 py-2.5 rounded-xl font-medium text-stone-700 dark:text-stone-300 text-sm transition-colors">
                  Abbrechen
                </button>
                <button @click="confirmMerge" class="flex-1 bg-violet-600 hover:bg-violet-700 py-2.5 rounded-xl font-medium text-white text-sm transition-colors">
                  Zusammenfassen
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Zusammenfassungen verwalten (nur Aliase) -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showAliasManager" class="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="showAliasManager = false">
          <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <!-- Header -->
            <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-700 border-b shrink-0">
              <div>
                <h2 class="flex items-center gap-2 font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
                  <Merge class="w-5 h-5 text-violet-600" />
                  Zusammenfassungen
                </h2>
                <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                  {{ aliasStore.aliases.length }} gespeicherte Regeln
                </p>
              </div>
              <button @click="showAliasManager = false" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Aliase-Liste -->
            <div class="flex-1 p-4 overflow-y-auto">
              <div v-if="aliasStore.aliases.length === 0" class="py-8 text-stone-400 dark:text-stone-500 text-sm text-center">
                <Merge class="mx-auto mb-2 w-8 h-8 text-stone-300 dark:text-stone-600" />
                <p>Keine Zusammenfassungen vorhanden.</p>
                <p class="mt-1 text-xs">Nutze den „Zusammenfassen"-Button, um ähnliche Zutaten zu vereinen.</p>
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="alias in aliasStore.aliases"
                  :key="alias.id"
                  class="flex justify-between items-center bg-stone-50 dark:bg-stone-800 px-4 py-3 rounded-xl"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-stone-500 dark:text-stone-400 text-sm truncate">{{ alias.alias_name }}</span>
                    <ArrowRight class="w-3.5 h-3.5 text-stone-300 dark:text-stone-600 shrink-0" />
                    <span class="font-medium text-stone-800 dark:text-stone-200 text-sm truncate">{{ alias.canonical_name }}</span>
                  </div>
                  <button
                    @click="deleteAlias(alias)"
                    class="hover:bg-red-50 dark:hover:bg-red-900/30 ml-2 p-1.5 rounded-lg text-stone-300 hover:text-red-500 dark:hover:text-red-400 dark:text-stone-600 transition-all shrink-0"
                    title="Zusammenfassung löschen"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Blockierte Zutaten verwalten -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showBlockManager" class="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="showBlockManager = false">
          <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <!-- Header -->
            <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-700 border-b shrink-0">
              <div>
                <h2 class="flex items-center gap-2 font-display font-bold text-stone-800 dark:text-stone-100 text-lg">
                  <Ban class="w-5 h-5 text-red-500" />
                  Blockierte Zutaten
                </h2>
                <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                  {{ aliasStore.blockedIngredients.length }} blockiert – erscheinen nicht in neuen Listen
                </p>
              </div>
              <button @click="showBlockManager = false" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Blockliste -->
            <div class="flex-1 p-4 overflow-y-auto">
              <div v-if="aliasStore.blockedIngredients.length === 0" class="py-8 text-stone-400 dark:text-stone-500 text-sm text-center">
                <Ban class="mx-auto mb-2 w-8 h-8 text-stone-300 dark:text-stone-600" />
                <p>Keine blockierten Zutaten.</p>
                <p class="mt-1 text-xs">Nutze den „Blockieren"-Button, um Zutaten aus zukünftigen Listen auszuschließen.</p>
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="blocked in aliasStore.blockedIngredients"
                  :key="blocked.id"
                  class="flex justify-between items-center bg-red-50 dark:bg-red-900/10 px-4 py-3 border border-red-100 dark:border-red-900/30 rounded-xl"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <Ban class="w-3.5 h-3.5 text-red-400 dark:text-red-500 shrink-0" />
                    <span class="font-medium text-stone-800 dark:text-stone-200 text-sm truncate">{{ blocked.ingredient_name }}</span>
                  </div>
                  <button
                    @click="unblockIngredient(blocked)"
                    class="hover:bg-green-50 dark:hover:bg-green-900/30 ml-2 px-2.5 py-1 rounded-lg font-medium text-green-600 hover:text-green-700 dark:hover:text-green-300 dark:text-green-400 text-xs transition-all shrink-0"
                    title="Block aufheben"
                  >
                    Freigeben
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch, nextTick } from 'vue';
import { useShoppingStore } from '@/stores/shopping.js';
import { useMealPlanStore } from '@/stores/mealplan.js';
import { useIngredientAliasStore } from '@/stores/ingredient-aliases.js';
import { useNotification } from '@/composables/useNotification.js';
import { useApi } from '@/composables/useApi.js';
import { ListPlus, Check, ShoppingBag, Plus, Minus, Package, BookOpen, BookX, ExternalLink, ShoppingCart, X, ArrowRightLeft, Search, Tag, Trash2, Star, Heart, Archive, Send, Link2, Unlink, ClipboardCopy, LogIn, LogOut, ChevronDown, ChevronLeft, ChevronRight, Loader2, Terminal, Download, Settings, RefreshCw, Merge, ArrowRight, History, RotateCcw, Ban, MapPin, PenLine, Upload } from 'lucide-vue-next';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const shoppingStore = useShoppingStore();
const mealPlanStore = useMealPlanStore();
const aliasStore = useIngredientAliasStore();
const { showSuccess, showError } = useNotification();
const api = useApi();
const reweLoading = ref(false);

// Einkaufslisten-Generierung Optionen
const showGenOptions = ref(false);
const showHistoryDropdown = ref(false);
const historyBtnRef = ref(null);
const historyDropdownTop = ref(0);
const genIncludePastDays = ref(false); // Standardmäßig: vergangene Tage NICHT einbeziehen
const genWeekOffset = ref(0); // 0 = aktuelle Woche, -1 = letzte Woche, +1 = nächste Woche

// Wochen-Start für die Generierung (Montag als YYYY-MM-DD)
const genWeekStart = computed(() => {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1) + genWeekOffset.value * 7);
  return monday.toISOString().split('T')[0];
});

// Label für die gewählte Woche
const genWeekLabel = computed(() => {
  const [y, m, d] = genWeekStart.value.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt) => dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  if (genWeekOffset.value === 0) return `Diese Woche (${fmt(monday)} – ${fmt(sunday)})`;
  return `${fmt(monday)} – ${fmt(sunday)}`;
});

// REWE-Einstellungen (persistent)
const showReweSettings = ref(false);
const showReweOrderSettings = ref(false);
const showRewePreview = ref(false);
const reweAction = ref(localStorage.getItem('rewe_action') || 'script');
const reweShowPreview = ref(localStorage.getItem('rewe_preview') !== 'false');

// REWE global aktiviert? (Default: false → versteckt bis API bestätigt)
const reweEnabled = ref(false);

// REWE Markt-Einstellungen (pro User, vom Server)
const reweMarketId = ref('');
const reweMarketName = ref('');
const reweZipCode = ref('');
const reweMarketSearch = ref('');
const reweMarketResults = ref([]);
const reweMarketSearchLoading = ref(false);
const reweMarketSearchError = ref('');
const reweMarketSettingsLoading = ref(false);

// REWE Produkt-Präferenzen
const showRewePreferences = ref(false);
const rewePreferences = ref([]);
const rewePreferencesLoading = ref(false);
const prefSearch = ref('');
const changingPref = ref(null);
const prefProductQuery = ref('');
const prefProductResults = ref([]);
const prefProductSearching = ref(false);
const prefProductSearchInput = ref(null);
let prefSearchTimeout = null;

const filteredPreferences = computed(() => {
  if (!prefSearch.value) return rewePreferences.value;
  const q = prefSearch.value.toLowerCase();
  return rewePreferences.value.filter(p =>
    p.ingredient_name.includes(q) || p.rewe_product_name?.toLowerCase().includes(q)
  );
});

const reweActionOptions = [
  { value: 'script', icon: '💻', label: 'Konsolen-Script', description: 'Script kopieren und in der Browser-Konsole auf rewe.de einfügen.' },
  { value: 'direct', icon: '🧩', label: 'REWE direkt öffnen', description: 'rewe.de öffnen – das Userscript erledigt den Rest.' },
  { value: 'tabs', icon: '🔗', label: 'Alle Tabs öffnen', description: 'Jedes Produkt einzeln in einem neuen Tab öffnen.' },
];

function saveReweSettings() {
  localStorage.setItem('rewe_action', reweAction.value);
  localStorage.setItem('rewe_preview', reweShowPreview.value);
}

// REWE Markt-Einstellungen vom Server laden
async function loadReweMarketSettings() {
  reweMarketSettingsLoading.value = true;
  try {
    const data = await api.get('/rewe/settings');
    reweEnabled.value = data.reweEnabled === true;
    reweMarketId.value = data.marketId || '';
    reweMarketName.value = data.marketName || '';
    reweZipCode.value = data.zipCode || '';
  } catch {
    // API-Fehler → sicherheitshalber deaktivieren
    reweEnabled.value = false;
  } finally {
    reweMarketSettingsLoading.value = false;
  }
}

// REWE-Märkte nach PLZ suchen
async function searchReweMarkets() {
  const q = reweMarketSearch.value.trim();
  if (!q) return;
  reweMarketSearchLoading.value = true;
  reweMarketSearchError.value = '';
  reweMarketResults.value = [];
  try {
    const data = await api.get(`/rewe/markets?search=${encodeURIComponent(q)}`);
    if (data.markets?.length) {
      reweMarketResults.value = data.markets;
    } else {
      reweMarketSearchError.value = data.error || 'Keine Märkte gefunden. Versuche eine andere PLZ.';
    }
  } catch {
    reweMarketSearchError.value = 'Suche fehlgeschlagen. Bitte versuche es erneut.';
  } finally {
    reweMarketSearchLoading.value = false;
  }
}

// REWE-Markt auswählen und speichern
async function selectReweMarket(market) {
  try {
    await api.put('/rewe/settings', {
      marketId: String(market.id),
      marketName: market.name || market.displayName || 'REWE Markt',
      zipCode: market.zipCode || '',
    });
    reweMarketId.value = String(market.id);
    reweMarketName.value = market.name || market.displayName || 'REWE Markt';
    reweZipCode.value = market.zipCode || '';
    showSuccess(`${market.name} ausgewählt (ID: ${market.id})`);
  } catch {
    // Fehler von useApi gehandelt
  }
}

// REWE-Markt-Einstellung löschen
async function resetReweMarket() {
  try {
    await api.del('/rewe/settings');
    await loadReweMarketSettings();
    showSuccess('REWE-Markt entfernt.');
  } catch {
    // Fehler von useApi gehandelt
  }
}

const currentReweActionLabel = computed(() => {
  const opt = reweActionOptions.find(o => o.value === reweAction.value);
  return opt ? `${opt.icon} ${opt.label}` : 'Bestellen';
});

const currentReweActionIcon = computed(() => {
  switch (reweAction.value) {
    case 'script': return Terminal;
    case 'direct': return ExternalLink;
    case 'tabs': return ExternalLink;
    default: return ShoppingCart;
  }
});

// Bring! Integration
const showBringModal = ref(false);
const bringEmail = ref('');
const bringPassword = ref('');
const bringConnecting = ref(false);
const bringListsLoading = ref(false);
const selectedBringList = ref('');

// REWE Warenkorb-Script
const showCartScript = ref(false);
const cartScript = ref('');
const cartScriptLoading = ref(false);
const cartScriptCopied = ref(false);

// REWE-Produkt-Picker
const pickerItem = ref(null);        // Das Shopping-Item, für das der Picker offen ist
const pickerProducts = ref([]);       // Gefundene REWE-Produkte
const pickerLoading = ref(false);     // Ladeindikator
const pickerSearch = ref('');         // Suchbegriff im Picker

// Manuelles Hinzufügen
const newItem = ref({ name: '', amount: null, unit: '' });

// "Einkauf abschließen?"-Dialog nach Bring!/REWE
const showCompletePurchasePrompt = ref(false);

// Rezept-Links ein-/ausblenden (persistent via localStorage)
const showRecipeLinks = ref(localStorage.getItem('shopping_showRecipeLinks') !== 'false');
function toggleRecipeLinks() {
  showRecipeLinks.value = !showRecipeLinks.value;
  localStorage.setItem('shopping_showRecipeLinks', showRecipeLinks.value);
}

// Zusammenfassen-Modus (Merge) – Multi-Select
const mergeMode = ref(false);
const mergeSelection = ref([]);  // Ausgewählte Items
const showMergeDialog = ref(false);
const mergeName = ref('');       // Gewählter Name für das zusammengefasste Item

// Alias-Verwaltung
const showAliasManager = ref(false);

// Blockier-Modus – Multi-Select
const blockMode = ref(false);
const blockSelection = ref([]);
const showBlockManager = ref(false);

const totalCount = computed(() => shoppingStore.activeList?.items?.length || 0);
const checkedCount = computed(() => shoppingStore.activeList?.items?.filter(i => i.is_checked).length || 0);
const progressPercent = computed(() => totalCount.value ? (checkedCount.value / totalCount.value * 100) : 0);

// REWE-Matching Fortschritt (0–100)
const reweMatchPercent = computed(() => {
  const p = shoppingStore.reweProgress;
  if (!p || !p.total) return 0;
  return Math.round((p.current / p.total) * 100);
});

const estimatedTotal = computed(() => {
  if (!shoppingStore.activeList?.items) return 0;
  return shoppingStore.activeList.items.reduce((sum, item) => {
    const price = item.rewe_product?.price || 0;
    const qty = item.rewe_product?.quantity || 1;
    return sum + (price * qty);
  }, 0);
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

function reweProductUrl(productName, productId) {
  if (!productId) return '#';
  const slug = (productName || 'produkt').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/(^-|-$)/g, '');
  return `https://www.rewe.de/shop/p/${slug}/${productId}`;
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

async function deleteItem(item) {
  try {
    await shoppingStore.deleteItem(item.id);
    showSuccess(`${item.ingredient_name} entfernt 🗑️`);
  } catch {
    showError('Artikel konnte nicht gelöscht werden.');
  }
}

async function moveToPantry(item) {
  try {
    await shoppingStore.moveToPantry(item.id);
    showSuccess(`${item.ingredient_name} in den Vorratsschrank verschoben! 🗄️`);
  } catch {
    showError('Artikel konnte nicht verschoben werden.');
  }
}

async function increaseQuantity(item) {
  const newQty = (item.rewe_product?.quantity || 1) + 1;
  try {
    await shoppingStore.updateReweQuantity(item.id, newQty);
  } catch {
    showError('Menge konnte nicht geändert werden.');
  }
}

async function decreaseQuantity(item) {
  const current = item.rewe_product?.quantity || 1;
  if (current <= 1) return;
  try {
    await shoppingStore.updateReweQuantity(item.id, current - 1);
  } catch {
    showError('Menge konnte nicht geändert werden.');
  }
}

async function generateList() {
  showGenOptions.value = false;
  // Wochenplan für die gewählte Woche laden
  await mealPlanStore.fetchCurrentPlan(genWeekStart.value);
  const planId = mealPlanStore.currentPlan?.id;
  if (!planId) {
    showError('Kein Wochenplan für diese Woche vorhanden. Erstelle zuerst einen Plan im Wochenplaner.');
    return;
  }
  try {
    const data = await shoppingStore.generateList(planId, {
      excludePastDays: !genIncludePastDays.value,
    });
    const msg = data.skippedDays
      ? `Einkaufsliste erstellt! 📝 (${data.skippedDays} vergangene Tage übersprungen)`
      : 'Einkaufsliste erstellt! 📝';
    showSuccess(msg);
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

// ============================================
// REWE Produkt-Präferenzen Verwaltung
// ============================================

async function openRewePreferences() {
  showRewePreferences.value = true;
  rewePreferencesLoading.value = true;
  prefSearch.value = '';
  try {
    const data = await shoppingStore.fetchPreferences();
    rewePreferences.value = data.preferences || [];
  } catch {
    showError('Präferenzen konnten nicht geladen werden.');
  } finally {
    rewePreferencesLoading.value = false;
  }
}

async function removePref(pref) {
  try {
    await shoppingStore.deletePreference(pref.id);
    rewePreferences.value = rewePreferences.value.filter(p => p.id !== pref.id);
    showSuccess(`Zuordnung für „${pref.ingredient_name}" entfernt`);
  } catch {
    showError('Löschen fehlgeschlagen.');
  }
}

async function clearAllPrefs() {
  if (!confirm(`Alle ${rewePreferences.value.length} gespeicherten Zuordnungen wirklich zurücksetzen?`)) return;
  try {
    await shoppingStore.clearAllPreferences();
    rewePreferences.value = [];
    showSuccess('Alle Zuordnungen zurückgesetzt');
  } catch {
    showError('Zurücksetzen fehlgeschlagen.');
  }
}

function startChangePref(pref) {
  changingPref.value = pref;
  prefProductQuery.value = pref.ingredient_name;
  prefProductResults.value = [];
  prefProductSearching.value = true;
  // Direkt nach dem Zutatennamen suchen
  nextTick(() => {
    prefProductSearchInput.value?.focus();
    searchPrefProducts();
  });
}

function debouncedPrefSearch() {
  clearTimeout(prefSearchTimeout);
  prefSearchTimeout = setTimeout(searchPrefProducts, 350);
}

async function searchPrefProducts() {
  if (!prefProductQuery.value || prefProductQuery.value.length < 2) {
    prefProductResults.value = [];
    prefProductSearching.value = false;
    return;
  }
  prefProductSearching.value = true;
  try {
    const data = await shoppingStore.searchReweProducts(prefProductQuery.value);
    prefProductResults.value = data.products || [];
  } catch {
    prefProductResults.value = [];
  } finally {
    prefProductSearching.value = false;
  }
}

async function selectPrefProduct(product) {
  if (!changingPref.value) return;
  try {
    await shoppingStore.updatePreference(changingPref.value.id, product);
    // Lokale Liste aktualisieren
    const idx = rewePreferences.value.findIndex(p => p.id === changingPref.value.id);
    if (idx >= 0) {
      rewePreferences.value[idx] = {
        ...rewePreferences.value[idx],
        rewe_product_id: product.id,
        rewe_product_name: product.name,
        rewe_price: product.price,
        rewe_package_size: product.packageSize,
        rewe_image_url: product.imageUrl || null,
      };
    }
    showSuccess(`Bevorzugtes Produkt für „${changingPref.value.ingredient_name}" geändert`);
    changingPref.value = null;
    prefProductResults.value = [];
    prefProductQuery.value = '';
  } catch {
    showError('Änderung fehlgeschlagen.');
  }
}

async function completePurchase({ includeAll = false } = {}) {
  try {
    await shoppingStore.completePurchase({ includeAll });
    showSuccess('Einkauf abgeschlossen! Vorräte aktualisiert. 🎉');
  } catch {
    // Fehler wird von useApi angezeigt
  }
}

/** Nach Bring!/REWE-Aktion: Einkauf abschließen (alle Items, nicht nur abgehakte) */
async function confirmCompletePurchase() {
  showCompletePurchasePrompt.value = false;
  await completePurchase({ includeAll: true });
}

/** REWE Hauptaktion (Split-Button links) */
async function handleReweMainAction() {
  if (reweShowPreview.value) {
    showRewePreview.value = true;
  } else {
    await executeReweAction();
  }
}

/** Gewählte REWE-Aktion ausführen */
async function executeReweAction() {
  switch (reweAction.value) {
    case 'script':
      await loadCartScript();
      showRewePreview.value = false;
      showCompletePurchasePrompt.value = true;
      break;
    case 'direct':
      window.open('https://www.rewe.de/shop/', '_blank', 'noopener');
      showRewePreview.value = false;
      showSuccess('REWE geöffnet – klicke dort auf den 🍳-Button!');
      showCompletePurchasePrompt.value = true;
      break;
    case 'tabs':
      openAllReweProducts();
      showRewePreview.value = false;
      showCompletePurchasePrompt.value = true;
      break;
    default:
      showRewePreview.value = true;
  }
}

/** API-Token erneuern und Userscript neu installieren */
function regenerateToken() {
  // Aktueller Token ist noch gültig (User ist eingeloggt) → Userscript einfach neu installieren
  installUserscript();
  showSuccess('Userscript mit aktuellem Token wird neu installiert.');
}

/** Alle REWE-Produkte in neuen Tabs öffnen */
function openAllReweProducts() {
  const items = shoppingStore.reweLinkedItems;
  if (!items.length) return;
  // Tabs nacheinander öffnen (mit kleinem Delay, damit Popup-Blocker nicht zuschlagen)
  items.forEach((item, index) => {
    setTimeout(() => {
      window.open(item.rewe_product.url, '_blank', 'noopener');
    }, index * 300);
  });
  showSuccess(`${items.length} REWE-Produktseiten geöffnet! 🛒`);
}

/** Produkt-Picker öffnen: Alternativen für eine Zutat suchen */
async function openProductPicker(item) {
  pickerItem.value = item;
  pickerProducts.value = [];
  pickerSearch.value = item.ingredient_name;
  pickerLoading.value = true;
  try {
    const data = await shoppingStore.searchReweProducts(item.ingredient_name);
    pickerProducts.value = data.products || [];
  } catch {
    showError('REWE-Suche fehlgeschlagen.');
  } finally {
    pickerLoading.value = false;
  }
}

function closeProductPicker() {
  pickerItem.value = null;
  pickerProducts.value = [];
  pickerSearch.value = '';
}

/** Manuelle Suche im Picker */
async function searchInPicker() {
  const q = pickerSearch.value.trim();
  if (!q || q.length < 2) return;
  pickerLoading.value = true;
  pickerProducts.value = [];
  try {
    const data = await shoppingStore.searchReweProducts(q);
    pickerProducts.value = data.products || [];
  } catch {
    showError('REWE-Suche fehlgeschlagen.');
  } finally {
    pickerLoading.value = false;
  }
}

/** Produkt aus Picker auswählen und dem Item zuweisen */
async function selectProduct(product) {
  if (!pickerItem.value) return;
  try {
    await shoppingStore.setReweProduct(pickerItem.value.id, product);
    showSuccess(`${product.name} zugewiesen & gemerkt! ⭐`);
    closeProductPicker();
  } catch {
    showError('Produkt konnte nicht zugewiesen werden.');
  }
}

onMounted(async () => {
  await shoppingStore.fetchActiveList();
  shoppingStore.fetchBringStatus();
  aliasStore.fetchAliases();
  aliasStore.fetchBlockedIngredients();
  // Verlauf immer laden (für History-Button)
  shoppingStore.fetchListHistory();
  // REWE-Status prüfen (reweEnabled)
  loadReweMarketSettings();
});

// Bring!-Listen laden, wenn Modal geöffnet wird
watch(showBringModal, async (open) => {
  if (open && shoppingStore.bringStatus?.connected) {
    bringListsLoading.value = true;
    try {
      await shoppingStore.fetchBringLists();
      selectedBringList.value = shoppingStore.bringStatus.list?.uuid || shoppingStore.bringLists[0]?.uuid || '';
    } catch { /* ignore */ }
    bringListsLoading.value = false;
  }
});

// ============================================
// Bring! Funktionen
// ============================================

async function connectBring() {
  bringConnecting.value = true;
  try {
    const data = await shoppingStore.connectBring(bringEmail.value.trim(), bringPassword.value);
    bringPassword.value = '';
    // Listen setzen
    if (data.availableLists?.length) {
      selectedBringList.value = data.list?.uuid || data.availableLists[0].uuid;
    }
    showSuccess(`Bring! verbunden! 🎉 Liste: ${data.list?.name || 'Einkaufsliste'}`);
  } catch {
    showError('Bring!-Login fehlgeschlagen. Bitte prüfe deine Zugangsdaten.');
  } finally {
    bringConnecting.value = false;
  }
}

async function sendToBring() {
  try {
    const listUuid = selectedBringList.value || shoppingStore.bringStatus?.list?.uuid;
    const result = await shoppingStore.sendToBring(listUuid);
    showSuccess(`${result.sentCount} Artikel an Bring! gesendet! 📲`);
    if (result.errors?.length) {
      showError(`${result.errors.length} Artikel konnten nicht gesendet werden.`);
    }
    showBringModal.value = false;
    showCompletePurchasePrompt.value = true;
  } catch {
    showError('Senden an Bring! fehlgeschlagen.');
  }
}

async function changeBringList() {
  const list = shoppingStore.bringLists.find(l => l.uuid === selectedBringList.value);
  if (list) {
    try {
      await shoppingStore.setBringList(list.uuid, list.name);
      showSuccess(`Standard-Liste: ${list.name}`);
    } catch {
      showError('Liste konnte nicht geändert werden.');
    }
  }
}

async function disconnectBring() {
  try {
    await shoppingStore.disconnectBring();
    showSuccess('Bring!-Verbindung getrennt.');
  } catch {
    showError('Fehler beim Trennen.');
  }
}

async function importFromBring() {
  try {
    const listUuid = selectedBringList.value || shoppingStore.bringStatus?.list?.uuid;
    const result = await shoppingStore.importFromBring(listUuid);
    if (result.importedCount > 0) {
      showSuccess(`${result.importedCount} Artikel aus Bring! importiert! 📥`);
    } else if (result.skippedCount > 0) {
      showSuccess('Alle Bring!-Artikel sind bereits in der Liste.');
    } else {
      showSuccess(result.message || 'Keine Artikel zum Importieren.');
    }
    if (result.skippedCount > 0 && result.importedCount > 0) {
      showSuccess(`${result.skippedCount} Duplikate übersprungen.`);
    }
  } catch {
    showError('Import aus Bring! fehlgeschlagen.');
  }
}

// ============================================
// REWE Warenkorb-Script
// ============================================

async function loadCartScript() {
  cartScriptLoading.value = true;
  try {
    const data = await shoppingStore.getReweCartScript();
    if (data.error) {
      showError(data.error);
      return;
    }
    cartScript.value = data.script;
    showCartScript.value = true;
  } catch {
    showError('Script konnte nicht generiert werden.');
  } finally {
    cartScriptLoading.value = false;
  }
}

async function copyCartScript() {
  try {
    await navigator.clipboard.writeText(cartScript.value);
    cartScriptCopied.value = true;
    setTimeout(() => { cartScriptCopied.value = false; }, 2000);
    showSuccess('Script kopiert! Jetzt in die REWE-Konsole einfügen.');
  } catch {
    showError('Kopieren fehlgeschlagen.');
  }
}

function installUserscript() {
  try {
    const url = shoppingStore.getReweUserscriptUrl();
    window.open(url, '_blank');
    showSuccess('Userscript wird geöffnet – bestätige die Installation in Tampermonkey!');
  } catch {
    showError('Userscript-URL konnte nicht generiert werden.');
  }
}

// ============================================
// Zusammenfassen (Merge) Funktionen
// ============================================

function toggleMergeMode() {
  mergeMode.value = !mergeMode.value;
  mergeSelection.value = [];
  showMergeDialog.value = false;
  // Block-Modus beenden wenn Merge startet
  if (mergeMode.value) {
    blockMode.value = false;
    blockSelection.value = [];
  }
}

function handleMergeClick(item) {
  if (!mergeMode.value) return;
  const idx = mergeSelection.value.findIndex(s => s.id === item.id);
  if (idx >= 0) {
    // Item abwählen
    mergeSelection.value.splice(idx, 1);
  } else {
    // Item hinzufügen
    mergeSelection.value.push(item);
  }
}

// Eindeutige Namen aus der Auswahl (für Radio-Buttons im Dialog)
const mergeUniqueNames = computed(() => {
  const names = mergeSelection.value.map(s => s.ingredient_name);
  return [...new Set(names)];
});

function openMergeDialog() {
  if (mergeSelection.value.length < 2) return;
  mergeName.value = mergeSelection.value[0].ingredient_name;
  showMergeDialog.value = true;
}

async function confirmMerge() {
  if (mergeSelection.value.length < 2 || !mergeName.value.trim()) return;
  try {
    // Erstes Item wird Ziel, alle anderen sind Sources
    const targetItem = mergeSelection.value[0];
    const sourceItems = mergeSelection.value.slice(1);
    await aliasStore.mergeItems(
      sourceItems.map(s => s.id),
      targetItem.id,
      mergeName.value.trim()
    );
    await shoppingStore.fetchActiveList();
    await aliasStore.fetchAliases();
    showSuccess(`${mergeSelection.value.length} Zutaten zusammengefasst! "${mergeName.value}" wird künftig automatisch erkannt. ✅`);
    showMergeDialog.value = false;
    mergeSelection.value = [];
  } catch {
    showError('Zusammenfassen fehlgeschlagen.');
  }
}

function cancelMerge() {
  showMergeDialog.value = false;
}

// ============================================
// Alias-Verwaltung
// ============================================

async function deleteAlias(alias) {
  try {
    await aliasStore.deleteAlias(alias.id);
    showSuccess(`Zusammenfassung "${alias.alias_name}" gelöscht.`);
  } catch {
    showError('Löschen fehlgeschlagen.');
  }
}

async function unblockIngredient(blocked) {
  try {
    await aliasStore.unblockIngredient(blocked.id);
    showSuccess(`"${blocked.ingredient_name}" wieder freigegeben ✅`);
  } catch {
    showError('Freigabe fehlgeschlagen.');
  }
}

// ============================================
// Blockier-Modus Funktionen
// ============================================

function toggleBlockMode() {
  blockMode.value = !blockMode.value;
  blockSelection.value = [];
  // Merge-Modus beenden wenn Block startet
  if (blockMode.value) {
    mergeMode.value = false;
    mergeSelection.value = [];
    showMergeDialog.value = false;
  }
}

function handleBlockClick(item) {
  if (!blockMode.value) return;
  const idx = blockSelection.value.findIndex(s => s.id === item.id);
  if (idx >= 0) {
    blockSelection.value.splice(idx, 1);
  } else {
    blockSelection.value.push(item);
  }
}

async function confirmBlockSelection() {
  if (blockSelection.value.length === 0) return;
  try {
    // Alle ausgewählten Zutaten blockieren und von der Liste entfernen
    const names = [];
    for (const item of blockSelection.value) {
      await aliasStore.blockIngredient(item.ingredient_name);
      await shoppingStore.deleteItem(item.id);
      names.push(item.ingredient_name);
    }
    showSuccess(`${names.length} Zutat${names.length > 1 ? 'en' : ''} blockiert: ${names.join(', ')} 🚫`);
    blockSelection.value = [];
    blockMode.value = false;
  } catch {
    showError('Blockieren fehlgeschlagen.');
  }
}

// ============================================
// Einkaufslisten-Verlauf
// ============================================

async function reactivateHistoryList(listId) {
  try {
    await shoppingStore.reactivateList(listId);
    // Verlauf neu laden (Aktiv-Status hat sich geändert)
    shoppingStore.fetchListHistory();
    showSuccess('Einkaufsliste wiederhergestellt! 🛒');
  } catch {
    showError('Liste konnte nicht geladen werden.');
  }
}

const historyDropdownStyle = computed(() => {
  // Trigger bei Öffnen (macht den computed reaktiv)
  void historyDropdownTop.value;
  // Auf Desktop (sm+) → absolute-Positionierung via CSS-Klassen
  if (typeof window !== 'undefined' && window.innerWidth >= 640) return {};
  // Auf Mobile → fixed mit sicheren Rändern
  if (!historyBtnRef.value) return { left: '0.75rem', right: '0.75rem' };
  const rect = historyBtnRef.value.getBoundingClientRect();
  return {
    top: `${rect.bottom + 6}px`,
    left: '0.75rem',
    right: '0.75rem',
  };
});

async function openHistoryDropdown() {
  showHistoryDropdown.value = !showHistoryDropdown.value;
  if (showHistoryDropdown.value) {
    // Verlauf aktualisieren beim Öffnen
    shoppingStore.fetchListHistory();
    // Position nach nächstem Tick neu berechnen (für computed reactivity)
    await nextTick();
    historyDropdownTop.value = Date.now(); // Trigger reactivity
  }
}

function formatHistoryDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.slide-enter-active {
  transition: all 0.3s ease-out;
}
.slide-leave-active {
  transition: all 0.2s ease-in;
}
.slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
