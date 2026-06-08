// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ApiContext } from "./api";
import { createNeonApi } from "./api/neonApi";
import { ThemeProvider } from "./lib/ThemeContext";
import "./index.css";

const api = createNeonApi();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ApiContext.Provider value={api}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ApiContext.Provider>
    </ThemeProvider>
  </React.StrictMode>
);
