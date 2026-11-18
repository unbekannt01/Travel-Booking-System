import React from "react"
import ReactDOM from "react-dom/client"
import "@fontsource-variable/inter"
import "@fontsource/noto-sans-devanagari/devanagari-400.css"
import "@fontsource/noto-sans-devanagari/devanagari-500.css"
import "@fontsource/noto-sans-devanagari/devanagari-600.css"
import "@fontsource/noto-sans-devanagari/devanagari-700.css"
import "@fontsource/noto-sans-gujarati/gujarati-400.css"
import "@fontsource/noto-sans-gujarati/gujarati-500.css"
import "@fontsource/noto-sans-gujarati/gujarati-600.css"
import "@fontsource/noto-sans-gujarati/gujarati-700.css"
import App from "./App"
import "./index.css"
import { ThemeProvider } from "./theme"
import { ToastProvider } from "./components/common/ToastContext"
import { ConfirmModalProvider } from "./components/common/ConfirmModalContext"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <ConfirmModalProvider>
          <App />
        </ConfirmModalProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
