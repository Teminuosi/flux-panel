
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";
import "@/styles/globals.css";
import "@/styles/themes.css";
import { applySkin, savedSkin } from "@/config/skins";

// 首屏就把皮肤落到 <html>,避免主题闪烁
applySkin(savedSkin().id);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Provider>
      <App />
    </Provider>
  </BrowserRouter>
);

