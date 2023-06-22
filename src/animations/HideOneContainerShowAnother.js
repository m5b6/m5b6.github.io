import { gsap } from "gsap";
let headerText = {
  experience: "work",
  aboutme: "about me",
  contact: "contact",
  start: "home",
};

headerText;
export default function HideOneContainerShowAnother(
  hideSelector,
  showSelector
) {
  console.log(hideSelector, showSelector);
  let show = document.querySelector(`#${showSelector}`);
  let hide = document.querySelector(`#${hideSelector}`);
  let tl = gsap.timeline({
    defaults: {
      ease: "power3.inOut",
      duration: 1.1,
      onComplete: () => {
        window.dispatchEvent(new Event("resize"));
      },
    },
  });

  tl.to(`#${hideSelector}`, {
    scaleY: 2.3,
    y: "150%",
    opacity: 0,
    filter: "blur(10px)",
  });
  tl.fromTo(
    `#page-header`,
    {
      opacity: 1,
      scaleY: 1,
      filter: "blur(0px)",
      y: "0%",
      
    },
    {
      scaleY: 2.3,
      filter: "blur(10px)",
      y: "-300%",
      onComplete: () => {
        document.querySelector(`#page-header`).innerHTML =
          headerText[showSelector];
      },
    },
    "<"
  );

  tl.fromTo(
    `#${showSelector}`,
    {
      opacity: 0,
      scaleY: 2.3,
      filter: "blur(10px)",
      y: "-150%",
    },
    {
      scaleY: 1,
      opacity: 1,
      filter: "blur(0px)",
      y: "0%",
      onStart: () => {
        hide.style.display = "none";
        show.style.display = "block";
      },
    },
    ">"
  );
  tl.fromTo(
    `#page-header`,
    {
      opacity: 0,
      scaleY: 2.3,
      filter: "blur(10px)",
      y: "-300%",
    },
    {
      scaleY: 1,
      opacity: 1,
      filter: "blur(0px)",
      y: "0%",
    },
    "<"
  );
}
