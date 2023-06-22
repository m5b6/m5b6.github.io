<script setup>
import { onMounted, ref } from "vue";
import SideBarBehaviour from "@/animations/SideBarBehaviour.js";
import HideOneContainerShowAnother from "@/animations/HideOneContainerShowAnother.js";
let activeSection = ref("start");

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("option")) {
    e.target.classList.add("active");
    e.target.classList.add("bounce"); // add bounce animation class
    [...document.getElementsByClassName("option")].forEach((element) => {
      if (element != e.target) {
        element.classList.remove("active");
        element.classList.remove("bounce"); // remove bounce animation class from other elements
      }
    });
  } else if (
    //parent contains option
    e.target.parentElement.classList.contains("option")
  ) {
    e.target.parentElement.classList.add("active");
    e.target.parentElement.classList.add("bounce"); // add bounce animation class
    [...document.getElementsByClassName("option")].forEach((element) => {
      if (element != e.target.parentElement) {
        element.classList.remove("active");
        element.classList.remove("bounce"); // remove bounce animation class from other elements
      }
    });
  }
});

onMounted(() => {
  SideBarBehaviour();
});

const sidebarAction = (name) => {
  HideOneContainerShowAnother(activeSection.value, name);
  activeSection.value = name;
};
</script>

<template>
  <div class="options-icons-container">
    <div
      class="option option-1 inverted-animation hover-underline-animation active"
      @click="sidebarAction('start')"
    >
      <i class="bi bi-house-heart-fill option-icon"></i>
      <p class="option-txt">home</p>
    </div>

    <div
      class="option option-2 inverted-animation hover-underline-animation"
      @click="sidebarAction('experience')"
    >
      <i class="bi bi-stars option-icon"></i>
      <p class="option-txt">work</p>
    </div>
    <div
      class="option option-3 inverted-animation hover-underline-animation"
      @click="sidebarAction('aboutme')"
    >
      <i class="bi bi-emoji-smile-fill option-icon"></i>
      <p class="option-txt">about</p>
    </div>
    <div
      class="option option-4 inverted-animation hover-underline-animation"
      @click="sidebarAction('contact')"
    >
      <i class="bi bi-envelope-fill option-icon"></i>
      <p class="option-txt">contact</p>
    </div>
  </div>
</template>
