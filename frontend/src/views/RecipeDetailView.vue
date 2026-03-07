<!--
  ============================================
  RecipeDetailView - Rezeptdetails
  ============================================
  Vollständige Ansicht eines Rezepts mit:
  - Zutatenliste (mit farblichen Hervorhebungen)
  - Kochschritte (unterteilt)
  - Portionsrechner
  - Favoriten, Bewertung, Kochhistorie
-->
<template>
  <div class="mx-auto max-w-7xl">
    <!-- Rezept-Inhalt -->
    <div v-if="recipe" class="space-y-6 animate-fade-in">

      <!-- ═══════ HEADER ═══════ -->
      <div class="flex md:flex-row flex-col gap-6 lg:grid lg:grid-cols-[minmax(300px,400px)_1fr]">
        <!-- Bild -->
        <div v-if="recipe.image_url"
          class="bg-stone-100 dark:bg-stone-800 bg-cover bg-center rounded-xl w-full min-h-48 aspect-video lg:aspect-auto overflow-hidden"
          :style="{ backgroundImage: `url(${recipe.image_url})` }">
        </div>
        <div v-else class="flex justify-center items-center bg-stone-100 dark:bg-stone-800 rounded-xl w-full min-h-48 aspect-video lg:aspect-auto text-5xl">🍽️</div>
        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-start gap-2">
            <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-xl sm:text-2xl leading-tight">{{ recipe.title }}</h1>
            <button @click="recipesStore.toggleFavorite(recipe.id)" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg shrink-0">
              <Star class="w-5 h-5" :class="recipe.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-stone-300'" />
            </button>
          </div>
          <p v-if="recipe.description" class="mt-2.5 text-stone-500 dark:text-stone-400 text-sm line-clamp-2 leading-relaxed">{{ recipe.description }}</p>

          <!-- Meta -->
          <div class="flex flex-wrap items-center gap-2.5 mt-5">
            <span class="meta-badge"><Clock class="w-3.5 h-3.5" /> {{ recipe.total_time }} Min.</span>
            <span class="meta-badge"><Users class="w-3.5 h-3.5" /> {{ recipe.servings }} Port.</span>
            <span class="meta-badge" :class="difficultyColor">{{ difficultyEmoji }} {{ recipe.difficulty }}</span>
            <button v-if="recipe.times_cooked" @click="showHistoryPopup = true" class="hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer meta-badge"><ChefHat class="w-3.5 h-3.5" /> {{ recipe.times_cooked }}×</button>
          </div>

          <!-- Kategorien -->
          <div v-if="recipe.categories?.length" class="flex flex-wrap gap-2 mt-4">
            <span v-for="cat in recipe.categories" :key="cat.id"
              :style="{ borderColor: cat.color + '60', backgroundColor: cat.color + '15' }"
              class="px-2.5 py-0.5 border rounded-full text-xs">
              {{ cat.icon }} {{ cat.name }}
            </span>
          </div>

          <!-- Nährwerte -->
          <div v-if="recipe.calories" class="flex flex-wrap items-center gap-2 mt-4">
            <span class="inline-flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 border border-orange-200/60 dark:border-orange-800/40 rounded-full text-orange-700 dark:text-orange-300 text-xs">
              🔥 {{ scaledNutrition.calories }} kcal
            </span>
            <span v-if="recipe.protein" class="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 border border-blue-200/60 dark:border-blue-800/40 rounded-full text-blue-700 dark:text-blue-300 text-xs">
              💪 {{ scaledNutrition.protein }}g Eiweiß
            </span>
            <span v-if="recipe.carbs" class="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 border border-amber-200/60 dark:border-amber-800/40 rounded-full text-amber-700 dark:text-amber-300 text-xs">
              🍞 {{ scaledNutrition.carbs }}g Kohlenhydrate
            </span>
            <span v-if="recipe.fat" class="inline-flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 border border-yellow-200/60 dark:border-yellow-800/40 rounded-full text-yellow-700 dark:text-yellow-300 text-xs">
              🧈 {{ scaledNutrition.fat }}g Fett
            </span>
            <button v-if="recipe.nutrition_note || parsedNutritionDetails.length"
              @click="showNutritionPopup = true"
              class="inline-flex justify-center items-center hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full w-5 h-5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 dark:text-stone-500 transition-colors cursor-pointer"
              title="Nährwert-Details">
              <HelpCircle class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Aktionen -->
          <div class="flex flex-wrap items-center gap-2.5 mt-5">
            <button v-if="recipe.steps?.length" @click="showCookingMode = true"
              class="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 dark:bg-stone-700 dark:hover:bg-stone-600 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-colors">
              <Maximize class="w-3.5 h-3.5" /> Kochmodus
            </button>
            <button @click="markCooked"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-colors bg-accent-600 hover:bg-accent-700">
              <ChefHat class="w-3.5 h-3.5" /> Gekocht ✓
            </button>
            <button @click="plannerServings = adjustedServings; showPlannerModal = true"
              class="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-colors">
              <CalendarPlus class="w-3.5 h-3.5" /> Planer
            </button>
            <AddToCollection v-if="recipe?.id" :recipe-id="recipe.id" />

            <!-- Mehr-Menü -->
            <div class="relative">
              <button @click="showMoreMenu = !showMoreMenu"
                class="flex items-center hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-500 dark:text-stone-400 transition-colors"
                title="Weitere Aktionen">
                <EllipsisVertical class="w-4 h-4" />
              </button>
              <!-- Desktop: normales Dropdown -->
              <Transition name="fade">
                <div v-if="showMoreMenu"
                  class="hidden sm:block top-full right-0 z-30 absolute bg-white dark:bg-stone-900 shadow-lg mt-1 py-1 border border-stone-200 dark:border-stone-700 rounded-xl w-48">
                  <button v-if="isTouchDevice" @click="toggleWakeLock(); showMoreMenu = false"
                    class="flex items-center gap-2.5 hover:bg-stone-50 dark:hover:bg-stone-800 px-3 py-2 w-full text-sm text-left transition-colors"
                    :class="wakeLockActive ? 'text-primary-600 dark:text-primary-400' : 'text-stone-700 dark:text-stone-300'">
                    <Smartphone class="w-4 h-4" />
                    {{ wakeLockActive ? '✓ Display bleibt an' : 'Wach halten' }}
                  </button>
                  <button @click="handleShare(); showMoreMenu = false"
                    class="flex items-center gap-2.5 hover:bg-stone-50 dark:hover:bg-stone-800 px-3 py-2 w-full text-stone-700 dark:text-stone-300 text-sm text-left transition-colors">
                    <Share2 class="w-4 h-4" /> Teilen
                  </button>
                  <router-link :to="'/recipes/new?edit=' + recipe.id" @click="showMoreMenu = false"
                    class="flex items-center gap-2.5 hover:bg-stone-50 dark:hover:bg-stone-800 px-3 py-2 w-full text-stone-700 dark:text-stone-300 text-sm transition-colors">
                    <Pencil class="w-4 h-4" /> Bearbeiten
                  </router-link>
                  <button @click="showDeleteDialog = true; showMoreMenu = false"
                    class="flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-2 w-full text-red-600 dark:text-red-400 text-sm text-left transition-colors">
                    <Trash2 class="w-4 h-4" /> Löschen
                  </button>
                </div>
              </Transition>
              <!-- Mobile: zentriertes Bottom-Sheet via Teleport -->
              <Teleport to="body">
                <Transition name="fade">
                  <div v-if="showMoreMenu" class="sm:hidden z-50 fixed inset-0 flex justify-center items-center bg-black/20" @click.self="showMoreMenu = false">
                    <div class="bg-white dark:bg-stone-900 shadow-lg mx-4 py-1 border border-stone-200 dark:border-stone-700 rounded-xl w-full max-w-xs">
                      <button v-if="isTouchDevice" @click="toggleWakeLock(); showMoreMenu = false"
                        class="flex items-center gap-2.5 hover:bg-stone-50 dark:hover:bg-stone-800 px-4 py-3 w-full text-sm text-left transition-colors"
                        :class="wakeLockActive ? 'text-primary-600 dark:text-primary-400' : 'text-stone-700 dark:text-stone-300'">
                        <Smartphone class="w-4 h-4" />
                        {{ wakeLockActive ? '✓ Display bleibt an' : 'Wach halten' }}
                      </button>
                      <button @click="handleShare(); showMoreMenu = false"
                        class="flex items-center gap-2.5 hover:bg-stone-50 dark:hover:bg-stone-800 px-4 py-3 w-full text-stone-700 dark:text-stone-300 text-sm text-left transition-colors">
                        <Share2 class="w-4 h-4" /> Teilen
                      </button>
                      <router-link :to="'/recipes/new?edit=' + recipe.id" @click="showMoreMenu = false"
                        class="flex items-center gap-2.5 hover:bg-stone-50 dark:hover:bg-stone-800 px-4 py-3 w-full text-stone-700 dark:text-stone-300 text-sm transition-colors">
                        <Pencil class="w-4 h-4" /> Bearbeiten
                      </router-link>
                      <button @click="showDeleteDialog = true; showMoreMenu = false"
                        class="flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-950/30 px-4 py-3 w-full text-red-600 dark:text-red-400 text-sm text-left transition-colors">
                        <Trash2 class="w-4 h-4" /> Löschen
                      </button>
                    </div>
                  </div>
                </Transition>
              </Teleport>
              <!-- Desktop backdrop -->
              <div v-if="showMoreMenu" @click="showMoreMenu = false" class="hidden sm:block z-20 fixed inset-0" />
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════ ZWEI-SPALTEN: ZUTATEN + ZUBEREITUNG ═══════ -->
      <div class="lg:items-stretch lg:gap-6 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[minmax(300px,400px)_1fr]">

        <!-- ── ZUTATEN (links, sticky auf Desktop) ── -->
        <div class="lg:top-4 lg:sticky lg:self-stretch bg-white dark:bg-stone-900 p-4 border border-stone-200 dark:border-stone-800 rounded-xl">
          <h2 class="mb-3 font-semibold text-stone-800 dark:text-stone-100 text-lg">🥕 Zutaten</h2>

          <!-- Portionsrechner -->
          <div class="flex flex-wrap items-center gap-2 mb-3 pb-3 border-stone-100 dark:border-stone-800 border-b">
            <div class="flex items-center gap-1.5">
              <button @click="adjustedServings = Math.max(1, adjustedServings - 1)"
                class="flex justify-center items-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-full w-7 h-7 text-stone-600 dark:text-stone-400">
                <Minus class="w-3.5 h-3.5" />
              </button>
              <span class="w-14 font-medium text-stone-700 dark:text-stone-300 text-base text-center">{{ adjustedServings }} Port.</span>
              <button @click="adjustedServings++"
                class="flex justify-center items-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-full w-7 h-7 text-stone-600 dark:text-stone-400">
                <Plus class="w-3.5 h-3.5" />
              </button>
            </div>
            <button @click="toggleAdjustmentMode"
              :class="[
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                adjustmentMode
                  ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
              ]"
              :title="adjustmentMode ? 'Mengen-Anpassung deaktivieren' : 'Einzelne Mengen anpassen'">
              <Warehouse class="w-3 h-3" />
              {{ adjustmentMode ? 'Aktiv' : 'Anpassen' }}
            </button>
            <button v-if="adjustmentMode && overrideCount > 0" @click="resetAllOverrides"
              class="flex items-center gap-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-xs transition-colors">
              <RotateCcw class="w-3 h-3" /> Reset ({{ overrideCount }})
            </button>
          </div>

          <!-- Zutaten-Liste -->
          <ul :class="adjustmentMode ? 'space-y-1' : 'grid gap-x-2 gap-y-0.5'"
              :style="!adjustmentMode ? 'grid-template-columns: 1.25rem auto 1fr' : undefined">
            <li v-for="ing in flatIngredients" :key="ing.id"
              class="hover:bg-stone-50 dark:hover:bg-stone-800/50 px-1.5 py-1.5 rounded-md transition-colors"
              :class="adjustmentMode
                ? 'flex items-center gap-2 flex-wrap'
                : 'col-span-full grid grid-cols-subgrid items-baseline'">
              <span class="text-base text-center" :class="adjustmentMode ? 'w-5 shrink-0' : ''" :title="ing.name">{{ getEmoji(ing.name) || '•' }}</span>

              <!-- Normal -->
              <template v-if="!adjustmentMode">
                <span class="font-medium text-stone-800 dark:text-stone-200 text-base text-right whitespace-nowrap">
                  <template v-for="(a, i) in ing.amounts" :key="i">
                    <template v-if="i > 0">, </template>
                    {{ scaleAmount(a.amount) }}&nbsp;{{ a.unit }}
                  </template>
                </span>
              </template>

              <!-- Anpassungsmodus -->
              <template v-else>
                <span class="flex items-center gap-1 shrink-0">
                  <template v-if="ing.amounts.length === 1">
                    <input type="number"
                      :value="hasOverride(ing.name) ? ingredientOverrides[ing.name.toLowerCase().trim()] : Math.round(scaleAmountRaw(ing.amounts[0].amount) * 100) / 100"
                      @change="setIngredientOverride(ing.name.toLowerCase().trim(), $event.target.value)"
                      step="any" min="0"
                      class="bg-white dark:bg-stone-800 py-0.5 pr-1 pl-1.5 border border-stone-300 focus:border-primary-400 dark:border-stone-600 rounded focus:outline-none focus:ring-1 focus:ring-primary-400 w-14 font-medium text-stone-800 dark:text-stone-200 text-sm text-right ingredient-number-input"
                      :class="hasOverride(ing.name) ? 'ring-1 ring-primary-300 dark:ring-primary-600 border-primary-300 dark:border-primary-600' : ''" />
                    <span v-if="getPantryInfo(ing.name)" class="tabular-nums text-xs whitespace-nowrap"
                      :class="
                        getPantryInfo(ing.name).isPermanent
                          ? 'text-stone-400 dark:text-stone-500'
                          : getPantryInfo(ing.name).amount >= getEffectiveAmount(ing)
                            ? 'text-stone-400 dark:text-stone-500'
                            : getPantryInfo(ing.name).amount > 0
                              ? 'text-amber-500 dark:text-amber-400'
                              : 'text-red-400 dark:text-red-400'
                      "
                    >/ <template v-if="getPantryInfo(ing.name).isPermanent">∞</template><template v-else>{{ getPantryInfo(ing.name).amount ? formatAmount(getPantryInfo(ing.name).amount) : '0' }}</template></span>
                    <span class="text-stone-500 dark:text-stone-400 text-xs">{{ ing.amounts[0].unit }}</span>
                  </template>
                  <template v-else>
                    <span class="font-medium text-stone-800 dark:text-stone-200 text-sm text-right">
                      <template v-for="(a, i) in ing.amounts" :key="i">
                        <template v-if="i > 0">, </template>
                        {{ scaleAmount(a.amount) }}&nbsp;{{ a.unit }}
                      </template>
                    </span>
                  </template>
                  <button v-if="hasOverride(ing.name)"
                    @click="resetIngredientOverride(ing.name.toLowerCase().trim())"
                    class="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors" title="Zurücksetzen">
                    <RotateCcw class="w-3 h-3" />
                  </button>
                </span>
              </template>

              <span class="text-stone-700 dark:text-stone-300 text-base" :class="adjustmentMode ? 'basis-full sm:basis-auto sm:flex-1 pl-7 sm:pl-0 -mt-1 sm:mt-0' : ''">
                {{ ing.name }}
                <span v-if="ing.is_optional || ing.notes" class="block text-stone-400 text-xs leading-snug">
                  <template v-if="ing.is_optional">(optional)</template>
                  <template v-if="ing.is_optional && ing.notes"> – </template>
                  <template v-if="ing.notes">{{ ing.notes }}</template>
                </span>
              </span>
            </li>
          </ul>
        </div>

        <!-- ── ZUBEREITUNG + HISTORIE (rechts) ── -->
        <div class="flex flex-col gap-6">
          <!-- Zubereitung -->
          <div class="flex-1 bg-white dark:bg-stone-900 p-5 border border-stone-200 dark:border-stone-800 rounded-xl">
            <div class="flex justify-between items-center mb-5">
              <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">👨‍🍳 Zubereitung</h2>
              <button @click="showRevisionModal = true"
                class="flex items-center gap-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/30 px-2.5 py-1.5 border border-stone-200 hover:border-primary-300 dark:border-stone-700 dark:hover:border-primary-700 rounded-lg font-medium text-stone-500 hover:text-primary-600 dark:hover:text-primary-400 dark:text-stone-400 text-xs transition-colors"
                title="Rezept per KI überarbeiten">
                <Sparkles class="w-3.5 h-3.5" /> KI-Überarbeitung
              </button>
            </div>
            <div class="space-y-8">
              <div v-for="step in recipe.steps" :key="step.id" class="flex gap-3">
                <div class="flex justify-center items-center bg-primary-100 dark:bg-primary-900/50 mt-0.5 rounded-full w-7 h-7 shrink-0">
                  <span class="font-bold text-primary-700 dark:text-primary-300 text-xs">{{ step.step_number }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <h3 v-if="step.title" class="font-medium text-stone-800 dark:text-stone-200 text-base">{{ step.title }}</h3>
                    <span v-if="step.duration_minutes" class="flex items-center gap-1 text-stone-400 text-sm whitespace-nowrap shrink-0">
                      <Clock class="w-3.5 h-3.5" /> {{ step.duration_minutes }} Min.
                    </span>
                  </div>
                  <p class="text-stone-600 dark:text-stone-400 text-base leading-loose" v-html="highlightIngredients(step.instruction)" />
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>

      <!-- ═══════════════════ KI-ÜBERARBEITUNG MODAL ═══════════════════ -->
      <RecipeRevisionModal
        v-if="recipe?.id"
        v-model="showRevisionModal"
        :recipe-id="recipe.id"
        @revised="onRevised"
        @created="onRevisionCopy"
      />
    </div>

    <!-- Laden -->
    <div v-else class="flex justify-center py-16">
      <div class="border-2 border-primary-200 border-t-primary-600 rounded-full w-8 h-8 animate-spin" />
    </div>

    <!-- ═══════════════════ KOCHHISTORIE POPUP ═══════════════════ -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showHistoryPopup" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="showHistoryPopup = false">
          <div class="bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-sm overflow-hidden">
            <div class="flex justify-between items-center p-5 border-stone-200 dark:border-stone-700 border-b">
              <h3 class="font-bold text-stone-800 dark:text-stone-100 text-lg">📊 Kochhistorie</h3>
              <button @click="showHistoryPopup = false"
                class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-full transition-colors">
                <X class="w-5 h-5 text-stone-500" />
              </button>
            </div>
            <div class="space-y-2.5 p-5 max-h-72 overflow-y-auto">
              <div v-if="recipe?.history?.length" v-for="entry in recipe.history" :key="entry.id"
                class="flex items-center gap-3 text-stone-600 dark:text-stone-400 text-sm">
                <span class="shrink-0">{{ formatDate(entry.cooked_at) }}</span>
                <span v-if="entry.rating" class="text-amber-400 shrink-0">{{ '⭐'.repeat(entry.rating) }}</span>
                <span v-if="entry.notes" class="text-stone-400 truncate">– {{ entry.notes }}</span>
              </div>
              <p v-else class="text-stone-400 text-sm">Noch keine Einträge.</p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══════════════════ WOCHENPLANER MODAL ═══════════════════ -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showPlannerModal" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="showPlannerModal = false">
          <div class="bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-md overflow-hidden">
            <!-- Header -->
            <div class="flex justify-between items-center p-5 border-stone-200 dark:border-stone-700 border-b">
              <h3 class="font-bold text-stone-800 dark:text-stone-100 text-lg">📅 Zum Wochenplaner</h3>
              <button @click="showPlannerModal = false"
                class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-full transition-colors">
                <X class="w-5 h-5 text-stone-500" />
              </button>
            </div>

            <div class="space-y-5 p-5">
              <!-- Wochen-Navigation -->
              <div>
                <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Woche</label>
                <div class="flex items-center gap-2">
                  <button @click="plannerWeekOffset--"
                    class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors">
                    <ChevronLeft class="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  </button>
                  <span class="flex-1 font-medium text-stone-700 dark:text-stone-300 text-sm text-center">
                    {{ plannerWeekLabel }}
                  </span>
                  <button @click="plannerWeekOffset++"
                    class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors">
                    <ChevronRight class="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  </button>
                </div>
              </div>

              <!-- Tag auswählen -->
              <div>
                <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Tag</label>
                <div class="gap-1.5 grid grid-cols-7">
                  <button v-for="(day, idx) in plannerWeekDays" :key="idx"
                    @click="plannerDay = idx"
                    :class="[
                      'flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-colors',
                      plannerDay === idx
                        ? 'bg-primary-600 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                    ]">
                    <span>{{ day.short }}</span>
                    <span class="opacity-75 text-[10px]">{{ day.date }}</span>
                  </button>
                </div>
              </div>

              <!-- Slot auswählen -->
              <div>
                <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Mahlzeit</label>
                <div class="gap-2 grid grid-cols-2">
                  <button v-for="mt in plannerMealTypes" :key="mt.key"
                    @click="plannerSlot = mt.key"
                    :class="[
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      plannerSlot === mt.key
                        ? 'bg-primary-600 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                    ]">
                    <span>{{ mt.icon }}</span> {{ mt.label }}
                  </button>
                </div>
              </div>

              <!-- Portionen -->
              <div>
                <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Portionen</label>
                <div class="flex items-center gap-3">
                  <button @click="plannerServings = Math.max(1, plannerServings - 1)"
                    class="flex justify-center items-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-full w-9 h-9 transition-colors">
                    <Minus class="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  </button>
                  <span class="w-16 font-semibold text-stone-700 dark:text-stone-300 text-center">{{ plannerServings }}</span>
                  <button @click="plannerServings++"
                    class="flex justify-center items-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-full w-9 h-9 transition-colors">
                    <Plus class="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  </button>
                </div>
              </div>

              <!-- Hinzufügen Button -->
              <button @click="addToPlan" :disabled="addingToPlan"
                class="flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 shadow-sm px-4 py-3 rounded-xl w-full font-medium text-white transition-colors">
                <CalendarPlus v-if="!addingToPlan" class="w-5 h-5" />
                <div v-else class="border-2 border-white/30 border-t-white rounded-full w-5 h-5 animate-spin" />
                {{ addingToPlan ? 'Wird hinzugefügt…' : 'Zum Wochenplan hinzufügen' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══════ NÄHRWERT-DETAIL-POPUP ═══════ -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showNutritionPopup" class="z-50 fixed inset-0 flex justify-center items-center bg-black/30 p-4" @click.self="showNutritionPopup = false">
          <div class="flex flex-col bg-white dark:bg-stone-900 shadow-xl border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <!-- Header -->
            <div class="flex justify-between items-center px-5 pt-5 pb-3">
              <h3 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">Nährwerte pro Portion</h3>
              <button @click="showNutritionPopup = false"
                class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1 rounded-lg text-stone-400 transition-colors">
                <X class="w-5 h-5" />
              </button>
            </div>

            <div class="flex-1 space-y-4 px-5 pb-5 overflow-y-auto">
              <!-- Gesamtwerte -->
              <div class="gap-2 grid grid-cols-2">
                <div class="bg-orange-50 dark:bg-orange-900/20 p-3 border border-orange-200/60 dark:border-orange-800/40 rounded-xl text-center">
                  <div class="font-bold text-orange-700 dark:text-orange-300 text-lg">{{ scaledNutrition.calories }}</div>
                  <div class="text-orange-600/70 dark:text-orange-400/70 text-xs">kcal</div>
                </div>
                <div class="bg-blue-50 dark:bg-blue-900/20 p-3 border border-blue-200/60 dark:border-blue-800/40 rounded-xl text-center">
                  <div class="font-bold text-blue-700 dark:text-blue-300 text-lg">{{ scaledNutrition.protein }}g</div>
                  <div class="text-blue-600/70 dark:text-blue-400/70 text-xs">Eiweiß</div>
                </div>
                <div class="bg-amber-50 dark:bg-amber-900/20 p-3 border border-amber-200/60 dark:border-amber-800/40 rounded-xl text-center">
                  <div class="font-bold text-amber-700 dark:text-amber-300 text-lg">{{ scaledNutrition.carbs }}g</div>
                  <div class="text-amber-600/70 dark:text-amber-400/70 text-xs">Kohlenhydrate</div>
                </div>
                <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 border border-yellow-200/60 dark:border-yellow-800/40 rounded-xl text-center">
                  <div class="font-bold text-yellow-700 dark:text-yellow-300 text-lg">{{ scaledNutrition.fat }}g</div>
                  <div class="text-yellow-600/70 dark:text-yellow-400/70 text-xs">Fett</div>
                </div>
              </div>

              <!-- Aufschlüsselung pro Zutat -->
              <div v-if="parsedNutritionDetails.length" class="overflow-x-auto">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="border-stone-200 dark:border-stone-700 border-b text-stone-500 dark:text-stone-400">
                      <th class="py-1.5 pr-2 font-medium hover:text-stone-700 dark:hover:text-stone-200 text-left cursor-pointer select-none" @click="toggleNutritionSort('name')">Zutat{{ nutritionSortIcon('name') }}</th>
                      <th class="px-2 py-1.5 font-medium hover:text-stone-700 dark:hover:text-stone-200 text-right cursor-pointer select-none" @click="toggleNutritionSort('amount')">Menge{{ nutritionSortIcon('amount') }}</th>
                      <th class="px-2 py-1.5 font-medium hover:text-stone-700 dark:hover:text-stone-200 text-right cursor-pointer select-none" @click="toggleNutritionSort('calories')">kcal{{ nutritionSortIcon('calories') }}</th>
                      <th class="px-2 py-1.5 font-medium hover:text-stone-700 dark:hover:text-stone-200 text-right cursor-pointer select-none" @click="toggleNutritionSort('protein')">E{{ nutritionSortIcon('protein') }}</th>
                      <th class="px-2 py-1.5 font-medium hover:text-stone-700 dark:hover:text-stone-200 text-right cursor-pointer select-none" @click="toggleNutritionSort('carbs')">KH{{ nutritionSortIcon('carbs') }}</th>
                      <th class="py-1.5 pl-2 font-medium hover:text-stone-700 dark:hover:text-stone-200 text-right cursor-pointer select-none" @click="toggleNutritionSort('fat')">F{{ nutritionSortIcon('fat') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(d, i) in parsedNutritionDetails" :key="i" class="border-stone-100 dark:border-stone-800 border-b">
                      <td class="py-1.5 pr-2 text-stone-700 dark:text-stone-300">{{ d.name }}</td>
                      <td class="px-2 py-1.5 text-stone-500 dark:text-stone-400 text-right">{{ d.amount }}</td>
                      <td class="px-2 py-1.5 text-orange-600 dark:text-orange-400 text-right">{{ d.calories }}</td>
                      <td class="px-2 py-1.5 text-blue-600 dark:text-blue-400 text-right">{{ d.protein }}g</td>
                      <td class="px-2 py-1.5 text-amber-600 dark:text-amber-400 text-right">{{ d.carbs }}g</td>
                      <td class="py-1.5 pl-2 text-yellow-600 dark:text-yellow-400 text-right">{{ d.fat }}g</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="font-semibold text-stone-800 dark:text-stone-100">
                      <td class="pt-2 pr-2" colspan="2">Summe/Portion</td>
                      <td class="px-2 pt-2 text-orange-700 dark:text-orange-300 text-right">{{ nutritionDetailsSum.calories }}</td>
                      <td class="px-2 pt-2 text-blue-700 dark:text-blue-300 text-right">{{ nutritionDetailsSum.protein }}g</td>
                      <td class="px-2 pt-2 text-amber-700 dark:text-amber-300 text-right">{{ nutritionDetailsSum.carbs }}g</td>
                      <td class="pt-2 pl-2 text-yellow-700 dark:text-yellow-300 text-right">{{ nutritionDetailsSum.fat }}g</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- KI-Hinweis -->
              <div v-if="recipe.nutrition_note" class="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl">
                <p class="text-stone-600 dark:text-stone-300 text-sm leading-relaxed whitespace-pre-line">💡 {{ recipe.nutrition_note }}</p>
              </div>

              <!-- Disclaimer -->
              <p class="text-[10px] text-stone-400 dark:text-stone-500 text-center">Alle Angaben sind KI-geschätzt und können von den tatsächlichen Werten abweichen.</p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Kochmodus (Vollbild) -->
    <CookingMode
      v-if="recipe"
      v-model="showCookingMode"
      :recipe="recipe"
      :adjusted-servings="adjustedServings"
      @finished="handleCookingFinished"
    />

    <!-- Bestätigungs-Dialog zum Löschen -->
    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Rezept löschen?"
      :message="deleteMessage"
      confirm-text="Endgültig löschen"
      cancel-text="Abbrechen"
      variant="danger"
      :loading="deleting"
      @confirm="deleteRecipe"
    />

    <!-- Wochenplan-Swap-Dialog -->
    <ConfirmDialog
      v-model="showMealPlanSwapDialog"
      title="Im Wochenplan verschieben?"
      :message="pendingSwapData ? `Dieses Rezept steht für ${dayNames[pendingSwapData.dayOfWeek]} (${mealTypeLabels[pendingSwapData.mealType] || pendingSwapData.mealType}) auf dem Wochenplan. Auf heute verschieben und als erledigt markieren?` : ''"
      confirm-text="Verschieben & erledigen"
      cancel-text="Nein, nur gekocht"
      variant="info"
      @confirm="confirmMealPlanSwap"
      @cancel="pendingSwapData = null"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRecipesStore } from '@/stores/recipes.js';
import { useMealPlanStore } from '@/stores/mealplan.js';
import { usePantryStore } from '@/stores/pantry.js';
import { useNotification } from '@/composables/useNotification.js';
import { Star, Clock, Users, ChefHat, Pencil, Plus, Minus, Trash2, CalendarPlus, X, ChevronLeft, ChevronRight, Maximize, Warehouse, RotateCcw, Smartphone, EllipsisVertical, Sparkles, HelpCircle, Share2, Link } from 'lucide-vue-next';
import { useWakeLock } from '@/composables/useWakeLock.js';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import AddToCollection from '@/components/collections/AddToCollection.vue';
import CookingMode from '@/components/recipes/CookingMode.vue';
import RecipeRevisionModal from '@/components/recipes/RecipeRevisionModal.vue';
import { useIngredientIcons } from '@/composables/useIngredientIcons.js';
import { apiRaw } from '@/composables/useApi.js';
import { formatAmount } from '@/utils/formatAmount.js';

const route = useRoute();
const router = useRouter();
const recipesStore = useRecipesStore();
const mealPlanStore = useMealPlanStore();
const pantryStore = usePantryStore();
const { showSuccess } = useNotification();
const { loadIcons, getEmoji } = useIngredientIcons();
const { isActive: wakeLockActive, isSupported: wakeLockSupported, toggle: toggleWakeLock } = useWakeLock();

const recipe = computed(() => recipesStore.currentRecipe);
const adjustedServings = ref(4);
const showDeleteDialog = ref(false);
const showHistoryPopup = ref(false);
const deleting = ref(false);
const showMealPlanSwapDialog = ref(false);
const showMoreMenu = ref(false);
// Touch-Erkennung mit mehreren Heuristiken (Brave blockiert ggf. maxTouchPoints)
const isTouchDevice = ref(
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0 ||
  window.matchMedia('(pointer: coarse)').matches
);
const pendingSwapData = ref(null);
const showCookingMode = ref(false);
const showRevisionModal = ref(false);
const showNutritionPopup = ref(false);

// ─── Zutaten-Anpassungsmodus ───
const adjustmentMode = ref(false);
const ingredientOverrides = reactive({});

/** Anzahl aktiver Overrides */
const overrideCount = computed(() => Object.keys(ingredientOverrides).length);

/** Anpassungsmodus aktivieren/deaktivieren */
async function toggleAdjustmentMode() {
  adjustmentMode.value = !adjustmentMode.value;
  if (adjustmentMode.value) {
    // Verfügbare Vorratsmengen laden
    const ingredients = (recipe.value?.ingredients || []).map(ing => ({
      name: ing.name,
      amount: scaleAmountRaw(ing.amount),
      unit: ing.unit,
    }));
    await pantryStore.checkIngredients(ingredients);
  } else {
    pantryStore.clearIngredientAvailability();
  }
}

/** Override für eine Zutat setzen */
function setIngredientOverride(key, value) {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return;
  ingredientOverrides[key] = num;
}

/** Override für eine Zutat zurücksetzen */
function resetIngredientOverride(key) {
  delete ingredientOverrides[key];
}

/** Alle Overrides zurücksetzen */
function resetAllOverrides() {
  for (const key of Object.keys(ingredientOverrides)) {
    delete ingredientOverrides[key];
  }
}

/** Effektive Menge einer Zutat (mit Override oder skaliert) */
function getEffectiveAmount(ing) {
  const key = ing.name.toLowerCase().trim();
  if (key in ingredientOverrides) {
    return ingredientOverrides[key];
  }
  return scaleAmountRaw(ing.amount);
}

/** Vorrats-Info für eine Zutat abrufen */
function getPantryInfo(name) {
  return pantryStore.ingredientAvailability.get(name.toLowerCase().trim()) || null;
}

/** Hat eine Zutat einen Override? */
function hasOverride(name) {
  return name.toLowerCase().trim() in ingredientOverrides;
}

// ─── Wochenplaner-Modal ───
const showPlannerModal = ref(false);
const addingToPlan = ref(false);
const plannerWeekOffset = ref(0);
const plannerDay = ref((() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })());
const plannerSlot = ref('mittag');
const plannerServings = ref(4);

const plannerMealTypes = [
  { key: 'fruehstueck', label: 'Frühstück', icon: '🌅' },
  { key: 'mittag', label: 'Mittag', icon: '☀️' },
  { key: 'abendessen', label: 'Abend', icon: '🌙' },
  { key: 'snack', label: 'Snack', icon: '🍎' },
];

const plannerWeekStart = computed(() => {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1) + plannerWeekOffset.value * 7);
  return monday.toISOString().split('T')[0];
});

const plannerWeekDays = computed(() => {
  const [y, m, d] = plannerWeekStart.value.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  return ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((short, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return { short, date: `${dt.getDate()}.${dt.getMonth() + 1}.` };
  });
});

const plannerWeekLabel = computed(() => {
  const [y, m, d] = plannerWeekStart.value.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt) => `${dt.getDate()}.${dt.getMonth() + 1}.`;
  // ISO-8601 Kalenderwoche berechnen (Donnerstag der Woche bestimmt das Jahr/KW)
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  const kw = Math.ceil(((thursday - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `KW ${kw}: ${fmt(monday)} – ${fmt(sunday)}${sunday.getFullYear()}`;
});

async function addToPlan() {
  addingToPlan.value = true;
  try {
    const result = await mealPlanStore.addRecipeToPlan(
      recipe.value.id,
      plannerDay.value,
      plannerSlot.value,
      plannerWeekStart.value,
      plannerServings.value,
    );
    showPlannerModal.value = false;
    const dayLabel = plannerWeekDays.value[plannerDay.value]?.short || '';
    const slotLabel = plannerMealTypes.find(mt => mt.key === plannerSlot.value)?.label || '';
    const icon = result.replaced ? '🔄' : '📅';
    showSuccess(`${result.message || 'Zum Wochenplan hinzugefügt'} (${dayLabel}, ${slotLabel}) ${icon}`);
  } catch {
    // Fehler wird von useApi angezeigt
  } finally {
    addingToPlan.value = false;
  }
}

const deleteMessage = computed(() => {
  const title = recipe.value?.title || 'dieses Rezept';
  return 'Möchtest du „' + title + '" wirklich unwiderruflich löschen? Alle Zutaten, Schritte und die Kochhistorie gehen verloren.';
});

// Schwierigkeitsgrad-Darstellung
const difficultyEmoji = computed(() => ({ leicht: '🟢', mittel: '🟡', schwer: '🔴' })[recipe.value?.difficulty] || '🟡');
const difficultyColor = computed(() => ({
  leicht: 'text-green-700 dark:text-green-400',
  mittel: 'text-amber-700 dark:text-amber-400',
  schwer: 'text-red-700 dark:text-red-400',
})[recipe.value?.difficulty] || '');

// ── Einheiten-Konvertierung (analog zu backend/utils/helpers.js) ──

function normalizeUnitLocal(unit) {
  if (!unit) return '';
  const cleaned = unit.trim().replace(/\.$/, '');
  const map = {
    gramm: 'g', gram: 'g', gr: 'g',
    kilogramm: 'kg', kilogram: 'kg',
    milliliter: 'ml',
    liter: 'l',
    teelöffel: 'TL', tl: 'TL',
    esslöffel: 'EL', el: 'EL',
  };
  return map[cleaned.toLowerCase()] || unit;
}

/** Konvertiert Menge in Basiseinheit (g / ml) – Standard + zutat-spezifische Umrechnungen */
function toBaseUnit(amount, unit, ingredientName) {
  if (!amount) return { amount: 0, unit: unit || '' };
  const stdConv = {
    kg:  { base: 'g',  factor: 1000 },
    l:   { base: 'ml', factor: 1000 },
    EL:  { base: 'g',  factor: 15 },
    TL:  { base: 'g',  factor: 5 },
  };
  const norm = normalizeUnitLocal(unit);

  // Bereits in Basiseinheit
  if (norm === 'g' || norm === 'ml') return { amount, unit: norm };

  // Standard-Konvertierung (kg→g, l→ml, EL→g, TL→g)
  if (stdConv[norm]) {
    return { amount: amount * stdConv[norm].factor, unit: stdConv[norm].base };
  }

  return { amount, unit: norm };
}

// Flache Zutatenliste — gleiche Zutat zusammenführen, Einheiten in Basis konvertieren
const flatIngredients = computed(() => {
  const ingredients = recipe.value?.ingredients || [];
  const merged = new Map();

  for (const ing of ingredients) {
    const key = ing.name.toLowerCase().trim();

    if (merged.has(key)) {
      const existing = merged.get(key);
      if (ing.amount) {
        // In Basiseinheit konvertieren (g/ml) soweit möglich
        const base = toBaseUnit(ing.amount, ing.unit, ing.name);
        const compat = existing.amounts.find(
          a => a.unit.toLowerCase() === base.unit.toLowerCase()
        );
        if (compat) {
          compat.amount += base.amount;
        } else {
          existing.amounts.push({ amount: base.amount, unit: base.unit });
        }
      }
      // Nur optional wenn ALLE Einträge optional sind
      if (!ing.is_optional) existing.is_optional = false;
      // Notes zusammenführen
      if (ing.notes && !existing.notes?.includes(ing.notes)) {
        existing.notes = [existing.notes, ing.notes].filter(Boolean).join(', ');
      }
    } else {
      const base = ing.amount ? toBaseUnit(ing.amount, ing.unit, ing.name) : null;
      merged.set(key, {
        ...ing,
        amounts: base ? [{ amount: base.amount, unit: base.unit }] : [],
      });
    }
  }

  // Top-Level amount/unit für Einzel-Einheit beibehalten
  const result = [...merged.values()];
  for (const ing of result) {
    if (ing.amounts.length === 1) {
      ing.amount = ing.amounts[0].amount;
      ing.unit = ing.amounts[0].unit;
    } else if (ing.amounts.length > 1) {
      ing.amount = null;
      ing.unit = null;
    }
  }
  // Alphabetisch nach Name sortieren
  result.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return result;
});

// Portionsrechner: Menge umrechnen (Rohwert für Berechnungen)
function scaleAmountRaw(amount) {
  if (!amount || !recipe.value?.servings) return 0;
  return (amount / recipe.value.servings) * adjustedServings.value;
}

// Nährwerte pro Portion (bleiben konstant, da bereits pro Portion gespeichert)
const scaledNutrition = computed(() => {
  const r = recipe.value;
  if (!r?.calories) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  return {
    calories: Math.round(r.calories),
    protein: Math.round((r.protein || 0) * 10) / 10,
    carbs: Math.round((r.carbs || 0) * 10) / 10,
    fat: Math.round((r.fat || 0) * 10) / 10,
  };
});

const nutritionSortKey = ref('name');
const nutritionSortAsc = ref(true);

function toggleNutritionSort(key) {
  if (nutritionSortKey.value === key) {
    nutritionSortAsc.value = !nutritionSortAsc.value;
  } else {
    nutritionSortKey.value = key;
    nutritionSortAsc.value = key === 'name';
  }
}

function nutritionSortIcon(key) {
  if (nutritionSortKey.value !== key) return '';
  return nutritionSortAsc.value ? ' ↑' : ' ↓';
}

const parsedNutritionDetails = computed(() => {
  const raw = recipe.value?.nutrition_details;
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    const key = nutritionSortKey.value;
    const dir = nutritionSortAsc.value ? 1 : -1;
    return [...arr].sort((a, b) => {
      if (key === 'name') return dir * (a.name || '').localeCompare(b.name || '', 'de');
      const aNum = key === 'amount' ? parseFloat(a.amount) || 0 : (a[key] || 0);
      const bNum = key === 'amount' ? parseFloat(b.amount) || 0 : (b[key] || 0);
      return dir * (aNum - bNum);
    });
  } catch { return []; }
});

const nutritionDetailsSum = computed(() => {
  const details = parsedNutritionDetails.value;
  if (!details.length) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  return {
    calories: Math.round(details.reduce((s, d) => s + (d.calories || 0), 0)),
    protein: Math.round(details.reduce((s, d) => s + (d.protein || 0), 0)),
    carbs: Math.round(details.reduce((s, d) => s + (d.carbs || 0), 0)),
    fat: Math.round(details.reduce((s, d) => s + (d.fat || 0), 0)),
  };
});

// Formatierte Anzeige mit Unicode-Brüchen (½, ¼, ¾ …)
function scaleAmount(amount) {
  const raw = scaleAmountRaw(amount);
  return raw ? formatAmount(raw) : '';
}

// Zutat-Farbe bestimmen (anhand des Namens) – nur Fallback für "•"
// Wird nicht mehr benötigt, da jetzt Emojis verwendet werden.

// Zutaten im Kochschritt-Text hervorheben (mit Emoji-Prefix)
function highlightIngredients(text) {
  if (!text || !recipe.value?.ingredients) return escapeHtml(text || '');

  // Zuerst HTML escapen, dann Highlights einfügen
  let result = escapeHtml(text);

  // Zutatennamen deduplizieren und nach Länge sortieren (längste zuerst),
  // damit "Olivenöl" vor "Öl" matcht und kein doppeltes Wrapping entsteht
  const uniqueNames = [...new Set(recipe.value.ingredients.map(i => i.name))];
  uniqueNames.sort((a, b) => b.length - a.length);

  // Einzelne Regex mit Alternation: alle Zutaten in einem Durchlauf ersetzen
  const escapedNames = uniqueNames.map(n =>
    escapeHtml(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  if (!escapedNames.length) return result;

  // Map für schnelles Emoji-Lookup (escaped name → original name)
  const nameMap = new Map();
  uniqueNames.forEach((n, i) => nameMap.set(escapedNames[i].toLowerCase(), n));

  const combined = new RegExp('\\b(' + escapedNames.join('|') + ')\\b', 'gi');
  result = result.replace(combined, (match) => {
    const emoji = getEmoji(nameMap.get(match.toLowerCase()) || match);
    const prefix = emoji ? emoji + ' ' : '';
    return '<span class="ingredient-highlight">' + prefix + match + '</span>';
  });

  return result;
}

// HTML-Entities escapen um XSS über v-html zu verhindern
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const mealTypeLabels = { mittag: 'Mittagessen', abendessen: 'Abendessen' };

async function markCooked() {
  // ingredientOverrides vorbereiten: nur Overrides senden, die vom skalierten Wert abweichen
  const overrides = {};
  if (Object.keys(ingredientOverrides).length) {
    for (const [key, val] of Object.entries(ingredientOverrides)) {
      overrides[key] = val;
    }
  }

  const data = await recipesStore.markAsCooked(recipe.value.id, {
    servings: adjustedServings.value,
    ingredientOverrides: Object.keys(overrides).length ? overrides : undefined,
  });
  let msg = 'Als gekocht markiert! 👨‍🍳';
  if (data?.pantryUpdated) {
    const pantryMsg = ` (${data.pantryUpdated} Vorräte angepasst)`;
    msg = data?.mealPlanUpdated
      ? `Als gekocht markiert & im Wochenplan erledigt! 👨‍🍳${pantryMsg}`
      : `Als gekocht markiert! 👨‍🍳${pantryMsg}`;
  } else if (data?.mealPlanUpdated) {
    msg = 'Als gekocht markiert & im Wochenplan erledigt! 👨‍🍳';
  }
  showSuccess(msg);
  await recipesStore.fetchRecipe(recipe.value.id);

  // Anpassungsmodus zurücksetzen
  adjustmentMode.value = false;
  resetAllOverrides();
  pantryStore.clearIngredientAvailability();

  // Rezept steht an einem anderen Tag auf dem Wochenplan → Swap anbieten
  if (data?.pendingMealPlanSync) {
    pendingSwapData.value = data.pendingMealPlanSync;
    showMealPlanSwapDialog.value = true;
  }
}

async function confirmMealPlanSwap() {
  if (!pendingSwapData.value) return;
  const { planId, entryId } = pendingSwapData.value;
  const data = await mealPlanStore.markCooked(planId, entryId);
  showMealPlanSwapDialog.value = false;
  pendingSwapData.value = null;
  const pantryMsg = data?.pantryUpdated ? ` (${data.pantryUpdated} Vorräte angepasst)` : '';
  showSuccess(`Im Wochenplan auf heute verschoben & erledigt! ✅${pantryMsg}`);
}

async function handleCookingFinished() {
  await markCooked();
}

async function deleteRecipe() {
  deleting.value = true;
  try {
    await recipesStore.deleteRecipe(recipe.value.id);
    showDeleteDialog.value = false;
    showSuccess('Rezept gelöscht! 🗑️');
    router.push('/recipes');
  } catch {
    // Fehler wird von useApi angezeigt
  } finally {
    deleting.value = false;
  }
}

/** Rezept per Link teilen */
async function handleShare() {
  try {
    const result = await apiRaw(`/recipes/${recipe.value.id}/share`, { method: 'POST' });
    const shareUrl = `${window.location.origin}/shared/${result.share_token}`;

    // Native Share API falls verfügbar (mobile)
    if (navigator.share) {
      await navigator.share({
        title: recipe.value.title,
        text: `Schau dir dieses Rezept an: ${recipe.value.title}`,
        url: shareUrl,
      });
    } else {
      // Fallback: In Zwischenablage kopieren
      await navigator.clipboard.writeText(shareUrl);
      showSuccess('Share-Link kopiert! 📋');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      // AbortError = User hat Share-Dialog geschlossen
      showSuccess('Teilen fehlgeschlagen');
    }
  }
}

/** KI-Überarbeitung: Rezept wurde überschrieben → neu laden */
async function onRevised() {
  await recipesStore.fetchRecipe(route.params.id);
  if (recipe.value) {
    adjustedServings.value = recipe.value.servings;
  }
}

/** KI-Überarbeitung: Kopie erstellt → zum neuen Rezept navigieren */
function onRevisionCopy(newRecipeId) {
  router.push({ name: 'recipe-detail', params: { id: newRecipeId } });
}

onMounted(async () => {
  await loadIcons();
  await recipesStore.fetchRecipe(route.params.id);
  if (recipe.value) {
    adjustedServings.value = recipe.value.servings;
  }
});

// Bei Rezept-Wechsel: Anpassungsmodus zurücksetzen
watch(() => route.params.id, () => {
  adjustmentMode.value = false;
  resetAllOverrides();
  pantryStore.clearIngredientAvailability();
});
</script>

<style scoped>
.meta-badge {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  background-color: var(--color-stone-100);
  padding-inline: calc(var(--spacing) * 3);
  padding-block: calc(var(--spacing) * 1);
  border-radius: var(--radius-full);
  color: var(--color-stone-600);
  font-size: var(--text-sm);
  line-height: var(--text-sm--line-height);
}
:is(.dark .meta-badge) {
  background-color: var(--color-stone-800);
  color: var(--color-stone-400);
}
/* Nativer Number-Spinner: dezenter und mit Abstand zur Zahl */
.ingredient-number-input::-webkit-inner-spin-button,
.ingredient-number-input::-webkit-outer-spin-button {
  opacity: 1;
  margin-left: 6px;
}
.ingredient-number-input {
  -moz-appearance: textfield;
}
</style>
