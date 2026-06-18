import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './ui/App.vue'
import './ui/theme/main.css'

createApp(App).use(createPinia()).mount('#app')
