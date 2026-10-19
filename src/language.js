import { createContext, createElement, useContext, useEffect, useState } from 'react'

const storageKey = 'gabaygo-language'
const supportedLanguages = ['english', 'filipino', 'bisaya']
const LanguageContext = createContext(null)

export function isSupportedLanguage(language) {
  return supportedLanguages.includes(language)
}

export function getDateLocale(language) {
  if (language === 'filipino') return 'fil-PH'
  if (language === 'bisaya') return 'ceb-PH'
  return 'en-PH'
}

function readSavedLanguage() {
  try {
    const savedLanguage = window.localStorage.getItem(storageKey)
    return isSupportedLanguage(savedLanguage) ? savedLanguage : 'english'
  } catch (error) {
    console.error('Could not read the saved GabayGo language from browser storage.', error)
    return 'english'
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(readSavedLanguage)

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, language)
    } catch (error) {
      console.error('Could not save the GabayGo language in browser storage.', error)
    }
    document.documentElement.lang = language === 'bisaya' ? 'ceb' : language === 'filipino' ? 'fil' : 'en'
  }, [language])

  return createElement(LanguageContext.Provider, { value: { language, setLanguage } }, children)
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider.')
  return context
}
