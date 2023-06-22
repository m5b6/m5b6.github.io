import { gsap } from "gsap";

export default function SideBarBehaviour() {
  let element = document.querySelector("#sidebar");
  let elementfake = document.querySelector("#sidebarfake");

  let expandTl = gsap.timeline({
    paused: true,
    delay: 0.25,
    onStart: () => {
      document.querySelectorAll(".option-txt").forEach((element) => {
        element.style.display = "block";
      });
    },
    onReverseComplete: () => {
      element.style.width = "5%";
      elementfake.style.width = "5%";
      document.querySelectorAll(".option-txt").forEach((element) => {
        element.style.display = "none";
      });
    },
  });

  expandTl
    .to(
      element,
      {
        duration: 0.65,
        width: "15%",
        ease: "power3.inOut",
      },
      0
    )
    .to(
      elementfake,
      {
        duration: 0.65,
        width: "15%",
        ease: "power3.inOut",
      },
      0
    )
    .fromTo(
      ".option-txt",
      {
        opacity: 0,
        scaleY: 2.5,
        y: 150,
      },
      {
        duration: 0.65,
        scaleY: 1,
        y: 0,
        opacity: 1,
        stagger: 0.05,
        ease: "power3.inOut",
      },
      ">-0.5"
    );

  element.addEventListener("mouseenter", function () {
    expandTl.play();
  });

  element.addEventListener("mouseleave", function () {
    expandTl.reverse();
  });
}
