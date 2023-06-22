import LocomotiveScroll from "locomotive-scroll";
import { ScrollTrigger } from "gsap/all";
export default function LocomotiveSetup() {
  const scroll = new LocomotiveScroll({
    /* on body */
    el: document.querySelector(".main-section"),
    smooth: true,
    inertia: 0.6,
  });
  scroll.start();

  ScrollTrigger.refresh();
  scroll.on("scroll", ScrollTrigger.update);
  ScrollTrigger.scrollerProxy(".main-section", {
    scrollTop(value) {
      return arguments.length
        ? scroll.scrollTo(value, 0, 0)
        : scroll.scroll.instance.scroll.y;
    },
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    },
  });
  ScrollTrigger.addEventListener("refresh", () => scroll.update());
  ScrollTrigger.refresh();
}
