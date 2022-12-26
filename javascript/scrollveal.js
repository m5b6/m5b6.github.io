const defaultProps = {
  easing: "cubic-bezier(0.5, 0, 0, 1)",
  distance: "30px",
  origin: "bottom",
  duration: 1000,
  desktop: true,
  mobile: true,
};
// Hero Section
ScrollReveal().reveal(".hero-title", {
  ...defaultProps,
  delay: 100,
  origin: window.innerWidth > 768 ? "left" : "bottom",
});
ScrollReveal().reveal(".name", {
  ...defaultProps,
  distance: "0px",
  delay: 200,
  scale: 0,
});
ScrollReveal().reveal(".hero-cta", {
  ...defaultProps,
  delay: 300,
  origin: window.innerWidth > 768 ? "left" : "bottom",
});
ScrollReveal().reveal(".scroll-down-link", {
  ...defaultProps,
  delay: 2000,
  origin: "top",
});

/* About Section */
ScrollReveal().reveal(".section-title", {
  ...defaultProps,
  delay: 400,
  distance: "0px",
});
ScrollReveal().reveal(".about-wrapper__image", {
  ...defaultProps,
  delay: 600,
  scale: 0.5,
});

ScrollReveal().reveal(".about-wrapper__info", {
  ...defaultProps,
  delay: 700,
  distance: "100px",
  origin: window.innerWidth > 768 ? "left" : "top",
});

/* Projects Section */
ScrollReveal().reveal(".project-wrapper__text", {
  ...defaultProps,
  delay: 600,
  origin: window.innerWidth > 768 ? "left" : "bottom",
});

ScrollReveal().reveal(".project-wrapper__image", {
  ...defaultProps,
  delay: 600,
  scale: 0.9,
  origin: window.innerWidth > 768 ? "right" : "bottom",
});

/* Contact Section */
ScrollReveal().reveal(".contact-wrapper", {
  ...defaultProps,
  delay: 600,
});

// When the user scrolls the page, execute myFunction
window.onscroll = function() {myFunction()};

// Get the header
var header = document.getElementById("myHeader");

// Get the offset position of the navbar
var sticky = header.offsetTop;

// Add the sticky class to the header when you reach its scroll position. Remove "sticky" when you leave the scroll position
function myFunction() {
  if (window.pageYOffset > sticky) {
    header.classList.add("sticky");
  } else {
    header.classList.remove("sticky");
  }
}

//to spanish

document.getElementById("spanish").addEventListener("click", function(){
  let spanish  = document.getElementById("spanish") 
  let english  = document.getElementById("english")
  document.body.style.opacity = 0;
  english.style.opacity = 1
  spanish.style.opacity = 0.3
  setTimeout(function(){
  (document.getElementsByClassName("name")[0].innerHTML="desarrollador & estudiante")
  document.getElementsByClassName("cta-btn cta-btn--hero")[0].innerHTML="ver más"
  document.getElementsByClassName("about-title")[0].innerHTML="Sobre mí"
  document.getElementsByClassName("about-wrapper__info-text")[0].innerHTML = "Como estudiante y desarrollador, me encuentro buscando nuevos desafíos y oportunidades para progresar mis habilidades y conocimientos."
  document.getElementsByClassName("about-wrapper__info-text")[1].innerHTML = "Siempre busco empujar mis limites. Me veo a mí mismo como una persona con iniciativa que disfruta de colaborar con personas apasionadas por lo que hagan."
  document.getElementsByClassName("about-wrapper__info-text")[2].innerHTML = "Actualmente estoy estudiando Ingeniería de Software en la <a href='https://dcc.uc.cl/'>Pontificia Universidad Católica de Chile</a>."
  document.getElementsByClassName("about-wrapper__info-text")[3].innerHTML = "Si tienes alguna pregunta o quieres contactarme, ¡No dudes en <a href='mailto:matiasberrios@uc.cl'>contactarme!</a>"
  document.getElementsByClassName("cta-btn cta-btn--resume")[0].innerHTML = "Ver CV" ;
  (document.getElementsByClassName("section-title dark-blue-text"))[0].innerHTML = "Algunos proyectos"
  document.getElementsByClassName("project-wrapper__text-info")[0].innerHTML = "Actualmente contribuyendo a la cuantificación del efecto negativo que puede tener el rolling shutter sobre el sistema Hover-Cal de calibración de telescopios, utilizando visión por computador."
  document.getElementsByClassName("project-wrapper__text-info")[1].innerHTML = "Emulación del evento <a href='https://www.reddit.com/r/place/' style='color: black;'>/r/place</a> de Reddit basada únicamente en Python, orientada a los usuarios de Telegram del Departamento de Ciencias de la Computación de la UC. Recibió más de 2000 interacciones de usuario en su primera hora!" 
  
  document.body.style.opacity = 1;
}, 350);


});

//to english

document.getElementById("english").addEventListener("click", function(){
  document.body.style.opacity = 0;

  let english  = document.getElementById("english")
  let spanish  = document.getElementById("spanish")
  spanish.style.opacity = 1
  english.style.opacity = 0.3

  
  setTimeout(function(){
    (document.getElementsByClassName("name")[0].innerHTML="developer & student")
    document.getElementsByClassName("cta-btn cta-btn--hero")[0].innerHTML="see more!"
  document.getElementsByClassName("about-title")[0].innerHTML="About me"
  document.getElementsByClassName("about-wrapper__info-text")[0].innerHTML = "As a student and developer, I always find myself looking for new challenges and opportunities to leverage my skills and knowledge."
  document.getElementsByClassName("about-wrapper__info-text")[1].innerHTML = "As a person, I'm strongly dedicated to pushing my limits. I percieve myself as self-starter that also enjoys working with people who are as passionate as I am."
  document.getElementsByClassName("about-wrapper__info-text")[2].innerHTML = "I am currently studying Software Engineering at <a href='https://dcc.uc.cl/'>PUC Chile</a>."
  document.getElementsByClassName("about-wrapper__info-text")[3].innerHTML = "If you have any questions or want to get in touch, feel free to <a href='mailto:matiasberrios@uc.cl'>contact me!</a>"
  document.getElementsByClassName("cta-btn cta-btn--resume")[0].innerHTML = "View Resume" ;
  (document.getElementsByClassName("section-title dark-blue-text"))[0].innerHTML = "Some projects"
  document.getElementsByClassName("project-wrapper__text-info")[0].innerHTML = "Currently contributing to a computer vision oriented project that aims to quantify the negative effect of rolling shutter on PUC's drone-based telescope calibration system."
  document.getElementsByClassName("project-wrapper__text-info")[1].innerHTML = "Python-based, near identical emulation of Reddit’s <a href='https://www.reddit.com/r/place/' style='color: black;'>/r/place event</a> , achieved through Telegram user interactions with the 'DCCPlace' bot, aimed towards PUC’s CS Student community. Handled almost 2000 user interactions within 1 hour of public release!"


  document.body.style.opacity = 1;
}, 350);

});