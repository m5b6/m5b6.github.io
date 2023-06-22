import { createApp } from "vue";
import App from "./App.vue";
import bootstrap from "bootstrap";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/all";

/* boostrap icons */
import "bootstrap-icons/font/bootstrap-icons.css";



const app = createApp(App);
app.use(bootstrap);
app.use(gsap);

gsap.registerPlugin(ScrollTrigger);

app.mount("#app");
