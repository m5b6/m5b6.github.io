import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/all";
import { SkewBehaviour } from "./SkewBehaviour";

gsap.registerPlugin(ScrollTrigger);

let Typed = window.Typed;
export default function HeroAnimation() {
  SkewBehaviour(".skew-container", ".skew");

  let timeline = gsap.timeline({
    defaults: { duration: 1 },
    onComplete: function () {
      new Typed("#typewriter", {
        strings: [
          
          " <strong>frontend</strong>",
          " <strong>web development</strong>",
          " <strong>vue</strong>",
          " <strong>javascript</strong>",
          " <strong>typescript</strong>",
        ],
        typeSpeed: 100,
        backSpeed: 100,
        smartBackspace: true, // this is a default
        loop: true,
      });
    },
  });

  timeline.from(".hero-title-1", {
    delay: 0.3,
    opacity: 0,
    ease: "power3.inOut",
    scale: 0.95,
    y: 10,
    duration: 1.7,

    transform:
      "matrix3d(0.95,0,0.00,0,0.00,0.5,-0.87,-0.00009,0,0.87,0.5,0,0,0,0,1)",
  }),
    timeline.from(
      ".hero-title-2",
      {
        delay: 1,
        opacity: 0,
        ease: "power3.inOut",
        scale: 0.95,
        y: 10,
        duration: 1.7,
        transform:
          "matrix3d(0.95,0,0.00,0,0.00,0.5,-0.87,-0.00009,0,0.87,0.5,0,0,0,0,1)",
      },
      "<-0.8"
    );
  timeline
    .from(
      ".hero-title-3",
      {
        delay: 1,
        opacity: 0,
        ease: "power3.inOut",
        scale: 0.95,
        y: 10,
        duration: 1.7,
        transform:
          "matrix3d(0.95,0,0.00,0,0.00,0.5,-0.87,-0.00009,0,0.87,0.5,0,0,0,0,1)",
      },
      "<-0.8"
    )
    .from(
      ".locales-container",
      {
        opacity: 0,
        scale: 0.95,
        x: -120,
        duration: 0.5,
      },
      ">-0.5"
    )
    .to(
      ".right-arrow",
      {
        opacity: 1,
        duration: 0.5,
        marginRight: 0,
        ease: "power3.out",
      },
      "<"
    );
}
