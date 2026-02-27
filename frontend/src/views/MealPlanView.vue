<!--
  ============================================
  MealPlanView – Moderner Wochenplaner
  ============================================
  Features:
  - Funktionierende Wochen-Navigation (lädt Plan beim Wechsel)
  - Wochen-Raster (Desktop) + Tages-Ansicht (Mobile / Klick)
  - Rezeptbilder, Zubereitungszeit, Schwierigkeit
  - Drag & Drop zwischen Slots
  - Rezept tauschen mit intelligenten Vorschlägen
  - Generierungs-Dialog mit Mahlzeiten-Auswahl
  - Gekocht-Markierung (toggle)
-->
<template>
  <div class="space-y-6 mx-auto max-w-7xl animate-fade-in">

    <!-- ═══════════════════ HEADER ═══════════════════ -->
    <div class="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl">🗓️ Wochenplaner</h1>
        <p class="text-stone-500 dark:text-stone-400 text-sm">
          Intelligenter Essensplan – score-basiert &amp; per Drag&amp;Drop anpassbar
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <button v-if="currentPlan" @click="toggleLockPlan"
          :class="['flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors',
            isLocked
              ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900'
              : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400']"
          :title="isLocked ? 'Fixierung aufheben' : 'Woche fixieren (bereits eingekauft)'">
          <Lock v-if="isLocked" class="w-4 h-4" />
          <Unlock v-else class="w-4 h-4" />
          <span class="hidden sm:inline">{{ isLocked ? 'Fixiert' : 'Fixieren' }}</span>
        </button>
        <button @click="showLoadDialog = true"
          class="flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 px-3 py-2 rounded-xl text-stone-600 dark:text-stone-400 text-sm transition-colors"
          title="Gespeicherten Plan laden">
          <FolderSearch class="w-4 h-4" />
          <span class="hidden sm:inline">Laden</span>
        </button>
        <button v-if="currentPlan && !isLocked" @click="confirmDeletePlan"
          class="flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950 px-3 py-2 rounded-xl text-red-500 text-sm transition-colors">
          <Trash2 class="w-4 h-4" /> <span class="hidden sm:inline">Löschen</span>
        </button>
        <!-- Split-Button: Generieren + Einstellungen -->
        <div class="flex sm:flex-initial flex-1 shadow-sm rounded-xl overflow-hidden">
          <button @click="showGenerateModal = true" :disabled="store.generating"
            class="flex sm:flex-initial flex-1 justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-3 sm:px-4 py-2 font-medium text-white text-sm transition-colors">
            <Sparkles class="w-4 h-4" :class="{ 'animate-pulse': store.generating }" />
            <span class="hidden sm:inline">{{ store.generating ? 'Wird erstellt…' : 'Plan generieren' }}</span>
            <span class="sm:hidden">{{ store.generating ? 'Erstellt…' : 'Generieren' }}</span>
          </button>
          <button @click="showGenSettings = true"
            class="flex items-center bg-primary-600 hover:bg-primary-700 px-2.5 py-2 border-primary-500 border-l text-white transition-colors"
            title="Generierungs-Einstellungen">
            <Settings class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════ WOCHEN-NAVIGATION ═══════════════════ -->
    <div class="flex flex-wrap justify-between items-center gap-3">
      <div class="flex items-center gap-1">
        <button @click="changeWeek(-1)" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors">
          <ChevronLeft class="w-5 h-5 text-stone-600 dark:text-stone-400" />
        </button>
        <button @click="goToToday"
          class="bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-3 py-1.5 rounded-lg font-medium text-stone-700 dark:text-stone-300 text-sm transition-colors">
          Heute
        </button>
        <button @click="changeWeek(1)" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-2 rounded-lg transition-colors">
          <ChevronRight class="w-5 h-5 text-stone-600 dark:text-stone-400" />
        </button>
      </div>

      <span class="font-semibold text-stone-700 dark:text-stone-300 text-sm">
        {{ weekLabel }}
      </span>

      <!-- Ansicht-Toggle + Slot-Einstellungen -->
      <div class="flex items-center gap-2">
        <!-- Sichtbare Slots -->
        <div class="relative">
          <button @click="showSlotSettings = !showSlotSettings"
            :class="[
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
              showSlotSettings
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400'
            ]">
            <Settings class="w-4 h-4" />
            <span class="hidden sm:inline">Slots</span>
          </button>
          <Transition name="fade">
            <div v-if="showSlotSettings"
              class="sm:right-0 left-0 sm:left-auto z-30 absolute bg-white dark:bg-stone-900 shadow-lg mt-2 p-3 border border-stone-200 dark:border-stone-700 rounded-xl w-52">
              <p class="mb-2 font-medium text-stone-700 dark:text-stone-300 text-xs uppercase tracking-wide">Sichtbare Zeitslots</p>
              <label v-for="mt in allMealTypes" :key="mt.key"
                class="flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-800 px-2 py-1.5 rounded-lg transition-colors cursor-pointer">
                <input type="checkbox" :value="mt.key" v-model="visibleSlots"
                  class="rounded text-primary-600 accent-primary-600" />
                <span class="text-sm">{{ mt.icon }} {{ mt.label }}</span>
              </label>
              <p v-if="visibleSlots.length === 0" class="mt-1 text-amber-600 text-xs">
                Mindestens ein Slot sollte sichtbar sein
              </p>
            </div>
          </Transition>
          <!-- Backdrop zum Schließen -->
          <div v-if="showSlotSettings" @click="showSlotSettings = false" class="z-20 fixed inset-0" />
        </div>

        <div class="flex bg-stone-100 dark:bg-stone-800 rounded-lg overflow-hidden">
          <button @click="viewMode = 'week'" :class="viewToggleClass('week')">
            <LayoutGrid class="w-4 h-4" /> <span class="hidden sm:inline">Woche</span>
          </button>
          <button @click="viewMode = 'day'" :class="viewToggleClass('day')">
            <CalendarDays class="w-4 h-4" /> <span class="hidden sm:inline">Tag</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════ INHALT ═══════════════════ -->

    <!-- KI-/Algorithmus-Reasoning -->
    <Transition name="fade">
      <!-- Lade-Zustand: Reasoning wird im Hintergrund geladen -->
      <div v-if="store.reasoningLoading && !store.reasoning && currentPlan" key="reasoning-loading"
           class="relative bg-linear-to-r from-primary-50 dark:from-primary-950/50 to-transparent px-4 py-3 border border-primary-200 dark:border-primary-800 rounded-xl">
        <div class="flex items-start gap-3">
          <div class="flex justify-center items-center bg-primary-100 dark:bg-primary-900 rounded-lg w-8 h-8 shrink-0">
            <div class="border-2 border-primary-200 border-t-primary-600 rounded-full w-4 h-4 animate-spin" />
          </div>
          <!-- Desktop: volles Loading -->
          <div class="hidden lg:block flex-1 min-w-0">
            <p class="mb-0.5 font-medium text-primary-800 dark:text-primary-200 text-xs uppercase tracking-wide">KI-Begründung</p>
            <div class="space-y-1.5">
              <div class="bg-primary-100 dark:bg-primary-900/50 rounded w-4/5 h-3 animate-pulse" />
              <div class="bg-primary-100 dark:bg-primary-900/50 rounded w-3/5 h-3 animate-pulse" />
            </div>
          </div>
          <!-- Mobile: kompaktes Loading -->
          <div class="lg:hidden flex-1 min-w-0">
            <p class="font-medium text-primary-800 dark:text-primary-200 text-xs uppercase tracking-wide">KI-Begründung wird geladen…</p>
          </div>
        </div>
      </div>

      <!-- Fertiges Reasoning -->
      <div v-else-if="store.reasoning && currentPlan" key="reasoning-ready" class="relative border rounded-xl"
           :class="[
             store.reasoningSource === 'ai'
               ? 'bg-linear-to-r from-primary-50 dark:from-primary-950/50 to-transparent border-primary-200 dark:border-primary-800'
               : 'bg-linear-to-r from-stone-50 dark:from-stone-900/50 to-transparent border-stone-200 dark:border-stone-700',
             reasoningCollapsed ? 'lg:px-4 lg:py-3' : 'px-4 py-3'
           ]">
        <!-- Desktop: immer voll sichtbar -->
        <div class="hidden lg:flex items-start gap-3">
          <div class="flex justify-center items-center rounded-lg w-8 h-8 shrink-0"
               :class="store.reasoningSource === 'ai' ? 'bg-primary-100 dark:bg-primary-900' : 'bg-stone-100 dark:bg-stone-800'">
            <Sparkles v-if="store.reasoningSource === 'ai'" class="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <Info v-else class="w-4 h-4 text-stone-500 dark:text-stone-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="mb-0.5 font-medium text-xs uppercase tracking-wide"
               :class="store.reasoningSource === 'ai' ? 'text-primary-800 dark:text-primary-200' : 'text-stone-600 dark:text-stone-400'">
              {{ store.reasoningSource === 'ai' ? 'KI-Begründung' : 'Plan-Zusammenfassung' }}
              <span v-if="store.reasoningSource === 'algorithm'" class="opacity-70 font-normal normal-case tracking-normal">(KI nicht verfügbar)</span>
            </p>
            <p class="text-stone-700 dark:text-stone-300 text-sm leading-relaxed">{{ store.reasoning }}</p>
          </div>
          <button @click="store.reasoning = null" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1 rounded-lg transition-colors shrink-0" title="Schließen">
            <X class="w-4 h-4 text-stone-400" />
          </button>
        </div>
        <!-- Mobile: einklappbar -->
        <div class="lg:hidden">
          <button @click="reasoningCollapsed = !reasoningCollapsed" class="flex items-center gap-2.5 px-3.5 py-2.5 w-full text-left">
            <div class="flex justify-center items-center rounded-lg w-7 h-7 shrink-0"
                 :class="store.reasoningSource === 'ai' ? 'bg-primary-100 dark:bg-primary-900' : 'bg-stone-100 dark:bg-stone-800'">
              <Sparkles v-if="store.reasoningSource === 'ai'" class="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              <Info v-else class="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
            </div>
            <span class="flex-1 font-medium text-xs uppercase tracking-wide"
                  :class="store.reasoningSource === 'ai' ? 'text-primary-800 dark:text-primary-200' : 'text-stone-600 dark:text-stone-400'">
              {{ store.reasoningSource === 'ai' ? 'KI-Begründung' : 'Plan-Zusammenfassung' }}
            </span>
            <ChevronDown class="w-4 h-4 text-stone-400 transition-transform duration-200" :class="{ 'rotate-180': !reasoningCollapsed }" />
          </button>
          <Transition name="fade">
            <div v-if="!reasoningCollapsed" class="px-3.5 pb-3">
              <p class="text-stone-700 dark:text-stone-300 text-sm leading-relaxed">{{ store.reasoning }}</p>
              <button @click="store.reasoning = null" class="mt-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-xs underline hover:no-underline">
                Ausblenden
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>

    <!-- Laden -->
    <div v-if="store.loading || store.generating" class="flex flex-col items-center gap-3 py-16">
      <div class="border-2 border-primary-200 border-t-primary-600 rounded-full w-10 h-10 animate-spin" />
      <p class="text-stone-500 text-sm">{{ store.generating ? 'Plan wird generiert…' : 'Lade Plan…' }}</p>
    </div>

    <!-- Kein Plan -->
    <div v-else-if="!currentPlan" class="py-16 text-center">
      <div class="mb-4 text-6xl">📋</div>
      <h2 class="mb-2 font-semibold text-stone-700 dark:text-stone-300 text-xl">Kein Plan für diese Woche</h2>
      <p class="mx-auto mb-6 max-w-md text-stone-500 dark:text-stone-400 text-sm">
        Erstelle einen intelligenten Essensplan basierend auf deinen Rezepten, Kochhistorie und Vorräten.
      </p>
      <div class="flex flex-wrap justify-center gap-3">
        <button @click="showGenerateModal = true"
          class="bg-primary-600 hover:bg-primary-700 px-6 py-3 rounded-xl font-medium text-white transition-colors">
          <Sparkles class="inline mr-2 w-4 h-4" /> Plan generieren
        </button>
        <button @click="showLoadDialog = true"
          class="bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-6 py-3 rounded-xl font-medium text-stone-700 dark:text-stone-300 transition-colors">
          <FolderSearch class="inline mr-2 w-4 h-4" /> Plan laden
        </button>
      </div>
    </div>

    <!-- ═══════════════════ WOCHEN-ANSICHT ═══════════════════ -->
    <!-- Fixiert-Banner: Desktop -->
    <div v-if="isLocked && currentPlan" class="hidden lg:flex items-center gap-2 bg-amber-50 dark:bg-amber-950/50 px-4 py-2.5 border border-amber-200 dark:border-amber-800 rounded-xl">
      <Lock class="w-4 h-4 text-amber-500 shrink-0" />
      <p class="text-amber-700 dark:text-amber-300 text-sm">
        <span class="font-medium">Woche fixiert</span> – Bereits eingekauft. Änderungen sind gesperrt.
      </p>
      <button @click="toggleLockPlan" class="ml-auto text-amber-600 hover:text-amber-800 dark:hover:text-amber-200 dark:text-amber-400 text-xs underline hover:no-underline shrink-0">
        Aufheben
      </button>
    </div>
    <!-- Fixiert-Banner: Mobile (kompakt) -->
    <div v-if="isLocked && currentPlan" class="lg:hidden flex items-center gap-2 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 border border-amber-200 dark:border-amber-800 rounded-xl">
      <Lock class="w-4 h-4 text-amber-500 shrink-0" />
      <span class="flex-1 font-medium text-amber-700 dark:text-amber-300 text-xs">Woche fixiert</span>
      <button @click="toggleLockPlan" class="text-amber-600 hover:text-amber-800 dark:hover:text-amber-200 dark:text-amber-400 text-xs underline hover:no-underline shrink-0">
        Aufheben
      </button>
    </div>

    <!-- ═══════ DESKTOP WOCHEN-ANSICHT: KOMPAKT (3+ Slots) ═══════ -->
    <div v-if="currentPlan && viewMode === 'week' && isCompactGrid" class="hidden lg:block -mx-4 lg:mx-0 px-4 lg:px-0 overflow-x-auto">
      <div class="gap-x-2 gap-y-1.5 grid grid-cols-7 lg:min-w-0 min-w-4xl">

        <!-- ── Zeile 1: Tag-Header ── -->
        <button v-for="(day, dayIdx) in weekDays" :key="'h-'+dayIdx"
          @click="openDayView(dayIdx)" :class="dayHeaderClass(dayIdx)">
          <div class="font-semibold text-sm">{{ day.short }}</div>
          <div class="opacity-75 font-normal text-xs">{{ day.date }}</div>
        </button>

        <!-- ── Pro Mahlzeit-Typ: eine Zeile quer über alle 7 Tage ── -->
        <template v-for="mt in mealTypes" :key="mt.key">
          <div v-for="(day, dayIdx) in weekDays" :key="mt.key+'-'+dayIdx"
            class="meal-slot"
            :class="[
              { 'meal-slot-dragover': dragTarget?.day === dayIdx && dragTarget?.meal === mt.key },
              { 'meal-slot--inactive': !dayHasMeals(dayIdx) }
            ]"
            @dragover.prevent="!isLocked && onDragOver(dayIdx, mt.key)"
            @dragleave="onDragLeave"
            @drop.prevent="!isLocked && onDrop(dayIdx, mt.key)">

            <div class="mb-0.5 text-[0.65rem] text-stone-400 dark:text-stone-500 uppercase tracking-wide">
              {{ mt.icon }} {{ mt.label }}
            </div>

            <!-- Gefüllter Slot -->
            <div v-if="getMeal(dayIdx, mt.key)" class="group meal-card"
              :class="{ 'meal-card--cooked': getMeal(dayIdx, mt.key).is_cooked }"
              :draggable="!isLocked"
              @dragstart="!isLocked && onDragStart($event, getMeal(dayIdx, mt.key))"
              @dragend="onDragEnd"
              @click="selectMeal(getMeal(dayIdx, mt.key))">

              <!-- Rezeptbild -->
              <div class="relative rounded-lg aspect-4/3 overflow-hidden">
                <img v-if="getMeal(dayIdx, mt.key).image_url"
                  :src="getMeal(dayIdx, mt.key).image_url"
                  :alt="getMeal(dayIdx, mt.key).recipe_title"
                  class="w-full h-full object-cover"
                  loading="lazy" />
                <div v-else class="flex justify-center items-center bg-stone-100 dark:bg-stone-800 w-full h-full">
                  <UtensilsCrossed class="w-6 h-6 text-stone-300 dark:text-stone-600" />
                </div>
                <!-- Gekocht-Badge -->
                <div v-if="getMeal(dayIdx, mt.key).is_cooked"
                  class="top-1 right-1 absolute place-items-center grid rounded-full w-5 h-5 bg-accent-500">
                  <Check class="w-3 h-3 text-white" />
                </div>
                <!-- Portionen-Badge -->
                <div class="top-1 left-1 absolute flex items-center gap-0.5 bg-black/50 px-1.5 py-0.5 rounded text-[0.6rem] text-white"
                  :class="{ 'cursor-pointer hover:bg-black/70': !isLocked }"
                  @click.stop="!isLocked && openServingsPopup(getMeal(dayIdx, mt.key), $event)">
                  <Users class="w-2.5 h-2.5" /> {{ getMeal(dayIdx, mt.key).servings }}
                </div>
                <!-- Schwierigkeit -->
                <span v-if="getMeal(dayIdx, mt.key).difficulty"
                  class="bottom-1 left-1 absolute bg-black/50 px-1.5 py-0.5 rounded text-[0.6rem] text-white">
                  {{ getMeal(dayIdx, mt.key).difficulty }}
                </span>
              </div>
              <!-- Titel + Info -->
              <div class="mt-1.5">
                <div class="font-medium text-stone-800 dark:text-stone-200 text-xs line-clamp-2 leading-tight">
                  {{ getMeal(dayIdx, mt.key).recipe_title }}
                </div>
                <div v-if="getMeal(dayIdx, mt.key).total_time" class="flex items-center gap-1 mt-0.5 text-[0.6rem] text-stone-400">
                  <Clock class="w-3 h-3" /> {{ getMeal(dayIdx, mt.key).total_time }} min
                </div>
              </div>
            </div>

            <!-- Leerer Slot -->
            <button v-else class="meal-card-empty"
              :disabled="isLocked"
              @click="!isLocked && openSwapModal({ day_of_week: dayIdx, meal_type: mt.key, _isNew: true })"
              @dragover.prevent="!isLocked && onDragOver(dayIdx, mt.key)"
              @drop.prevent="!isLocked && onDrop(dayIdx, mt.key)">
              <Plus v-if="!isLocked" class="w-4 h-4 text-stone-300 dark:text-stone-600" />
              <Lock v-else class="w-3.5 h-3.5 text-stone-300 dark:text-stone-600" />
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- ═══════ DESKTOP WOCHEN-ANSICHT: GROSSE KARTEN (1-2 Slots) ═══════ -->
    <div v-if="currentPlan && viewMode === 'week' && !isCompactGrid" class="hidden lg:block space-y-6">
      <template v-for="mt in mealTypes" :key="'lg-'+mt.key">
        <!-- Slot-Überschrift -->
        <div v-if="mealTypes.length > 1" class="flex items-center gap-2 mb-3">
          <span class="text-lg">{{ mt.icon }}</span>
          <h3 class="font-semibold text-stone-700 dark:text-stone-200 text-base">{{ mt.label }}</h3>
        </div>

        <!-- Karten-Grid -->
        <div class="gap-x-4 gap-y-8 grid grid-cols-2 xl:grid-cols-4"
          :class="mealTypes.length === 1 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'">

          <div v-for="(day, dayIdx) in weekDays" :key="mt.key+'-lg-'+dayIdx"
            class="flex flex-col gap-2"
            @dragover.prevent="!isLocked && onDragOver(dayIdx, mt.key)"
            @dragleave="onDragLeave"
            @drop.prevent="!isLocked && onDrop(dayIdx, mt.key)">

            <!-- Tag-Header (Kalender-Stil) -->
            <div class="flex items-center gap-3">
              <div class="flex justify-center items-center rounded-xl w-10 h-10 font-bold tabular-nums text-lg shrink-0"
                :class="isToday(dayIdx)
                  ? 'bg-primary-500 text-white shadow-sm'
                  : isDayPast(dayIdx)
                    ? 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200'">
                {{ day.dateObj.getDate() }}
              </div>
              <div class="min-w-0 leading-tight">
                <div class="font-semibold text-sm truncate"
                  :class="isToday(dayIdx)
                    ? 'text-primary-600 dark:text-primary-400'
                    : isDayPast(dayIdx)
                      ? 'text-stone-400 dark:text-stone-500'
                      : 'text-stone-700 dark:text-stone-200'">
                  {{ day.dateObj.toLocaleDateString('de-DE', { weekday: 'long' }) }}
                </div>
                <div class="text-xs"
                  :class="isToday(dayIdx) ? 'text-primary-500/70 dark:text-primary-400/60' : 'text-stone-400 dark:text-stone-500'">
                  {{ day.dateObj.toLocaleDateString('de-DE', { month: 'long' }) }}
                </div>
              </div>
            </div>

            <!-- Gefüllte Karte (RecipeCard-Design) -->
            <div v-if="getMeal(dayIdx, mt.key)"
              class="group meal-card-large"
              :class="{ 'meal-card-large--cooked': getMeal(dayIdx, mt.key).is_cooked }"
              :draggable="!isLocked"
              @dragstart="!isLocked && onDragStart($event, getMeal(dayIdx, mt.key))"
              @dragend="onDragEnd"
              @click="selectMeal(getMeal(dayIdx, mt.key))">

              <!-- Bild -->
              <div class="relative bg-stone-100 dark:bg-stone-800 aspect-4/3 overflow-hidden">
                <img v-if="getMeal(dayIdx, mt.key).image_url"
                  :src="getMeal(dayIdx, mt.key).image_url"
                  :alt="getMeal(dayIdx, mt.key).recipe_title"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy" />
                <div v-else class="flex justify-center items-center opacity-50 w-full h-full text-5xl">🍽️</div>

                <!-- Favorit-Button (oben rechts) -->
                <button
                  @click.stop="toggleMealFavorite(getMeal(dayIdx, mt.key))"
                  class="top-2 right-2 absolute bg-white/80 hover:bg-white dark:bg-stone-900/80 dark:hover:bg-stone-900 backdrop-blur-sm p-1.5 rounded-full transition-colors">
                  <Star class="w-4 h-4" :class="getMeal(dayIdx, mt.key).is_favorite ? 'fill-amber-400 text-amber-400' : 'text-stone-400'" />
                </button>

                <!-- Gekocht-Badge -->
                <div v-if="getMeal(dayIdx, mt.key).is_cooked"
                  class="top-10 right-2 absolute place-items-center grid rounded-full w-6 h-6 bg-accent-500">
                  <Check class="w-3.5 h-3.5 text-white" />
                </div>

                <!-- Schwierigkeitsgrad (unten links, bunt) -->
                <span v-if="getMeal(dayIdx, mt.key).difficulty"
                  :class="['absolute bottom-2 left-2 px-2 py-0.5 text-xs font-medium rounded-full', difficultyClasses[getMeal(dayIdx, mt.key).difficulty] || difficultyClasses.mittel]">
                  {{ getMeal(dayIdx, mt.key).difficulty }}
                </span>

                <!-- KI-Badge (unten rechts) -->
                <span v-if="getMeal(dayIdx, mt.key).ai_generated"
                  class="right-2 bottom-2 absolute bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full font-medium text-indigo-700 dark:text-indigo-300 text-xs">
                  🤖 KI
                </span>
              </div>

              <!-- Info -->
              <div class="p-4">
                <h4 class="font-semibold text-stone-800 dark:group-hover:text-primary-400 dark:text-stone-100 group-hover:text-primary-600 truncate transition-colors">
                  {{ getMeal(dayIdx, mt.key).recipe_title }}
                </h4>
                <p v-if="getMeal(dayIdx, mt.key).recipe_description" class="mt-1 text-stone-500 dark:text-stone-400 text-sm line-clamp-2">
                  {{ getMeal(dayIdx, mt.key).recipe_description }}
                </p>

                <!-- Meta-Infos -->
                <div class="flex items-center gap-3 mt-3 text-stone-500 dark:text-stone-400 text-xs">
                  <span v-if="getMeal(dayIdx, mt.key).total_time" class="flex items-center gap-1">
                    <Clock class="w-3.5 h-3.5" /> {{ getMeal(dayIdx, mt.key).total_time }} Min.
                  </span>
                  <span class="flex items-center gap-1"
                    :class="{ 'cursor-pointer hover:text-stone-700 dark:hover:text-stone-200': !isLocked }"
                    @click.stop="!isLocked && openServingsPopup(getMeal(dayIdx, mt.key), $event)">
                    <Users class="w-3.5 h-3.5" /> {{ getMeal(dayIdx, mt.key).servings }} Port.
                  </span>
                  <span v-if="getMeal(dayIdx, mt.key).times_cooked" class="flex items-center gap-1">
                    <ChefHat class="w-3.5 h-3.5" /> {{ getMeal(dayIdx, mt.key).times_cooked }}x
                  </span>
                </div>

                <!-- Kategorien -->
                <div v-if="getMeal(dayIdx, mt.key).category_names" class="flex flex-wrap gap-1 mt-3">
                  <span v-for="cat in getMeal(dayIdx, mt.key).category_names.split(',')"
                    :key="cat"
                    class="bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full text-stone-600 dark:text-stone-400 text-xs">
                    {{ cat.trim() }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Leere Karte -->
            <button v-else
              class="meal-card-large-empty"
              :disabled="isLocked"
              @click="!isLocked && openSwapModal({ day_of_week: dayIdx, meal_type: mt.key, _isNew: true })"
              @dragover.prevent="!isLocked && onDragOver(dayIdx, mt.key)"
              @drop.prevent="!isLocked && onDrop(dayIdx, mt.key)">
              <div class="text-center">
                <Plus v-if="!isLocked" class="mx-auto w-6 h-6 text-stone-300 dark:text-stone-600" />
                <Lock v-else class="mx-auto w-5 h-5 text-stone-300 dark:text-stone-600" />
              </div>
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- ═══════════════════ MOBILE WOCHEN-ANSICHT ═══════════════════ -->
    <div v-if="currentPlan && viewMode === 'week'" class="lg:hidden space-y-3">
      <!-- Vergangene Tage Toggle -->
      <button v-if="pastDaysCount > 0 && pastDaysCount < 7" @click="showPastDays = !showPastDays"
        class="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-3 py-2 rounded-xl w-full text-stone-500 dark:text-stone-400 text-sm transition-colors">
        <ChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': showPastDays }" />
        {{ showPastDays ? 'Vergangene Tage ausblenden' : `${pastDaysCount} vergangene${pastDaysCount === 1 ? 'r Tag' : ' Tage'} anzeigen` }}
      </button>

      <template v-for="(day, dayIdx) in weekDays" :key="'mob-'+dayIdx">
        <div v-if="showPastDays || !isDayPast(dayIdx) || pastDaysCount === 7" class="space-y-2">
          <!-- Tag-Header -->
          <div :class="[
            'flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer',
            isToday(dayIdx)
              ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
              : isDayPast(dayIdx)
                ? 'bg-stone-50 dark:bg-stone-900 text-stone-400 dark:text-stone-500'
                : dayHasMeals(dayIdx)
                  ? 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
          ]" @click="openDayView(dayIdx)">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm">{{ day.short }}</span>
              <span class="opacity-75 text-xs">{{ day.date }}</span>
            </div>
            <span v-if="isToday(dayIdx)" class="bg-primary-600 px-2 py-0.5 rounded-full font-medium text-[0.65rem] text-white">Heute</span>
          </div>

          <!-- Mahlzeiten -->
          <template v-for="mt in mealTypes" :key="mt.key+'-mob-'+dayIdx">
            <!-- Gefüllte Mahlzeit -->
            <div v-if="getMeal(dayIdx, mt.key)"
              class="mobile-meal-card"
              :class="{ 'opacity-55': getMeal(dayIdx, mt.key).is_cooked }"
              @click="router.push('/recipes/' + getMeal(dayIdx, mt.key).recipe_id)">
              <!-- Bild -->
              <div class="relative aspect-[5/3] overflow-hidden">
                <img v-if="getMeal(dayIdx, mt.key).image_url"
                  :src="getMeal(dayIdx, mt.key).image_url"
                  :alt="getMeal(dayIdx, mt.key).recipe_title"
                  class="w-full h-full object-cover"
                  loading="lazy" />
                <div v-else class="flex justify-center items-center bg-stone-100 dark:bg-stone-800 w-full h-full">
                  <UtensilsCrossed class="w-10 h-10 text-stone-300 dark:text-stone-600" />
                </div>
                <!-- Gradient Overlay -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                <!-- Mahlzeit-Badge -->
                <div class="top-2.5 left-2.5 absolute bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-lg font-medium text-white text-xs">
                  {{ mt.icon }} {{ mt.label }}
                </div>
                <!-- Gekocht-Badge -->
                <div v-if="getMeal(dayIdx, mt.key).is_cooked"
                  class="top-2.5 right-2.5 absolute place-items-center grid rounded-full w-7 h-7 bg-accent-500">
                  <Check class="w-4 h-4 text-white" />
                </div>
                <!-- Info-Badges unten -->
                <div class="right-2.5 bottom-2.5 left-2.5 absolute flex items-center gap-2">
                  <span class="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg text-white text-xs"
                    @click.stop="!isLocked && openServingsPopup(getMeal(dayIdx, mt.key), $event)">
                    <Users class="w-3.5 h-3.5" /> {{ getMeal(dayIdx, mt.key).servings }}
                  </span>
                  <span v-if="getMeal(dayIdx, mt.key).total_time"
                    class="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg text-white text-xs">
                    <Clock class="w-3.5 h-3.5" /> {{ getMeal(dayIdx, mt.key).total_time }} min
                  </span>
                  <span v-if="getMeal(dayIdx, mt.key).difficulty"
                    class="bg-black/50 backdrop-blur-sm ml-auto px-2 py-1 rounded-lg text-white text-xs">
                    {{ getMeal(dayIdx, mt.key).difficulty }}
                  </span>
                </div>
              </div>
              <!-- Titel + Options-Button -->
              <div class="flex items-center gap-2 px-3.5 py-2.5">
                <h4 class="flex-1 font-semibold text-stone-800 dark:text-stone-100 text-base leading-snug">
                  {{ getMeal(dayIdx, mt.key).recipe_title }}
                </h4>
                <button @click.stop="selectMeal(getMeal(dayIdx, mt.key))"
                  class="flex justify-center items-center hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 dark:text-stone-500 transition-colors shrink-0"
                  title="Optionen">
                  <EllipsisVertical class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Leerer Slot (mobile) -->
            <button v-else-if="!isLocked"
              class="flex justify-center items-center gap-1.5 py-3.5 border-2 border-stone-200 hover:border-primary-300 dark:border-stone-800 dark:hover:border-primary-700 border-dashed rounded-xl w-full text-stone-400 hover:text-primary-500 dark:text-stone-600 text-sm transition-colors"
              @click="openSwapModal({ day_of_week: dayIdx, meal_type: mt.key, _isNew: true })">
              <Plus class="w-4 h-4" /> {{ mt.icon }} {{ mt.label }}
            </button>
          </template>
        </div>
      </template>

    </div>

    <!-- ═══════════════════ TAGES-ANSICHT ═══════════════════ -->
    <div v-if="currentPlan && viewMode === 'day'" class="space-y-3">
      <!-- Tag-Navigation -->
      <div class="flex gap-1.5 pb-2 overflow-x-auto">
        <button v-for="(day, idx) in weekDays" :key="idx"
          @click="selectedDayIdx = idx"
          :class="[
            'shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            idx === selectedDayIdx
              ? 'bg-primary-600 text-white'
              : isToday(idx)
                ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
          ]">
          <div>{{ day.short }}</div>
          <div class="opacity-75 text-[0.65rem]">{{ day.date }}</div>
        </button>
      </div>

      <!-- Mahlzeiten des Tages -->
      <div class="space-y-4">
        <div v-for="mt in mealTypes" :key="mt.key">

          <!-- ── Desktop: horizontales Layout (wie bisher) ── -->
          <div v-if="getMeal(selectedDayIdx, mt.key)" class="hidden lg:block">
            <h3 class="mb-2 font-semibold text-stone-600 dark:text-stone-400 text-sm">{{ mt.icon }} {{ mt.label }}</h3>
            <div class="group day-meal-card"
              :class="{ 'day-meal-card--cooked': getMeal(selectedDayIdx, mt.key).is_cooked }">
              <div class="flex gap-4">
                <div class="relative rounded-xl w-28 sm:w-36 h-20 sm:h-24 overflow-hidden shrink-0">
                  <img v-if="getMeal(selectedDayIdx, mt.key).image_url"
                    :src="getMeal(selectedDayIdx, mt.key).image_url"
                    class="w-full h-full object-cover" loading="lazy" />
                  <div v-else class="flex justify-center items-center bg-stone-100 dark:bg-stone-800 w-full h-full">
                    <UtensilsCrossed class="w-8 h-8 text-stone-300 dark:text-stone-600" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-semibold text-stone-800 dark:text-stone-100 text-base truncate">
                    {{ getMeal(selectedDayIdx, mt.key).recipe_title }}
                  </h4>
                  <div class="flex flex-wrap items-center gap-3 mt-1 text-stone-500 dark:text-stone-400 text-xs">
                    <span class="flex items-center gap-1"
                      :class="{ 'cursor-pointer hover:text-stone-700 dark:hover:text-stone-200': !isLocked }"
                      @click.stop="!isLocked && openServingsPopup(getMeal(selectedDayIdx, mt.key), $event)">
                      <Users class="w-3.5 h-3.5" /> {{ getMeal(selectedDayIdx, mt.key).servings }} Pers.
                    </span>
                    <span v-if="getMeal(selectedDayIdx, mt.key).total_time" class="flex items-center gap-1">
                      <Clock class="w-3.5 h-3.5" /> {{ getMeal(selectedDayIdx, mt.key).total_time }} min
                    </span>
                    <span v-if="getMeal(selectedDayIdx, mt.key).difficulty" class="flex items-center gap-1">
                      <ChefHat class="w-3.5 h-3.5" /> {{ getMeal(selectedDayIdx, mt.key).difficulty }}
                    </span>
                    <span v-if="getMeal(selectedDayIdx, mt.key).is_cooked"
                      class="flex items-center gap-1 font-medium text-accent-600">
                      <Check class="w-3.5 h-3.5" /> Gekocht
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-2 mt-3">
                    <button @click="toggleCooked(getMeal(selectedDayIdx, mt.key))"
                      class="day-action-btn" :class="getMeal(selectedDayIdx, mt.key).is_cooked ? 'day-action-btn--active' : ''">
                      <Check class="w-3.5 h-3.5" />
                      {{ getMeal(selectedDayIdx, mt.key).is_cooked ? 'Rückgängig' : 'Gekocht' }}
                    </button>
                    <template v-if="!isLocked">
                      <button @click="openSwapModal(getMeal(selectedDayIdx, mt.key))" class="day-action-btn">
                        <RefreshCw class="w-3.5 h-3.5" /> Tauschen
                      </button>
                      <router-link :to="`/recipes/${getMeal(selectedDayIdx, mt.key).recipe_id}`" class="day-action-btn">
                        <Eye class="w-3.5 h-3.5" /> Rezept
                      </router-link>
                      <button @click="removeEntry(getMeal(selectedDayIdx, mt.key))" class="day-action-btn day-action-btn--danger">
                        <X class="w-3.5 h-3.5" /> Entfernen
                      </button>
                      <button @click="openBlockDialog(getMeal(selectedDayIdx, mt.key))" class="day-action-btn day-action-btn--danger">
                        <Ban class="w-3.5 h-3.5" /> Sperren
                      </button>
                    </template>
                    <router-link v-else :to="`/recipes/${getMeal(selectedDayIdx, mt.key).recipe_id}`" class="day-action-btn">
                      <Eye class="w-3.5 h-3.5" /> Rezept
                    </router-link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Mobile: Karten-Layout (Tap → Rezept, ⋮-Button → Optionen) ── -->
          <div v-if="getMeal(selectedDayIdx, mt.key)" class="lg:hidden">
            <div class="mobile-meal-card"
              :class="{ 'opacity-55': getMeal(selectedDayIdx, mt.key).is_cooked }"
              @click="router.push('/recipes/' + getMeal(selectedDayIdx, mt.key).recipe_id)">
              <!-- Bild -->
              <div class="relative aspect-[5/3] overflow-hidden">
                <img v-if="getMeal(selectedDayIdx, mt.key).image_url"
                  :src="getMeal(selectedDayIdx, mt.key).image_url"
                  :alt="getMeal(selectedDayIdx, mt.key).recipe_title"
                  class="w-full h-full object-cover"
                  loading="lazy" />
                <div v-else class="flex justify-center items-center bg-stone-100 dark:bg-stone-800 w-full h-full">
                  <UtensilsCrossed class="w-10 h-10 text-stone-300 dark:text-stone-600" />
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                <!-- Mahlzeit-Badge -->
                <div class="top-2.5 left-2.5 absolute bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-lg font-medium text-white text-xs">
                  {{ mt.icon }} {{ mt.label }}
                </div>
                <!-- Gekocht-Badge -->
                <div v-if="getMeal(selectedDayIdx, mt.key).is_cooked"
                  class="top-2.5 right-2.5 absolute place-items-center grid rounded-full w-7 h-7 bg-accent-500">
                  <Check class="w-4 h-4 text-white" />
                </div>
                <!-- Info-Badges unten -->
                <div class="right-2.5 bottom-2.5 left-2.5 absolute flex items-center gap-2">
                  <span class="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg text-white text-xs"
                    @click.stop="!isLocked && openServingsPopup(getMeal(selectedDayIdx, mt.key), $event)">
                    <Users class="w-3.5 h-3.5" /> {{ getMeal(selectedDayIdx, mt.key).servings }}
                  </span>
                  <span v-if="getMeal(selectedDayIdx, mt.key).total_time"
                    class="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg text-white text-xs">
                    <Clock class="w-3.5 h-3.5" /> {{ getMeal(selectedDayIdx, mt.key).total_time }} min
                  </span>
                  <span v-if="getMeal(selectedDayIdx, mt.key).difficulty"
                    class="bg-black/50 backdrop-blur-sm ml-auto px-2 py-1 rounded-lg text-white text-xs">
                    {{ getMeal(selectedDayIdx, mt.key).difficulty }}
                  </span>
                </div>
              </div>
              <!-- Titel + Options-Button -->
              <div class="flex items-center gap-2 px-3.5 py-2.5">
                <h4 class="flex-1 font-semibold text-stone-800 dark:text-stone-100 text-base leading-snug">
                  {{ getMeal(selectedDayIdx, mt.key).recipe_title }}
                </h4>
                <button @click.stop="selectMeal(getMeal(selectedDayIdx, mt.key))"
                  class="flex justify-center items-center hover:bg-stone-100 dark:hover:bg-stone-800 p-1.5 rounded-lg text-stone-400 dark:text-stone-500 transition-colors shrink-0"
                  title="Optionen">
                  <EllipsisVertical class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Leerer Slot (beide Varianten) -->
          <template v-if="!getMeal(selectedDayIdx, mt.key)">
            <h3 class="hidden lg:block mb-2 font-semibold text-stone-600 dark:text-stone-400 text-sm">{{ mt.icon }} {{ mt.label }}</h3>
            <!-- Desktop -->
            <div class="hidden lg:flex day-meal-empty">
              <span class="text-stone-400 text-sm">Keine Mahlzeit geplant</span>
            </div>
            <!-- Mobile -->
            <button v-if="!isLocked"
              class="lg:hidden flex justify-center items-center gap-1.5 py-3.5 border-2 border-stone-200 hover:border-primary-300 dark:border-stone-800 dark:hover:border-primary-700 border-dashed rounded-xl w-full text-stone-400 hover:text-primary-500 dark:text-stone-600 text-sm transition-colors"
              @click="openSwapModal({ day_of_week: selectedDayIdx, meal_type: mt.key, _isNew: true })">
              <Plus class="w-4 h-4" /> {{ mt.icon }} {{ mt.label }}
            </button>
            <div v-else class="lg:hidden flex day-meal-empty">
              <span class="text-stone-400 text-sm">Keine Mahlzeit geplant</span>
            </div>
          </template>
        </div>
      </div>

    </div>

    <!-- ═══════════════════ GENERIEREN-MODAL ═══════════════════ -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showGenerateModal" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="showGenerateModal = false">
          <div class="bg-white dark:bg-stone-900 shadow-2xl p-6 border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-md">
            <h2 class="flex items-center gap-2 mb-4 font-bold text-stone-800 dark:text-stone-100 text-lg">
              <Sparkles class="w-5 h-5 text-primary-500" /> Plan generieren
            </h2>

            <!-- Mahlzeiten auswählen -->
            <div class="mb-4">
              <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Welche Mahlzeiten?</label>
              <div class="gap-2 grid grid-cols-2">
                <label v-for="mt in allMealTypes" :key="mt.key"
                  :class="['flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors',
                    genMealTypes.includes(mt.key)
                      ? 'border-primary-400 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300'
                      : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800']">
                  <input type="checkbox" :value="mt.key" v-model="genMealTypes" class="accent-primary-600" />
                  {{ mt.icon }} {{ mt.label }}
                </label>
              </div>
            </div>

            <!-- Personen -->
            <div class="mb-4">
              <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Personen</label>
              <div class="flex items-center gap-3">
                <button @click="genPersons = Math.max(1, genPersons - 1)"
                  class="place-items-center grid bg-stone-100 dark:bg-stone-800 rounded-lg w-8 h-8 font-bold text-stone-600 dark:text-stone-400">−</button>
                <span class="w-8 font-semibold text-stone-800 dark:text-stone-100 text-lg text-center">{{ genPersons }}</span>
                <button @click="genPersons = Math.min(20, genPersons + 1)"
                  class="place-items-center grid bg-stone-100 dark:bg-stone-800 rounded-lg w-8 h-8 font-bold text-stone-600 dark:text-stone-400">+</button>
              </div>
            </div>

            <!-- Aktive Tage -->
            <div class="mb-5">
              <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Für welche Tage?</label>
              <div class="flex gap-1.5">
                <button v-for="(dayLabel, dayIdx) in ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']" :key="dayIdx"
                  @click="genActiveDays.includes(dayIdx) ? genActiveDays.splice(genActiveDays.indexOf(dayIdx), 1) : genActiveDays.push(dayIdx)"
                  :class="['flex-1 py-2 rounded-lg text-xs font-semibold transition-colors border',
                    genActiveDays.includes(dayIdx)
                      ? 'bg-primary-50 dark:bg-primary-950 border-primary-400 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                      : 'border-stone-200 dark:border-stone-700 text-stone-400 dark:text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800']">
                  {{ dayLabel }}
                </button>
              </div>
              <p v-if="genActiveDays.length === 0" class="mt-1 text-amber-600 text-xs">
                Mindestens ein Tag sollte aktiv sein
              </p>
            </div>

            <!-- Aktive Sammlungs-Info -->
            <div v-if="genSourceMode === 'collections' && genCollectionIds.length > 0"
              class="flex items-center gap-2 bg-primary-50 dark:bg-primary-950 mb-4 px-3 py-2 border border-primary-200 dark:border-primary-800 rounded-lg">
              <FolderOpen class="w-4 h-4 text-primary-500 shrink-0" />
              <p class="text-primary-700 dark:text-primary-300 text-xs">
                <span class="font-medium">{{ genCollectionIds.length }} Sammlung(en)</span> aktiv
                <button @click="showGenSettings = true; showGenerateModal = false"
                  class="ml-1 underline hover:no-underline">ändern</button>
              </p>
            </div>

            <div class="flex justify-end gap-2">
              <button @click="showGenerateModal = false"
                class="hover:bg-stone-100 dark:hover:bg-stone-800 px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 text-sm transition-colors">
                Abbrechen
              </button>
              <button @click="doGenerate" :disabled="store.generating || !genMealTypes.length || !genActiveDays.length"
                class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-xl font-medium text-white text-sm transition-colors">
                <Sparkles class="w-4 h-4" /> Generieren
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══════════════════ GENERIERUNGS-EINSTELLUNGEN-MODAL ═══════════════════ -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showGenSettings" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="showGenSettings = false">
          <div class="bg-white dark:bg-stone-900 shadow-2xl p-6 border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-md">
            <h2 class="flex items-center gap-2 mb-5 font-bold text-stone-800 dark:text-stone-100 text-lg">
              <Settings2 class="w-5 h-5 text-primary-500" /> Generierungs-Einstellungen
            </h2>

            <!-- Rezeptquelle: Sammlungen oder Alle -->
            <div class="mb-5">
              <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Rezeptquelle</label>
              <label class="flex items-center gap-2 mb-2 cursor-pointer">
                <input type="radio" v-model="genSourceMode" value="all" class="accent-primary-600" />
                <span class="text-stone-700 dark:text-stone-300 text-sm">Alle Rezepte</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="genSourceMode" value="collections" class="accent-primary-600" />
                <span class="text-stone-700 dark:text-stone-300 text-sm">Nur bestimmte Sammlungen</span>
              </label>
            </div>

            <!-- Sammlungs-Auswahl (nur wenn "collections" gewählt) -->
            <Transition name="fade">
              <div v-if="genSourceMode === 'collections'" class="mb-5">
                <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Sammlungen auswählen</label>
                <div v-if="collectionsStore.loading" class="text-stone-400 text-sm">Laden…</div>
                <div v-else-if="!collectionsStore.collections.length" class="text-stone-400 text-sm">
                  Keine Sammlungen vorhanden. Erstelle zuerst eine Sammlung.
                </div>
                <div v-else class="space-y-1 max-h-40 overflow-y-auto">
                  <label
                    v-for="col in collectionsStore.collections" :key="col.id"
                    :class="[
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors',
                      genCollectionIds.includes(col.id)
                        ? 'border-primary-400 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
                    ]"
                  >
                    <input type="checkbox" :value="col.id" v-model="genCollectionIds" class="accent-primary-600" />
                    <span
                      class="flex justify-center items-center rounded w-6 h-6 text-sm shrink-0"
                      :style="{ backgroundColor: col.color + '20' }"
                    >{{ col.icon }}</span>
                    <span class="flex-1 truncate">{{ col.name }}</span>
                    <span class="text-stone-400 text-xs shrink-0">{{ col.recipe_count ?? 0 }}</span>
                  </label>
                </div>
              </div>
            </Transition>

            <!-- Deduplizierung -->
            <div class="mb-5">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="genDeduplicate" class="rounded accent-primary-600" />
                <div>
                  <span class="font-medium text-stone-700 dark:text-stone-300 text-sm">Duplikate vermeiden</span>
                  <p class="text-stone-400 text-xs">Rezepte, die in mehreren gewählten Sammlungen vorkommen, nur einmal berücksichtigen.</p>
                </div>
              </label>
            </div>

            <!-- KI-Reasoning -->
            <div class="mb-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="genAiReasoning" class="rounded accent-primary-600" />
                <div>
                  <span class="font-medium text-stone-700 dark:text-stone-300 text-sm">🤖 KI-Begründung</span>
                  <p class="text-stone-400 text-xs">Die KI erklärt in 2-3 Sätzen, warum der Plan ausgewogen ist. Erfordert konfigurierten KI-Provider.</p>
                </div>
              </label>
            </div>

            <!-- Gesperrte Rezepte -->
            <div class="mb-6">
              <div class="flex justify-between items-center mb-2">
                <span class="font-medium text-stone-700 dark:text-stone-300 text-sm">🚫 Gesperrte Rezepte</span>
                <span v-if="blocksStore.activeBlocks.length" class="bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full font-medium text-red-600 dark:text-red-400 text-xs">
                  {{ blocksStore.activeBlocks.length }}
                </span>
              </div>
              <div v-if="!blocksStore.activeBlocks.length"
                class="py-3 text-stone-400 text-xs text-center">
                Keine Rezepte gesperrt
              </div>
              <div v-else class="space-y-1.5 max-h-40 overflow-y-auto">
                <div v-for="block in blocksStore.activeBlocks" :key="block.id"
                  class="flex items-center gap-2.5 bg-stone-50 dark:bg-stone-800 px-3 py-2 rounded-lg">
                  <Ban class="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-stone-700 dark:text-stone-300 text-sm truncate">{{ block.recipe_title }}</div>
                    <div class="text-stone-400 text-xs">
                      bis {{ new Date(block.blocked_until).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }}
                      <span v-if="block.reason" class="ml-1 text-stone-400 dark:text-stone-500">· {{ block.reason }}</span>
                    </div>
                  </div>
                  <button @click="doUnblockRecipe(block.id)"
                    class="hover:bg-red-100 dark:hover:bg-red-900/40 p-1 rounded-lg transition-colors shrink-0"
                    title="Sperre aufheben">
                    <ShieldOff class="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Aktive Einstellungen Zusammenfassung -->
            <div class="bg-stone-50 dark:bg-stone-800 mb-4 p-3 rounded-lg">
              <p class="text-stone-600 dark:text-stone-400 text-xs">
                <span class="font-medium">Aktiv:</span>
                {{ genSourceMode === 'all' ? 'Alle Rezepte' : `${genCollectionIds.length} Sammlung(en)` }}
                · {{ genDeduplicate ? 'Duplikate werden vermieden' : 'Duplikate erlaubt' }}
                · {{ genAiReasoning ? 'KI-Begründung an' : 'KI-Begründung aus' }}
                <span v-if="blocksStore.activeBlocks.length"> · {{ blocksStore.activeBlocks.length }} Rezept{{ blocksStore.activeBlocks.length > 1 ? 'e' : '' }} gesperrt</span>
              </p>
            </div>

            <div class="flex justify-end gap-2">
              <button @click="showGenSettings = false"
                class="hover:bg-stone-100 dark:hover:bg-stone-800 px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 text-sm transition-colors">
                Schließen
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══════════════════ TAUSCH-MODAL ═══════════════════ -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="swapModal.show" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="closeSwapModal">
          <div class="flex flex-col bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div class="flex justify-between items-center p-5 border-stone-200 dark:border-stone-800 border-b">
              <h2 class="font-bold text-stone-800 dark:text-stone-100 text-lg">
                <RefreshCw v-if="!swapModal.entry?._isNew" class="inline mr-2 w-5 h-5 text-primary-500" />
                <Plus v-else class="inline mr-2 w-5 h-5 text-primary-500" />
                {{ swapModal.entry?._isNew ? 'Rezept hinzufügen' : 'Rezept tauschen' }}
              </h2>
              <button @click="closeSwapModal" class="hover:bg-stone-100 dark:hover:bg-stone-800 p-1 rounded-lg">
                <X class="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div class="flex-1 p-5 overflow-y-auto">
              <p v-if="swapModal.loading" class="py-8 text-stone-500 text-sm text-center">Vorschläge werden geladen…</p>
              <p v-else-if="!swapModal.suggestions.length" class="py-8 text-stone-400 text-sm text-center">
                Keine passenden Rezepte für diesen Slot gefunden.<br>
                <span class="text-xs">Lege mehr Rezepte mit passenden Kategorien an.</span>
              </p>
              <div v-else class="space-y-2">
                <button v-for="s in swapModal.suggestions" :key="s.id"
                  @click="doSwap(s.id)"
                  class="group swap-suggestion">
                  <div class="relative rounded-lg w-16 h-12 overflow-hidden shrink-0">
                    <img v-if="s.image_url" :src="s.image_url" class="w-full h-full object-cover" loading="lazy" />
                    <div v-else class="flex justify-center items-center bg-stone-100 dark:bg-stone-800 w-full h-full">
                      <UtensilsCrossed class="w-4 h-4 text-stone-300" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-stone-800 dark:text-stone-200 text-sm truncate">{{ s.title }}</div>
                    <div class="flex items-center gap-2 text-stone-400 text-xs">
                      <span v-if="s.total_time"><Clock class="inline w-3 h-3" /> {{ s.total_time }} min</span>
                      <span v-if="s.difficulty">{{ s.difficulty }}</span>
                    </div>
                    <div v-if="s.hints?.length" class="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1">
                      <span v-for="(h, hi) in s.hints.slice(0, 3)" :key="hi"
                        class="text-[0.65rem] text-stone-500 dark:text-stone-400 whitespace-nowrap">
                        {{ h.icon }} {{ h.text }}
                      </span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-1 shrink-0">
                    <Star v-if="s.is_favorite" class="fill-amber-400 w-4 h-4 text-amber-400" />
                    <span class="bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded font-mono text-[0.6rem] text-stone-400 dark:text-stone-500">
                      {{ s.score }}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══════════════════ MEAL DETAIL POPUP (Wochen-Klick) ═══════════════════ -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="selectedMeal" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="selectedMeal = null">
          <div class="bg-white dark:bg-stone-900 shadow-2xl border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-xl overflow-hidden">
            <!-- Bild -->
            <div class="relative bg-stone-100 dark:bg-stone-800 h-56">
              <img v-if="selectedMeal.image_url" :src="selectedMeal.image_url"
                class="w-full h-full object-cover" />
              <div v-else class="flex justify-center items-center w-full h-full">
                <UtensilsCrossed class="w-12 h-12 text-stone-300 dark:text-stone-600" />
              </div>
              <button @click="selectedMeal = null"
                class="top-3 right-3 absolute bg-black/40 hover:bg-black/60 p-1.5 rounded-full text-white transition-colors">
                <X class="w-4 h-4" />
              </button>
            </div>
            <div class="space-y-3 p-5">
              <h3 class="font-bold text-stone-800 dark:text-stone-100 text-lg">{{ selectedMeal.recipe_title }}</h3>
              <div class="flex flex-wrap items-center gap-3 text-stone-500 text-sm">
                <span class="flex items-center gap-1"
                  :class="{ 'cursor-pointer hover:text-stone-700 dark:hover:text-stone-200': !isLocked }"
                  @click.stop="!isLocked && openServingsPopup(selectedMeal, $event)">
                  <Users class="w-4 h-4" /> {{ selectedMeal.servings }} Personen
                </span>
                <span v-if="selectedMeal.total_time" class="flex items-center gap-1">
                  <Clock class="w-4 h-4" /> {{ selectedMeal.total_time }} min
                </span>
                <span v-if="selectedMeal.difficulty" class="flex items-center gap-1">
                  <ChefHat class="w-4 h-4" /> {{ selectedMeal.difficulty }}
                </span>
              </div>
              <div class="gap-2 grid grid-cols-2 pt-2">
                <button @click="toggleCooked(selectedMeal); selectedMeal = null;"
                  class="action-pill" :class="selectedMeal.is_cooked ? 'action-pill--active' : ''">
                  <Check class="w-4 h-4" /> {{ selectedMeal.is_cooked ? 'Rückgängig' : 'Gekocht' }}
                </button>
                <template v-if="!isLocked">
                  <button @click="openSwapModal(selectedMeal); selectedMeal = null;" class="action-pill">
                    <RefreshCw class="w-4 h-4" /> Tauschen
                  </button>
                  <router-link :to="`/recipes/${selectedMeal.recipe_id}`" class="action-pill" @click="selectedMeal = null">
                    <Eye class="w-4 h-4" /> Rezept
                  </router-link>
                  <button @click="removeEntry(selectedMeal); selectedMeal = null;" class="action-pill action-pill--danger">
                    <X class="w-4 h-4" /> Entfernen
                  </button>
                  <button @click="openBlockDialog(selectedMeal)" class="action-pill action-pill--danger">
                    <Ban class="w-4 h-4" /> Sperren
                  </button>
                </template>
                <router-link v-else :to="`/recipes/${selectedMeal.recipe_id}`" class="action-pill" @click="selectedMeal = null">
                  <Eye class="w-4 h-4" /> Rezept
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══════════════════ SPERR-DIALOG ═══════════════════ -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="blockDialog.show" class="z-50 fixed inset-0 flex justify-center items-center bg-black/40 p-4" @click.self="blockDialog.show = false">
          <div class="bg-white dark:bg-stone-900 shadow-2xl p-6 border border-stone-200 dark:border-stone-700 rounded-2xl w-full max-w-sm">
            <h2 class="flex items-center gap-2 mb-1 font-bold text-stone-800 dark:text-stone-100 text-lg">
              <Ban class="w-5 h-5 text-red-500" /> Rezept sperren
            </h2>
            <p class="mb-5 text-stone-500 dark:text-stone-400 text-sm">
              „{{ blockDialog.recipeTitle }}" wird für die Wochenplan-Generierung ausgeschlossen.
            </p>

            <!-- Wochen-Auswahl -->
            <div class="mb-4">
              <label class="block mb-2 font-medium text-stone-700 dark:text-stone-300 text-sm">Wie lange sperren?</label>
              <div class="flex flex-wrap gap-2">
                <button v-for="w in [1, 2, 4, 8, 12, 26]" :key="w" @click="blockWeeks = w"
                  :class="['px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                    blockWeeks === w
                      ? 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                      : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800']">
                  {{ w }} {{ w === 1 ? 'Woche' : 'Wochen' }}
                </button>
              </div>
            </div>

            <!-- Optionaler Grund -->
            <div class="mb-5">
              <label class="block mb-1.5 font-medium text-stone-700 dark:text-stone-300 text-sm">Grund (optional)</label>
              <input v-model="blockReason" type="text" maxlength="200"
                placeholder="z.B. Kürbis hat keine Saison"
                class="dark:bg-stone-800 px-3 py-2 border border-stone-300 dark:border-stone-700 rounded-lg outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-800 w-full dark:text-stone-200 placeholder:text-stone-400 text-sm" />
            </div>

            <div class="flex justify-end gap-2">
              <button @click="blockDialog.show = false"
                class="hover:bg-stone-100 dark:hover:bg-stone-800 px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 text-sm transition-colors">
                Abbrechen
              </button>
              <button @click="doBlockRecipe"
                class="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl font-medium text-white text-sm transition-colors">
                <Ban class="w-4 h-4" /> Sperren
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Plan-Laden-Dialog -->
    <LoadPlanDialog
      :show="showLoadDialog"
      :current-week-start="currentWeekStart"
      @close="showLoadDialog = false"
      @navigate-to-week="navigateToWeek"
      @plan-copied="onPlanCopied"
    />

    <!-- Portionen-Popup -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="servingsPopup" class="z-110 fixed inset-0" @click="closeServingsPopup">
          <div class="servings-popup" :style="{ left: servingsPopup.x + 'px', top: servingsPopup.y + 'px' }"
            @click.stop>
            <button class="servings-popup-btn" :disabled="servingsPopup.meal.servings <= 1"
              @click="changeServings(-1)">
              <Minus class="w-4 h-4" />
            </button>
            <div class="servings-popup-value">
              <Users class="w-4 h-4" />
              <span class="font-semibold tabular-nums text-base">{{ servingsPopup.meal.servings }}</span>
            </div>
            <button class="servings-popup-btn" @click="changeServings(1)">
              <Plus class="w-4 h-4" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Bestätigungs-Dialog: Fixierten Plan überschreiben -->
    <ConfirmDialog
      v-model="showOverwriteLockedConfirm"
      variant="warning"
      title="Fixierten Plan überschreiben?"
      message="Der aktuelle Plan ist fixiert (bereits eingekauft). Trotzdem überschreiben?"
      confirm-text="Überschreiben"
      cancel-text="Abbrechen"
      @confirm="executeGenerate"
    />

    <!-- Bestätigungs-Dialog: Wochenplan löschen -->
    <ConfirmDialog
      v-model="showDeletePlanConfirm"
      variant="danger"
      title="Wochenplan löschen?"
      message="Wochenplan wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
      confirm-text="Löschen"
      cancel-text="Abbrechen"
      @confirm="executeDeletePlan"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMealPlanStore } from '@/stores/mealplan.js';
import { useRecipesStore } from '@/stores/recipes.js';
import { useCollectionsStore } from '@/stores/collections.js';
import { useRecipeBlocksStore } from '@/stores/recipe-blocks.js';
import { useNotification } from '@/composables/useNotification.js';
import LoadPlanDialog from '@/components/mealplan/LoadPlanDialog.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import {
  Sparkles, ChevronLeft, ChevronRight, Check, Eye, RefreshCw,
  X, Clock, ChefHat, UtensilsCrossed, Plus, Minus, Star, Trash2,
  LayoutGrid, CalendarDays, Settings, Settings2, FolderOpen, Info,
  Ban, ShieldOff, Lock, Unlock, Users, ChevronDown, FolderSearch, EllipsisVertical,
} from 'lucide-vue-next';

const router = useRouter();
const store = useMealPlanStore();
const recipesStore = useRecipesStore();
const collectionsStore = useCollectionsStore();

// Schwierigkeitsgrad-Farben (identisch mit RecipeCard)
const difficultyClasses = {
  leicht: 'bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300',
  mittel: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
  schwer: 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300',
};
const blocksStore = useRecipeBlocksStore();
const { showSuccess } = useNotification();

// ─── State ───
const weekOffset = ref(0);
const viewMode = ref('week');
const selectedDayIdx = ref(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1); // heute
const selectedMeal = ref(null);
const showGenerateModal = ref(false);
const showGenSettings = ref(false);
const showLoadDialog = ref(false);
const showOverwriteLockedConfirm = ref(false);
const showDeletePlanConfirm = ref(false);
const servingsPopup = ref(null); // { meal, x, y }

// Gespeicherte Präferenzen aus localStorage laden
const STORAGE_KEY = 'mealplan-gen-prefs';
const savedPrefs = (() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
})();
const genMealTypes = ref(savedPrefs.mealTypes ?? ['fruehstueck', 'mittag', 'abendessen']);
const genPersons = ref(savedPrefs.personCount ?? 4);
const visibleSlots = ref(savedPrefs.visibleSlots ?? ['fruehstueck', 'mittag', 'abendessen', 'snack']);
const genSourceMode = ref(savedPrefs.sourceMode ?? 'all');
const genCollectionIds = ref(savedPrefs.collectionIds ?? []);
const genDeduplicate = ref(savedPrefs.deduplicate ?? true);
const genAiReasoning = ref(savedPrefs.aiReasoning ?? false);
const genActiveDays = ref(savedPrefs.activeDays ?? [0, 1, 2, 3, 4, 5, 6]);
const showSlotSettings = ref(false);
const showPastDays = ref(false);
const reasoningCollapsed = ref(true);



// Bei Änderung automatisch in localStorage speichern
watch([genMealTypes, genPersons, visibleSlots, genSourceMode, genCollectionIds, genDeduplicate, genAiReasoning, genActiveDays], () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    mealTypes: genMealTypes.value,
    personCount: genPersons.value,
    visibleSlots: visibleSlots.value,
    sourceMode: genSourceMode.value,
    collectionIds: genCollectionIds.value,
    deduplicate: genDeduplicate.value,
    aiReasoning: genAiReasoning.value,
    activeDays: genActiveDays.value,
  }));
}, { deep: true });

const swapModal = ref({ show: false, entry: null, suggestions: [], loading: false });
const dragSource = ref(null);
const dragTarget = ref(null);

// Sperr-Dialog
const blockDialog = ref({ show: false, recipeId: null, recipeTitle: '' });
const blockWeeks = ref(4);
const blockReason = ref('');

// ─── Meal-Types ───
const allMealTypes = [
  { key: 'fruehstueck', label: 'Frühstück', icon: '🌅' },
  { key: 'mittag', label: 'Mittag', icon: '☀️' },
  { key: 'abendessen', label: 'Abend', icon: '🌙' },
  { key: 'snack', label: 'Snack', icon: '🍎' },
];
const mealTypes = computed(() => allMealTypes.filter(mt => visibleSlots.value.includes(mt.key)));

/** Bei 1-2 sichtbaren Slots → große Karten, bei 3+ → kompaktes 7-Spalten-Grid */
const isCompactGrid = computed(() => mealTypes.value.length >= 3);

// ─── Computed ───
const currentPlan = computed(() => store.currentPlan);

/** Montag der aktuellen Anzeige-Woche als YYYY-MM-DD */
const currentWeekStart = computed(() => {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay();
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1) + weekOffset.value * 7);
  return monday.toISOString().split('T')[0];
});

const weekDays = computed(() => {
  const [y, m, d] = currentWeekStart.value.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  return ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((short, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return {
      short,
      date: dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      fullDate: dt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
      dateObj: dt,
    };
  });
});

const weekLabel = computed(() => {
  if (!weekDays.value.length) return '';
  return `${weekDays.value[0].date} – ${weekDays.value[6].date}`;
});

// ─── Wochen-Navigation: Plan laden bei Wechsel ───
watch(currentWeekStart, async (ws) => {
  showPastDays.value = false;
  await store.fetchCurrentPlan(ws);
}, { immediate: false });

function changeWeek(offset) {
  weekOffset.value += offset;
}
function goToToday() {
  weekOffset.value = 0;
  selectedDayIdx.value = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
}

/** Zu einer bestimmten Woche navigieren (von LoadPlanDialog) */
function navigateToWeek(weekStart) {
  // weekOffset berechnen: Differenz zur aktuellen "echten" Woche
  const today = new Date();
  const day = today.getDay();
  const todayMonday = new Date(today);
  todayMonday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
  todayMonday.setHours(0, 0, 0, 0);

  const [y, m, d] = weekStart.split('-').map(Number);
  const targetMonday = new Date(y, m - 1, d);
  targetMonday.setHours(0, 0, 0, 0);

  const diffWeeks = Math.round((targetMonday - todayMonday) / (7 * 86400000));
  weekOffset.value = diffWeeks;
}

/** Nach Plan-Kopie: Daten neu laden */
async function onPlanCopied() {
  await store.fetchCurrentPlan(currentWeekStart.value);
  store.fetchHistory();
}

// ─── Helpers ───
function isToday(dayIdx) {
  return weekDays.value[dayIdx]?.dateObj.toDateString() === new Date().toDateString();
}

function isDayPast(dayIdx) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayDate = weekDays.value[dayIdx]?.dateObj;
  if (!dayDate) return false;
  const d = new Date(dayDate);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

const pastDaysCount = computed(() => weekDays.value.filter((_, idx) => isDayPast(idx)).length);

function getMeal(dayIdx, mealType) {
  if (!currentPlan.value?.entries) return null;
  return currentPlan.value.entries.find(e => e.day_of_week === dayIdx && e.meal_type === mealType);
}

/** Prüft ob ein Tag mindestens ein Rezept in irgendeinem Slot hat */
function dayHasMeals(dayIdx) {
  if (!currentPlan.value?.entries) return false;
  return currentPlan.value.entries.some(e => e.day_of_week === dayIdx);
}

/** Ist der aktuelle Plan fixiert? */
const isLocked = computed(() => !!currentPlan.value?.is_locked);

function dayHeaderClass(dayIdx) {
  const base = 'w-full text-center py-2 rounded-lg transition-colors cursor-pointer';
  const hasMeals = dayHasMeals(dayIdx);
  if (isToday(dayIdx)) return `${base} bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/60${!hasMeals ? ' opacity-50' : ''}`;
  if (!hasMeals) return `${base} bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600 opacity-50`;
  return `${base} bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700`;
}

function viewToggleClass(mode) {
  const base = 'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors';
  if (viewMode.value === mode) return `${base} bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm rounded-lg`;
  return `${base} text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300`;
}

function openDayView(dayIdx) {
  selectedDayIdx.value = dayIdx;
  viewMode.value = 'day';
}

function selectMeal(meal) {
  selectedMeal.value = meal;
}

/** Favoriten-Status eines Rezepts im Wochenplan umschalten */
async function toggleMealFavorite(meal) {
  await recipesStore.toggleFavorite(meal.recipe_id);
  // Status im lokalen Meal-Entry aktualisieren
  meal.is_favorite = !meal.is_favorite;
}

// ─── Generierung ───
async function doGenerate() {
  // Warnung wenn fixierter Plan überschrieben wird
  if (isLocked.value) {
    showGenerateModal.value = false;
    showOverwriteLockedConfirm.value = true;
    return;
  }
  executeGenerate();
}

async function executeGenerate() {
  showOverwriteLockedConfirm.value = false;
  showGenerateModal.value = false;
  try {
    const options = {
      weekStart: currentWeekStart.value,
      mealTypes: genMealTypes.value,
      personCount: genPersons.value,
      enableAiReasoning: genAiReasoning.value,
      activeDays: genActiveDays.value,
    };
    // Sammlungs-Filter nur wenn explizit Sammlungen gewählt
    if (genSourceMode.value === 'collections' && genCollectionIds.value.length > 0) {
      options.collectionIds = genCollectionIds.value;
      options.deduplicateCollections = genDeduplicate.value;
    }
    const data = await store.generatePlan(options);
    showSuccess('Wochenplan erstellt! 🗓️');

    // KI-Reasoning im Hintergrund polled (blockiert UI nicht)
    if (genAiReasoning.value && data.planId) {
      store.pollReasoning(data.planId);
    }
  } catch {
    // Fehler von useApi
  }
}

// ─── Gekocht-Toggle ───
async function toggleCooked(meal) {
  try {
    const data = await store.markCooked(meal.meal_plan_id, meal.id);
    if (data.is_cooked) {
      const pantryMsg = data.pantryUpdated ? ` (${data.pantryUpdated} Vorräte angepasst)` : '';
      const swapMsg = data.swapped ? ' und auf heute verschoben' : '';
      showSuccess(`Als gekocht markiert${swapMsg} ✅${pantryMsg}`);
    } else {
      const pantryMsg = data.pantryUpdated ? ` (${data.pantryUpdated} Vorräte wiederhergestellt)` : '';
      showSuccess(`Markierung entfernt${pantryMsg}`);
    }
  } catch { /* useApi */ }
}

// ─── Tausch ───
async function openSwapModal(entry) {
  swapModal.value = { show: true, entry, suggestions: [], loading: true };
  try {
    // Nur das aktuelle Rezept ausschließen (nicht alle im Plan), damit es Vorschläge gibt
    const excludeIds = entry.recipe_id ? [entry.recipe_id] : [];
    const suggestions = await store.fetchSuggestions({
      dayIdx: entry.day_of_week,
      mealType: entry.meal_type,
      excludeRecipeIds: excludeIds,
      planId: currentPlan.value?.id,
    });
    swapModal.value.suggestions = suggestions || [];
  } finally {
    swapModal.value.loading = false;
  }
}

function closeSwapModal() {
  swapModal.value = { show: false, entry: null, suggestions: [], loading: false };
}

async function doSwap(newRecipeId) {
  const entry = swapModal.value.entry;
  closeSwapModal();
  try {
    if (entry._isNew) {
      // Neuen Eintrag in leerem Slot erstellen
      await store.addEntry(currentPlan.value.id, newRecipeId, entry.day_of_week, entry.meal_type);
      showSuccess('Rezept hinzugefügt! ✨');
    } else {
      // Bestehendes Rezept tauschen
      await store.swapRecipe(currentPlan.value.id, entry.id, newRecipeId);
      showSuccess('Rezept getauscht! 🔄');
    }
  } catch { /* useApi */ }
}

// ─── Portionen ändern ───
function openServingsPopup(meal, event) {
  if (isLocked.value) return;
  event.stopPropagation();
  const rect = event.currentTarget.getBoundingClientRect();
  const popupWidth = 148; // 2rem+3rem+2rem + gaps + padding
  const margin = 8;
  let x = rect.left + rect.width / 2;
  // Viewport-Clamping: Popup nie links/rechts abschneiden
  x = Math.max(popupWidth / 2 + margin, Math.min(x, window.innerWidth - popupWidth / 2 - margin));
  servingsPopup.value = {
    meal,
    x,
    y: rect.bottom + 6,
  };
}
function closeServingsPopup() {
  servingsPopup.value = null;
}
async function changeServings(delta) {
  if (!servingsPopup.value) return;
  const meal = servingsPopup.value.meal;
  const newServings = Math.max(1, (meal.servings || 4) + delta);
  if (newServings === meal.servings) return;
  try {
    await store.updateServings(meal.meal_plan_id, meal.id, newServings);
    // Lokalen Popup-State aktualisieren
    servingsPopup.value.meal = { ...meal, servings: newServings };
    // Falls das Detail-Popup offen ist, dort auch aktualisieren
    if (selectedMeal.value?.id === meal.id) {
      selectedMeal.value = { ...selectedMeal.value, servings: newServings };
    }
  } catch { /* useApi */ }
}

// ─── Entfernen ───
async function removeEntry(meal) {
  try {
    await store.removeEntry(meal.meal_plan_id, meal.id);
    showSuccess('Eintrag entfernt');
  } catch { /* useApi */ }
}

// ─── Plan löschen ───
async function confirmDeletePlan() {
  if (!currentPlan.value) return;
  if (isLocked.value) return;
  showDeletePlanConfirm.value = true;
}

async function executeDeletePlan() {
  showDeletePlanConfirm.value = false;
  if (!currentPlan.value) return;
  try {
    await store.deletePlan(currentPlan.value.id);
    showSuccess('Wochenplan gelöscht');
  } catch { /* useApi */ }
}

// ─── Fixieren ───
async function toggleLockPlan() {
  if (!currentPlan.value) return;
  try {
    const data = await store.toggleLock(currentPlan.value.id);
    showSuccess(data.message);
  } catch { /* useApi */ }
}

// ─── Drag & Drop ───
function onDragStart(event, meal) {
  dragSource.value = meal;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', meal.id.toString());
}
function onDragEnd() {
  dragSource.value = null;
  dragTarget.value = null;
}
function onDragOver(dayIdx, mealKey) {
  dragTarget.value = { day: dayIdx, meal: mealKey };
}
function onDragLeave() {
  dragTarget.value = null;
}
async function onDrop(dayIdx, mealKey) {
  const source = dragSource.value;
  dragTarget.value = null;
  dragSource.value = null;
  if (!source || !currentPlan.value) return;
  // Nur verschieben wenn sich der Slot tatsächlich ändert
  if (source.day_of_week === dayIdx && source.meal_type === mealKey) return;
  try {
    await store.moveEntry(currentPlan.value.id, source.id, dayIdx, mealKey);
    showSuccess('Mahlzeit verschoben! ↕️');
  } catch { /* useApi */ }
}

// ─── Sperren ───
function openBlockDialog(meal) {
  blockDialog.value = { show: true, recipeId: meal.recipe_id, recipeTitle: meal.recipe_title };
  blockWeeks.value = 4;
  blockReason.value = '';
  selectedMeal.value = null;
}

async function doBlockRecipe() {
  const { recipeId } = blockDialog.value;
  try {
    const data = await blocksStore.blockRecipe(recipeId, blockWeeks.value, blockReason.value);
    showSuccess(data.message);
    blockDialog.value.show = false;
  } catch { /* useApi */ }
}

async function doUnblockRecipe(blockId) {
  try {
    await blocksStore.unblockById(blockId);
    showSuccess('Sperre aufgehoben');
  } catch { /* useApi */ }
}

// ─── Init ───
onMounted(async () => {
  await store.fetchCurrentPlan(currentWeekStart.value);
  store.fetchHistory();
  collectionsStore.fetchCollections();
  blocksStore.fetchBlocks();
});
</script>

<style scoped>
/* ─── Meal Slot ─── */
.meal-slot {
  display: flex;
  flex-direction: column;
  padding: calc(var(--spacing) * 1.5);
  border-radius: var(--radius-lg);
  background-color: var(--color-stone-50);
  transition: background-color 0.15s ease;
}
:is(.dark .meal-slot) {
  background-color: var(--color-stone-950);
}
.meal-slot-dragover {
  background-color: var(--color-primary-50);
  outline: 2px dashed var(--color-primary-400);
  outline-offset: -2px;
}
:is(.dark .meal-slot-dragover) {
  background-color: color-mix(in srgb, var(--color-primary-900) 30%, transparent);
}

/* Tage ohne Rezepte  */
.meal-slot--inactive {
  opacity: 0.4;
}

/* ─── Mobile Meal Card ─── */
.mobile-meal-card {
  background: white;
  border: 1px solid var(--color-stone-200);
  border-radius: var(--radius-xl);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.mobile-meal-card:active {
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary-400) 25%, transparent);
}
:is(.dark .mobile-meal-card) {
  background: var(--color-stone-900);
  border-color: var(--color-stone-800);
}
:is(.dark .mobile-meal-card:active) {
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary-600) 25%, transparent);
}

/* ─── Servings Popup ─── */
.servings-popup {
  position: fixed;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: white;
  border: 1px solid var(--color-stone-200);
  border-radius: var(--radius-xl);
  padding: 0.25rem;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  z-index: 111;
}
:is(.dark .servings-popup) {
  background: var(--color-stone-800);
  border-color: var(--color-stone-700);
}
.servings-popup-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background-color 0.15s ease;
  color: var(--color-stone-600);
}
:is(.dark .servings-popup-btn) { color: var(--color-stone-300); }
.servings-popup-btn:hover { background-color: var(--color-stone-100); }
:is(.dark .servings-popup-btn:hover) { background-color: var(--color-stone-700); }
.servings-popup-btn:disabled { opacity: 0.3; cursor: default; }
.servings-popup-btn:disabled:hover { background-color: transparent; }
.servings-popup-value {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.5rem;
  color: var(--color-stone-800);
  min-width: 3rem;
  justify-content: center;
}
:is(.dark .servings-popup-value) { color: var(--color-stone-100); }

/* ─── Meal Card (Wochenansicht kompakt) ─── */
.meal-card {
  cursor: grab;
  border-radius: var(--radius-lg);
  transition: transform 0.1s ease, box-shadow 0.15s ease;
}
.meal-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.meal-card:active { cursor: grabbing; }
.meal-card--cooked { opacity: 0.55; }

/* ─── Meal Card (große Kartenansicht) ─── */
.meal-card-large {
  cursor: grab;
  background-color: white;
  border: 1px solid var(--color-stone-200);
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.15s ease;
}
.meal-card-large:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: var(--color-primary-300);
}
.meal-card-large:active { cursor: grabbing; }
.meal-card-large--cooked { opacity: 0.55; }
:is(.dark .meal-card-large) {
  background-color: var(--color-stone-900);
  border-color: var(--color-stone-800);
}
:is(.dark .meal-card-large:hover) {
  border-color: var(--color-primary-700);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

/* ─── Leerer Slot (große Karten) ─── */
.meal-card-large-empty {
  display: flex;
  width: 100%;
  min-height: 280px;
  justify-content: center;
  align-items: center;
  border: 2px dashed var(--color-stone-200);
  border-radius: var(--radius-xl);
  transition: border-color 0.15s ease, background-color 0.15s ease;
  flex: 1;
}
:is(.dark .meal-card-large-empty) { border-color: var(--color-stone-800); }
.meal-card-large-empty:hover {
  border-color: var(--color-primary-300);
  background-color: var(--color-primary-50);
}
:is(.dark .meal-card-large-empty:hover) {
  border-color: var(--color-primary-700);
  background-color: color-mix(in srgb, var(--color-primary-900) 20%, transparent);
}

/* ─── Leerer Slot (kompakt) ─── */
.meal-card-empty {
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  min-height: calc(var(--spacing) * 14);
  border: 2px dashed var(--color-stone-200);
  border-radius: var(--radius-lg);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
:is(.dark .meal-card-empty) { border-color: var(--color-stone-800); }
.meal-card-empty:hover {
  border-color: var(--color-primary-300);
  background-color: var(--color-primary-50);
}
:is(.dark .meal-card-empty:hover) {
  border-color: var(--color-primary-700);
  background-color: color-mix(in srgb, var(--color-primary-900) 20%, transparent);
}

/* ─── Tages-Ansicht Karten ─── */
.day-meal-card {
  background-color: white;
  padding: calc(var(--spacing) * 4);
  border: 1px solid var(--color-stone-200);
  border-radius: var(--radius-xl);
  transition: border-color 0.15s ease;
}
.day-meal-card:hover { border-color: var(--color-primary-300); }
:is(.dark .day-meal-card) { background-color: var(--color-stone-900); border-color: var(--color-stone-800); }
:is(.dark .day-meal-card:hover) { border-color: var(--color-primary-700); }
.day-meal-card--cooked { opacity: 0.6; }

.day-meal-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: calc(var(--spacing) * 6) 0;
  border: 2px dashed var(--color-stone-200);
  border-radius: var(--radius-xl);
}
:is(.dark .day-meal-empty) { border-color: var(--color-stone-800); }

/* ─── Tages-Aktions-Buttons ─── */
.day-action-btn {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2.5);
  border-radius: var(--radius-lg);
  font-size: 0.75rem;
  font-weight: 500;
  background-color: var(--color-stone-100);
  color: var(--color-stone-600);
  transition: background-color 0.15s ease, color 0.15s ease;
  text-decoration: none;
}
.day-action-btn:hover { background-color: var(--color-stone-200); color: var(--color-stone-800); }
:is(.dark .day-action-btn) { background-color: var(--color-stone-800); color: var(--color-stone-400); }
:is(.dark .day-action-btn:hover) { background-color: var(--color-stone-700); color: var(--color-stone-200); }
.day-action-btn--active { background-color: var(--color-accent-100); color: var(--color-accent-700); }
:is(.dark .day-action-btn--active) { background-color: color-mix(in srgb, var(--color-accent-900) 40%, transparent); color: var(--color-accent-400); }
.day-action-btn--danger:hover { background-color: var(--color-red-100); color: var(--color-red-600); }
:is(.dark .day-action-btn--danger:hover) { background-color: color-mix(in srgb, var(--color-red-900) 40%, transparent); color: var(--color-red-400); }

/* ─── Action Pills (Popup) ─── */
.action-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);
  border-radius: var(--radius-xl);
  font-size: 0.8rem;
  font-weight: 500;
  background-color: var(--color-stone-100);
  color: var(--color-stone-600);
  transition: background-color 0.15s ease, color 0.15s ease;
  text-decoration: none;
}
.action-pill:hover { background-color: var(--color-stone-200); color: var(--color-stone-800); }
:is(.dark .action-pill) { background-color: var(--color-stone-800); color: var(--color-stone-400); }
:is(.dark .action-pill:hover) { background-color: var(--color-stone-700); color: var(--color-stone-200); }
.action-pill--active { background-color: var(--color-accent-100); color: var(--color-accent-700); }
:is(.dark .action-pill--active) { background-color: color-mix(in srgb, var(--color-accent-900) 40%, transparent); color: var(--color-accent-400); }
.action-pill--danger:hover { background-color: var(--color-red-100); color: var(--color-red-600); }
:is(.dark .action-pill--danger:hover) { background-color: color-mix(in srgb, var(--color-red-900) 40%, transparent); color: var(--color-red-400); }

/* ─── Swap Vorschlag ─── */
.swap-suggestion {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  padding: calc(var(--spacing) * 2.5);
  border: 1px solid var(--color-stone-200);
  border-radius: var(--radius-lg);
  width: 100%;
  text-align: left;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.swap-suggestion:hover {
  border-color: var(--color-primary-400);
  background-color: var(--color-primary-50);
}
:is(.dark .swap-suggestion) { border-color: var(--color-stone-800); }
:is(.dark .swap-suggestion:hover) {
  border-color: var(--color-primary-700);
  background-color: color-mix(in srgb, var(--color-primary-900) 20%, transparent);
}

/* ─── Modal Transition ─── */
.modal-enter-active { transition: opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
