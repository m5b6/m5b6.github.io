import { gsap } from "gsap";
import AddEventListenersToOptions from "./AddEventListenersToOptions";
export default function FirstTransitionAnimation() {
  let tl = gsap.timeline({
    defaults: { duration: 0.75 },
  });

  document.querySelector(".main-section").style.display = "block";

  tl.to(".titles-container", {
    opacity: 0,
    pointerEvents: "none",
    scale: 0.85,

    ease: "power3.inOut",
    onComplete: function () {
    },
  })
    .to(
      ".right-arrow",
      {
        right: "-400",
        scale: 0.85,
      },
      "<"
    )

    .to(".option-1", {
      opacity: 1,
      transform: "matrix3d(1,0,0.00,0,0.00,1,0,0,0,0,1,0,0,0,0,1)",
      scale: 1,
    })
    .to(
      ".option-2",
      {
        opacity: 1,
        transform: "matrix3d(1,0,0.00,0,0.00,1,0,0,0,0,1,0,0,0,0,1)",
        scale: 1,
      },
      ">-0.6"
    )
    .to(
      ".option-3",
      {
        opacity: 1,
        transform: "matrix3d(1,0,0.00,0,0.00,1,0,0,0,0,1,0,0,0,0,1)",
        scale: 1,
      },
      ">-0.6"
    )
    .to(
      ".option-4",
      {
        opacity: 1,
        transform: "matrix3d(1,0,0.00,0,0.00,1,0,0,0,0,1,0,0,0,0,1)",
        scale: 1,
      },
      ">-0.6"
    );

  AddEventListenersToOptions();
}
