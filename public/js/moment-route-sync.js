import { mountAll, unmountAll } from "../assets/moments/moments.js";

window.addEventListener("jlpt:route-change", () => {
  unmountAll(document);
  void mountAll(document);
});
