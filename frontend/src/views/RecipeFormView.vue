<!--
  ============================================
  RecipeFormView - Rezept erstellen/bearbeiten
  ============================================
  Formular für neue Rezepte oder zum Bearbeiten
  bestehender Rezepte mit:
  - Grunddaten (Titel, Beschreibung, Bild)
  - Zutaten mit Gruppen
  - Kochschritte
  - Kategorie-Auswahl
-->
<template>
  <div class="space-y-6 mx-auto max-w-3xl animate-fade-in">
    <h1 class="font-display font-bold text-stone-800 dark:text-stone-100 text-2xl">
      {{ isEdit ? 'Rezept bearbeiten' : 'Neues Rezept' }}
    </h1>

    <form @submit.prevent="saveRecipe" class="space-y-6">
      <!-- Grunddaten -->
      <section class="space-y-4 card">
        <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">📝 Grunddaten</h2>

        <div>
          <label class="form-label">Titel *</label>
          <input v-model="form.title" type="text" class="form-input" placeholder="z.B. Spaghetti Carbonara" required />
        </div>

        <div>
          <label class="form-label">Beschreibung</label>
          <textarea v-model="form.description" class="form-input" rows="3" placeholder="Kurze Beschreibung des Rezepts..." />
        </div>

        <div class="gap-4 grid grid-cols-3">
          <div>
            <label class="form-label">Zubereitungszeit (Min.)</label>
            <input v-model.number="form.prep_time" type="number" min="0" class="form-input" />
          </div>
          <div>
            <label class="form-label">Kochzeit (Min.)</label>
            <input v-model.number="form.cook_time" type="number" min="0" class="form-input" />
          </div>
          <div>
            <label class="form-label">Portionen</label>
            <input v-model.number="form.servings" type="number" min="1" class="form-input" />
          </div>
        </div>

        <div>
          <label class="form-label">Schwierigkeitsgrad</label>
          <select v-model="form.difficulty" class="form-input">
            <option value="leicht">🟢 Leicht</option>
            <option value="mittel">🟡 Mittel</option>
            <option value="schwer">🔴 Schwer</option>
          </select>
        </div>

        <!-- Bild-Upload -->
        <div>
          <label class="form-label">Bild</label>
          <div
            class="relative p-6 border-2 border-stone-300 hover:border-primary-400 dark:border-stone-600 dark:hover:border-primary-500 border-dashed rounded-xl text-center transition-colors cursor-pointer"
            @click="$refs.imageInput.click()"
          >
            <img v-if="imagePreview" :src="imagePreview" class="mb-3 rounded-lg w-full h-48 object-cover" />
            <div v-else class="text-stone-400">
              <ImageIcon class="mx-auto mb-2 w-8 h-8" />
              <p class="text-sm">Bild hochladen</p>
            </div>
            <input ref="imageInput" type="file" accept="image/*" @change="onImageChange" class="hidden" />
          </div>
        </div>
      </section>

      <!-- Kategorien -->
      <section class="space-y-4 card">
        <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">🏷️ Kategorien</h2>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="cat in recipesStore.categories"
            :key="cat.id"
            type="button"
            @click="toggleCategory(cat.id)"
            :class="[
              'px-3 py-1.5 rounded-full text-sm border transition-all',
              form.category_ids.includes(cat.id)
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-400'
            ]"
          >
            {{ cat.icon }} {{ cat.name }}
          </button>
        </div>
      </section>

      <!-- Zutaten -->
      <section class="space-y-4 card">
        <div class="flex justify-between items-center">
          <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">🥕 Zutaten</h2>
          <button type="button" @click="addIngredientGroup" class="text-primary-600 hover:text-primary-700 text-sm">
            + Gruppe hinzufügen
          </button>
        </div>

        <div v-for="(group, gIdx) in form.ingredient_groups" :key="gIdx" class="space-y-3">
          <!-- Gruppenname -->
          <div v-if="gIdx > 0 || group.name" class="flex items-center gap-2">
            <input
              v-model="group.name"
              type="text"
              class="flex-1 text-sm form-input"
              placeholder="Gruppenname (z.B. 'Für die Soße')"
            />
            <button type="button" @click="form.ingredient_groups.splice(gIdx, 1)" class="text-red-400 hover:text-red-500">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>

          <!-- Zutaten in der Gruppe -->
          <div v-for="(ing, iIdx) in group.items" :key="iIdx" class="flex items-start gap-2">
            <input v-model.number="ing.amount" type="number" step="0.01" min="0" class="w-20 form-input" placeholder="Menge" />
            <input v-model="ing.unit" type="text" class="w-20 form-input" placeholder="Einheit" />
            <input v-model="ing.name" type="text" class="flex-1 form-input" placeholder="Zutat" required />
            <label class="flex items-center gap-1 mt-2 text-stone-400 text-xs cursor-pointer">
              <input type="checkbox" v-model="ing.is_optional" class="rounded" />
              opt.
            </label>
            <button type="button" @click="group.items.splice(iIdx, 1)" class="mt-2 text-red-400 hover:text-red-500">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            @click="group.items.push({ amount: null, unit: '', name: '', is_optional: false })"
            class="flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm"
          >
            <Plus class="w-3 h-3" /> Zutat hinzufügen
          </button>
        </div>
      </section>

      <!-- Kochschritte -->
      <section class="space-y-4 card">
        <h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg">👨‍🍳 Zubereitung</h2>

        <div v-for="(step, sIdx) in form.steps" :key="sIdx" class="flex items-start gap-3">
          <!-- Nummer -->
          <div class="flex justify-center items-center bg-primary-100 dark:bg-primary-900/50 mt-2 rounded-full w-8 h-8 shrink-0">
            <span class="font-bold text-primary-700 dark:text-primary-300 text-sm">{{ sIdx + 1 }}</span>
          </div>

          <div class="flex-1 space-y-2">
            <input v-model="step.title" type="text" class="text-sm form-input" placeholder="Schritt-Titel (optional)" />
            <textarea v-model="step.instruction" class="text-sm form-input" rows="3" placeholder="Anweisungen..." required />
            <input v-model.number="step.duration_minutes" type="number" min="0" class="w-32 text-sm form-input" placeholder="Dauer (Min.)" />
          </div>

          <button type="button" @click="form.steps.splice(sIdx, 1)" class="mt-2 text-red-400 hover:text-red-500">
            <Trash2 class="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          @click="form.steps.push({ title: '', instruction: '', duration_minutes: null })"
          class="flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm"
        >
          <Plus class="w-3 h-3" /> Schritt hinzufügen
        </button>
      </section>

      <!-- Absenden -->
      <div class="flex gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-6 py-3 rounded-xl font-medium text-white transition-colors"
        >
          <Save class="w-4 h-4" />
          {{ saving ? 'Wird gespeichert...' : 'Rezept speichern' }}
        </button>
        <router-link
          to="/recipes"
          class="flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-800 px-6 py-3 border border-stone-300 dark:border-stone-600 rounded-xl text-stone-700 dark:text-stone-300 transition-colors"
        >
          Abbrechen
        </router-link>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRecipesStore } from '@/stores/recipes.js';
import { useNotification } from '@/composables/useNotification.js';
import { useApi } from '@/composables/useApi.js';
import { Plus, Trash2, Save, Image as ImageIcon } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const recipesStore = useRecipesStore();
const { showSuccess, showError } = useNotification();
const api = useApi();

const saving = ref(false);
const imageFile = ref(null);
const imagePreview = ref(null);

const editId = computed(() => route.query.edit);
const isEdit = computed(() => !!editId.value);

const form = reactive({
  title: '',
  description: '',
  prep_time: 15,
  cook_time: 30,
  servings: 4,
  difficulty: 'mittel',
  category_ids: [],
  ingredient_groups: [
    { name: '', items: [{ amount: null, unit: '', name: '', is_optional: false }] }
  ],
  steps: [
    { title: '', instruction: '', duration_minutes: null }
  ],
});

function toggleCategory(id) {
  const idx = form.category_ids.indexOf(id);
  if (idx >= 0) form.category_ids.splice(idx, 1);
  else form.category_ids.push(id);
}

function addIngredientGroup() {
  form.ingredient_groups.push({
    name: '',
    items: [{ amount: null, unit: '', name: '', is_optional: false }],
  });
}

function onImageChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  imageFile.value = file;
  imagePreview.value = URL.createObjectURL(file);
}

async function saveRecipe() {
  saving.value = true;
  try {
    // Zutaten flach machen mit Gruppeninfo
    const ingredients = [];
    for (const group of form.ingredient_groups) {
      for (const ing of group.items) {
        if (!ing.name) continue;
        ingredients.push({
          ...ing,
          group_name: group.name || null,
        });
      }
    }

    const payload = {
      title: form.title,
      description: form.description,
      prep_time: form.prep_time,
      cook_time: form.cook_time,
      total_time: (form.prep_time || 0) + (form.cook_time || 0),
      servings: form.servings,
      difficulty: form.difficulty,
      category_ids: form.category_ids,
      ingredients,
      steps: form.steps.filter(s => s.instruction).map((s, i) => ({ ...s, step_number: i + 1 })),
    };

    let recipeId;
    if (isEdit.value) {
      await api.put(`/recipes/${editId.value}`, payload);
      recipeId = editId.value;
      showSuccess('Rezept aktualisiert! ✨');
    } else {
      const result = await api.post('/recipes', payload);
      recipeId = result.id;
      showSuccess('Rezept erstellt! 🎉');
    }

    // Bild hochladen (falls vorhanden)
    if (imageFile.value && recipeId) {
      const formData = new FormData();
      formData.append('image', imageFile.value);
      await api.upload(`/recipes/${recipeId}/image`, formData);
    }

    router.push(`/recipes/${recipeId}`);
  } catch (err) {
    showError('Fehler beim Speichern: ' + err.message);
  } finally {
    saving.value = false;
  }
}

// Beim Bearbeiten: bestehende Daten laden
onMounted(async () => {
  await recipesStore.fetchCategories();

  if (editId.value) {
    await recipesStore.fetchRecipe(editId.value);
    const r = recipesStore.currentRecipe;
    if (r) {
      Object.assign(form, {
        title: r.title,
        description: r.description || '',
        prep_time: r.prep_time,
        cook_time: r.cook_time,
        servings: r.servings,
        difficulty: r.difficulty,
        category_ids: r.categories?.map(c => c.id) || [],
      });

      // Zutaten nach Gruppen sortieren
      const groups = {};
      for (const ing of r.ingredients || []) {
        const gn = ing.group_name || '';
        if (!groups[gn]) groups[gn] = [];
        groups[gn].push({ amount: ing.amount, unit: ing.unit, name: ing.name, is_optional: ing.is_optional });
      }
      form.ingredient_groups = Object.entries(groups).map(([name, items]) => ({ name, items }));
      if (!form.ingredient_groups.length) {
        form.ingredient_groups = [{ name: '', items: [{ amount: null, unit: '', name: '', is_optional: false }] }];
      }

      // Kochschritte
      form.steps = (r.steps || []).map(s => ({
        title: s.title || '',
        instruction: s.instruction,
        duration_minutes: s.duration_minutes,
      }));
      if (!form.steps.length) {
        form.steps = [{ title: '', instruction: '', duration_minutes: null }];
      }

      if (r.image_url) imagePreview.value = r.image_url;
    }
  }
});
</script>

<style scoped>
@reference "../assets/styles/main.css";
.card {
  @apply bg-white dark:bg-stone-900 p-6 border border-stone-200 dark:border-stone-800 rounded-xl;
}
.form-label {
  @apply block mb-1 font-medium text-stone-700 dark:text-stone-300 text-sm;
}
.form-input {
  @apply w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400;
}
</style>
