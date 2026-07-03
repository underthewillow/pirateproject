import React from 'react'
import ReactDOM from 'react-dom/client'
import { DataProvider } from './context/DataContext'
import { RollProvider } from './context/RollContext'
import App from './App'
import './styles/theme.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DataProvider>
      <RollProvider>
        <App />
      </RollProvider>
    </DataProvider>
  </React.StrictMode>
)
