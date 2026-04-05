import { createI18n } from 'vue-i18n'
import en from '../locales/en.json'
import zh from '../locales/zh.json'
import ja from '../locales/ja.json'
import ru from '../locales/ru.json'
import es from '../locales/es.json'
import hi from '../locales/hi.json'
import ar from '../locales/ar.json'

const savedLocale = localStorage.getItem('locale') || 'zh'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    zh,
    ja,
    ru,
    es,
    hi,
    ar
  }
})

export default i18n