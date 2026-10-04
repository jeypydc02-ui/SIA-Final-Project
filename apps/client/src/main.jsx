import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { setupPwa } from "./lib/pwa.js";
import "./index.css";

setupPwa();

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
