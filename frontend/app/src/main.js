import { createApp } from 'vue'
import { devtools } from '@vue/devtools'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './assets/main.css'

console.log("process.env.NODE_ENV", process.env.NODE_ENV)
if (process.env.NODE_ENV === 'development') {
  console.log("璋冭瘯妯″紡")
}

const app = createApp(App)
app.use(router)
app.use(i18n)
app.mount('#app')