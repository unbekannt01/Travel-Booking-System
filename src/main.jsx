import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { ToastProvider } from "./components/common/ToastContext"
import { ConfirmModalProvider } from "./components/common/ConfirmModalContext"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <ConfirmModalProvider>
        <App />
      </ConfirmModalProvider>
    </ToastProvider>
  </React.StrictMode>,
)
