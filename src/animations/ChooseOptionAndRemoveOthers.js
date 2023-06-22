import { gsap } from "gsap";
import AboutMeEnterTransition from "./AboutMeEnterTransition";
export default function ChooseOptionAndRemoveOthers(optionNumber) {
  if (optionNumber === 3) {
    /* sobremi */
    AboutMeEnterTransition();
  }

  let optionsSelectors = [".option-1", ".option-2", ".option-3", ".option-4"];

  let selectedOption = `.option-${optionNumber}`;

  let tl = gsap.timeline({
    defaults: {
      duration: 0.5,
      ease: "power2.inOut",
    },
    onComplete: () => {
      gsap.to(selectedOption, {
        top: "20vh",
      });
    },
  });
  optionsSelectors.forEach((selector) => {
    document.querySelector(selector).style.pointerEvents =
      "none"; /* OJO CON ESTO!!!!!!!!!!!!!!!!!!!!!!!!! */ /* OJO CON ESTO!!!!!!!!!!!!!!!!!!!!!!!!! */ /* OJO CON ESTO!!!!!!!!!!!!!!!!!!!!!!!!! */
    if (selector !== selectedOption) {
      tl.to(
        selector,
        {
          opacity: 0,
          marginLeft: 20,
          scale: 0.8,
        },
        "<"
      );
    }
  });
  tl
    .to(
      ".left-arrow",
      {
        opacity: 1,
        scale: 1,
        marginLeft: 150,
      },
      "<"
    )
    .to(
      ".option-fill",
      {
        width: "100%",
      },
      "<"
    ).to;
}
