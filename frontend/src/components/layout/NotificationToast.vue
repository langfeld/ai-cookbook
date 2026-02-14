<!--
  ============================================
  NotificationToast - Benachrichtigungen
  ============================================
  Zeigt Toast-Benachrichtigungen als Overlay an.
-->
<template>
  <div class="right-4 bottom-4 z-50 fixed flex flex-col gap-2">
    <TransitionGroup name="list">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="[
          'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border max-w-sm animate-slide-in-right',
          typeClasses[notification.type],
        ]"
      >
        <!-- Icon je nach Typ -->
        <component :is="typeIcons[notification.type]" class="w-5 h-5 shrink-0" />
        <p class="flex-1 text-sm">{{ notification.message }}</p>
        <button @click="removeNotification(notification.id)" class="opacity-60 hover:opacity-100">
          <X class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-vue-next';
import { useNotification } from '@/composables/useNotification.js';

const { notifications, removeNotification } = useNotification();

// Farben je nach Benachrichtigungstyp
const typeClasses = {
  success: 'bg-green-50 dark:bg-green-950/80 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  error: 'bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  info: 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  warning: 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
};

const typeIcons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};
</script>
