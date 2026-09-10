---
theme: dashboard
title: lidar captcha
toc: false

---
# This is a lidar captcha


```js
import PointcloudCard from "./components/PointcloudCard.js";
import { createRoot } from "npm:react-dom/client";

const container = document.createElement("div");
const root = createRoot(container);
root.render(React.createElement(PointcloudCard));

display(container);
