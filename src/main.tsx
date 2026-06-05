import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ApiContext } from "./api";
import { createMockApi } from "./api/mockApi";
import "./index.css";

const api = createMockApi();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApiContext.Provider value={api}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ApiContext.Provider>
  </React.StrictMode>
);
