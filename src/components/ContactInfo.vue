<template>
  <div id="contact" class="major-section">
    <div class="d-flex w-100 center flex-row" style="height: 100vh">
      <div
        class="col-4 h-50 center option-icon"
        @click="openSocial('mail')"
        id="mail-3d"
      ></div>
      <div
        class="col-4 h-50 center option-icon"
        @click="openSocial('github')"
        id="github-3d"
      ></div>
      <div
        class="col-4 h-50 center option-icon"
        @click="openSocial('linkedin')"
        id="linkedin-3d"
      ></div>
      <div class="contact-cta">
        let's talk. i'll make sure to respond as soon as possible &nbsp;

        <i class="bi bi-emoji-smile-fill option-icon"></i>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import SocialThree from "@/threejs/SocialThree";

let links = {
  github: "https://www.github.com/matias-berrios-o",
  linkedin: "https://www.linkedin.com/in/matiasberrios/",
  mail: "mailto:matiasberrios@uc.cl",
};

const openSocial = (social) => {
  window.open(links[social], "_blank");
};

onMounted(() => {
  SocialThree("linkedin");
  SocialThree("github");
  SocialThree("mail");
});
</script>
