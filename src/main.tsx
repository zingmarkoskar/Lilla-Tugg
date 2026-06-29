import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./storagePolyfill";
import "./index.css";
import MatLogg from "./components/MatLogg";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MatLogg />
  </StrictMode>
);
