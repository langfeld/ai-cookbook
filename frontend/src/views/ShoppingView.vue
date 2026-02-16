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

    <!-- REWE-Matching Fortschritt -->
    <Transition name="slide">
      <div v-if="shoppingStore.reweProgress" class="bg-white dark:bg-stone-900 border border-red-200 dark:border-red-800/40 rounded-xl overflow-hidden">
        <!-- Fortschrittsbalken -->
        <div class="bg-red-100 dark:bg-red-900/20 w-full h-1.5">
          <div
            class="bg-red-500 h-1.5 transition-all duration-300 ease-out"
            :style="{ width: `${reweMatchPercent}%` }"
          />
        </div>
        <div class="px-4 py-3">
          <div class="flex justify-between items-center gap-4">
            <!-- Links: Status -->
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative flex justify-center items-center w-9 h-9 shrink-0">
                <svg class="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3" class="text-red-100 dark:text-red-900/40" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3"
                    class="text-red-500 transition-all duration-300"
                    :stroke-dasharray="`${reweMatchPercent * 0.942} 100`"
                  />
                </svg>
                <span class="absolute font-bold text-[10px] text-red-600 dark:text-red-400">{{ reweMatchPercent }}%</span>
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
                'group flex items-center gap-3 px-4 py-2.5 transition-all hover:bg-stone-50 dark:hover:bg-stone-800/30',
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
                <!-- REWE-Produkt (klickbar → Alternativen anzeigen) -->
                <div v-if="item.rewe_product" class="flex items-center gap-1 mt-0.5 text-xs">
                  <button
                    @click.stop="openProductPicker(item)"
                    class="inline-flex items-center gap-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:underline transition-colors cursor-pointer"
                    :title="`Klick: Alternatives Produkt wählen`"
                  >
                    🏪 {{ item.rewe_product.name }} – {{ formatPrice(item.rewe_product.price) }}
                    <ArrowRightLeft class="w-3 h-3 shrink-0" />
                  </button>
                  <a
                    v-if="item.rewe_product.url"
                    :href="item.rewe_product.url"
                    target="_blank"
                    rel="noopener"
                    @click.stop
                    class="text-stone-400 hover:text-red-500 transition-colors"
                    title="Bei REWE öffnen"
                  >
                    <ExternalLink class="w-3 h-3" />
                  </a>
                </div>
                <!-- Kein REWE-Produkt → Suche anbieten -->
                <button
                  v-else-if="shoppingStore.reweLinkedItems.length > 0 || reweLoading"
                  @click.stop="openProductPicker(item)"
                  class="inline-flex items-center gap-1 mt-0.5 text-stone-400 hover:text-red-500 text-xs transition-colors cursor-pointer"
                  title="REWE-Produkt suchen"
                >
                  🔍 Produkt suchen…
                </button>
              </div>

              <!-- Menge + Löschen -->
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="font-medium tabular-nums text-stone-400 dark:text-stone-500 text-xs">
                  {{ item.amount }} {{ item.unit }}
                </span>
                <button
                  @click.stop="deleteItem(item)"
                  class="hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 focus:opacity-100 group-hover:opacity-100 p-1 rounded-md text-stone-300 hover:text-red-500 dark:hover:text-red-400 dark:text-stone-600 transition-all"
                  title="Artikel entfernen"
                >
                  <Trash2 class="w-3.5 h-3.5" />
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
        <div class="flex gap-2">
          <!-- Bei REWE bestellen -->
          <button
            v-if="shoppingStore.reweLinkedItems.length"
            @click="showRewePanel = true"
            class="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-5 py-3 rounded-xl font-medium text-white transition-colors"
          >
            <ShoppingCart class="w-4 h-4" />
            Bei REWE bestellen ({{ shoppingStore.reweLinkedItems.length }})
          </button>
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

      <!-- REWE Bestell-Panel (Overlay) -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showRewePanel" class="z-50 fixed inset-0 flex justify-center items-end sm:items-center bg-black/50 p-4" @click.self="showRewePanel = false">
            <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
              <!-- Panel Header -->
              <div class="flex justify-between items-center px-5 py-4 border-stone-200 dark:border-stone-700 border-b">
                <div>
                  <h2 class="font-display font-bold text-stone-800 dark:text-stone-100 text-lg">🏪 Bei REWE bestellen</h2>
                  <p class="mt-0.5 text-stone-500 dark:text-stone-400 text-xs">
                    {{ shoppingStore.reweLinkedItems.length }} Produkte · {{ formatPrice(estimatedTotal) }}
                  </p>
                </div>
                <button @click="showRewePanel = false" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 transition-colors">
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Produktliste -->
              <div class="flex-1 divide-y divide-stone-100 dark:divide-stone-800 overflow-y-auto">
                <div
                  v-for="item in shoppingStore.reweLinkedItems"
                  :key="item.id"
                  class="flex justify-between items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/30 px-5 py-3 transition-colors"
                >
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-stone-800 dark:text-stone-200 text-sm truncate">{{ item.ingredient_name }}</p>
                    <p class="text-stone-500 dark:text-stone-400 text-xs truncate">{{ item.rewe_product.name }}</p>
                    <p v-if="item.rewe_product.packageSize" class="text-[10px] text-stone-400 dark:text-stone-500">{{ item.rewe_product.packageSize }}</p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="font-semibold tabular-nums text-stone-700 dark:text-stone-300 text-sm">{{ formatPrice(item.rewe_product.price) }}</span>
                    <a
                      :href="item.rewe_product.url"
                      target="_blank"
                      rel="noopener"
                      class="flex items-center gap-1 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 px-2.5 py-1.5 rounded-lg font-medium text-red-600 dark:text-red-400 text-xs transition-colors"
                    >
                      <ExternalLink class="w-3 h-3" />
                      Öffnen
                    </a>
                  </div>
                </div>
              </div>

              <!-- Panel Footer -->
              <div class="bg-stone-50 dark:bg-stone-800/50 px-5 py-4 border-stone-200 dark:border-stone-700 border-t">
                <button
                  @click="openAllReweProducts"
                  class="flex justify-center items-center gap-2 bg-red-600 hover:bg-red-700 py-3 rounded-xl w-full font-medium text-white transition-colors"
                >
                  <ShoppingCart class="w-4 h-4" />
                  Alle {{ shoppingStore.reweLinkedItems.length }} Produkte bei REWE öffnen
                </button>
                <p class="mt-2 text-[10px] text-stone-400 dark:text-stone-500 text-center">
                  Die Produkte werden in neuen Tabs geöffnet. Füge sie dort in deinen REWE-Warenkorb.
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
                  Aktuell: {{ pickerItem.rewe_product.name }} – {{ formatPrice(pickerItem.rewe_product.price) }}
                </div>
                <!-- Suchfeld -->
                <form @submit.prevent="searchInPicker" class="flex gap-2 mt-3">
                  <div class="relative flex-1">
                    <Search class="top-1/2 left-3 absolute w-4 h-4 text-stone-400 -translate-y-1/2 pointer-events-none" />
                    <input
                      v-model="pickerSearch"
                      type="text"
                      placeholder="Suchbegriff ändern…"
                      class="bg-stone-50 dark:bg-stone-800 py-2 pr-3 pl-9 border border-stone-300 focus:border-transparent dark:border-stone-600 rounded-lg focus:ring-2 focus:ring-red-500 w-full text-stone-800 dark:text-stone-200 placeholder:text-stone-400 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    :disabled="pickerLoading || pickerSearch.trim().length < 2"
                    class="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-2 rounded-lg font-medium text-white text-sm transition-colors shrink-0"
                  >
                    Suchen
                  </button>
                </form>
              </div>

              <!-- Produktliste -->
              <div class="flex-1 overflow-y-auto">
                <!-- Ladezustand -->
                <div v-if="pickerLoading" class="flex flex-col items-center gap-3 py-12">
                  <div class="border-2 border-red-200 border-t-red-600 rounded-full w-8 h-8 animate-spin" />
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
                    <!-- Rang / Günstigster Badge -->
                    <div class="flex justify-center items-center rounded-full w-7 h-7 font-bold text-xs shrink-0"
                      :class="idx === 0
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'"
                    >
                      <Tag v-if="idx === 0" class="w-3.5 h-3.5" />
                      <span v-else>{{ idx + 1 }}</span>
                    </div>

                    <!-- Produktinfo -->
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-stone-800 dark:group-hover:text-red-400 dark:text-stone-200 group-hover:text-red-600 text-sm truncate transition-colors">
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
import { ListPlus, Check, ShoppingBag, Plus, Package, BookOpen, BookX, ExternalLink, ShoppingCart, X, ArrowRightLeft, Search, Tag, Trash2, Star, Heart } from 'lucide-vue-next';

const shoppingStore = useShoppingStore();
const mealPlanStore = useMealPlanStore();
const { showSuccess, showError } = useNotification();
const reweLoading = ref(false);

// REWE-Bestell-Panel
const showRewePanel = ref(false);

// REWE-Produkt-Picker
const pickerItem = ref(null);        // Das Shopping-Item, für das der Picker offen ist
const pickerProducts = ref([]);       // Gefundene REWE-Produkte
const pickerLoading = ref(false);     // Ladeindikator
const pickerSearch = ref('');         // Suchbegriff im Picker

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

// REWE-Matching Fortschritt (0–100)
const reweMatchPercent = computed(() => {
  const p = shoppingStore.reweProgress;
  if (!p || !p.total) return 0;
  return Math.round((p.current / p.total) * 100);
});

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

async function deleteItem(item) {
  try {
    await shoppingStore.deleteItem(item.id);
    showSuccess(`${item.ingredient_name} entfernt 🗑️`);
  } catch {
    showError('Artikel konnte nicht gelöscht werden.');
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
  showRewePanel.value = false;
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

onMounted(() => {
  shoppingStore.fetchActiveList();
});
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
