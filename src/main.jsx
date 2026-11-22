import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { appliquerAmbiance, lireAmbianceMemorisee } from './ambianceDom.js'

// Avant le premier rendu : la dernière ambiance connue, en attendant l'instantané.
appliquerAmbiance(lireAmbianceMemorisee())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
