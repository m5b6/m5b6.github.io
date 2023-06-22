export default function AddEventListenersToOptions() {
  let inicio = ".option-1";
  let experiencia = ".option-2";
  let sobreMi = ".option-3";
  let contacto = ".option-4";
  let colourDict = {
    ".option-1": "#45646C",
    ".option-2": "#B95E34",
    ".option-3": "#99B0BE",
    ".option-4": "#2F4C72",
  };

  let optionSelectorsArray = [
    ".option-1",
    ".option-2",
    ".option-3",
    ".option-4",
  ];

  let addListener = (optionSelector) => {
    let option = document.querySelector(optionSelector);
    option.addEventListener("mouseover", () => {
      document.body.style.backgroundColor = colourDict[optionSelector];
      optionSelectorsArray.forEach((selector) => {
        if (selector !== optionSelector) {

          document.querySelector(selector).style["filter"] = "blur(3px)";
          
        } else {
          document.querySelector(selector).style["filter"] = "blur(0px)";
        }
      });
    });
  };

  addListener(inicio);
  addListener(experiencia);
  addListener(sobreMi);
  addListener(contacto);
}
