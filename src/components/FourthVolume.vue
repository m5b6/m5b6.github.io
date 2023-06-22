<template>
  <GeneralVolumeVue
    Id="first-volume"
    Role="> Skipo"
    Description="As an intern, I contributed to the initial development of the Skipo web app, a platform that allows mass cryptocurrency transactions."
    From="January 2023"
    To="March 2023"
    Link="https://riolab.com"
  ></GeneralVolumeVue>

  <div class="col-9 volume-company position-absolute">
    <div
      data-scroll
      data-scroll-speed="0.75"
      data-scroll-delay="0.18"
      data-scroll-direction="horizontal"
      class="center h-100"
      id="skipo-3d"
    ></div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import GeneralVolumeVue from "./GeneralVolume.vue";
import SkipoThree from "@/animations/SkipoThree.js";

onMounted(() => {
  SkipoThree();
});
</script>
