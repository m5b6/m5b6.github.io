import { gsap } from "gsap";

export default function Welcome() {
  gsap
    .timeline({
      defaults: { duration: 0.75 },
      onComplete: function () {
        document.querySelector("#welcome").remove();
      },
    })
    .from(".welcome-txt-1", {
      opacity: 0,
      delay: 0.5,
      scaleY: 0.5,
      y: 300,
      ease: "power3.inOut",
      filter: "blur(10px)",
    })
    .from(".welcome-txt-2", {
      opacity: 0,
      scaleY: 0.5,

      y: 100,
      ease: "power3.inOut",
      filter: "blur(10px)",
    })
    .to("#welcome", {
      delay: 0.5,
      backgroundColor: "transparent",
    })
    .to(
      ".welcome-txt-1",
      {
        opacity: 0,
        ease: "power4.in",
        scaleY: 15,
        y: -900,
      },
      "<"
    )
    .to(
      ".welcome-txt-2",
      {
        opacity: 0,
        ease: "power4.in",
        y: 900,
        scaleY: 15,
      },
      "<"
    )
    .from("#sections", {
      delay: 0.5,
      opacity: 0,
    }, ">-0.5")
    .from(
      ".option-1",
      {
        opacity: 0,
        ease: "power4.out",
        scaleX: 2.5,
        x: -200,
      },
      "<"
    )
    .from(
      ".option-2",
      {
        opacity: 0,
        ease: "power4.out",
        scaleX: 2.5,
        x: -400,
      },
      "<+0.05"
    )
    .from(
      ".option-3",
      {
        opacity: 0,
        ease: "power4.out",
        scaleX: 2.5,
        x: -600,
      },
      "<+0.05"
    )
    .from(
      ".option-4",
      {
        opacity: 0,
        ease: "power4.out",
        scaleX: 2.5,
        x: -800,
      },
      "<+0.05"
    )
    .fromTo(".start-letter-span",{
      opacity: 0,
      scaleY: 2.5,
      y: 500,
    }, {
      opacity: 1,
      ease: "power3.inOut",
      scaleY: 1,
      y: 0,
      duration: 1,
      stagger: 0.01,
    })

}
