import React from 'react'
import ReactDOM from 'react-dom/client'
import { DataProvider } from './context/DataContext'
import { AppAuthProvider } from './context/AuthContext'
import { RollProvider } from './context/RollContext'
import App from './App'
import './styles/theme.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DataProvider>
      <AppAuthProvider>
        <RollProvider>
          <App />
        </RollProvider>
      </AppAuthProvider>
    </DataProvider>
  </React.StrictMode>
)
