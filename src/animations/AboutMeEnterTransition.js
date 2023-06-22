import { gsap } from "gsap";

export default function AboutMeEnterTransition() {
  gsap.to(".aboutme-text", {
    delay: 0.5,
    opacity: 1,
    scale: 1,
  });
  gsap.to(".aboutme-img",{
    opacity:1,
    scale: 1
  })
}
