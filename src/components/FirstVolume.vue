<template>
  <GeneralVolumeVue
    Id="first-volume"
    Role="> Riolab"
    Description="Led the frontend development of various Riolab projects. 'Araucanía Infinita' and 'Frontera la película'."
    From="March 2023"
    To="July 2023"
    Link="https://riolab.com"
  ></GeneralVolumeVue>

  <div class="col-9 volume-company position-absolute">
    <div
      data-scroll
      data-scroll-speed="0.75"
      data-scroll-delay="0.18"
      data-scroll-direction="horizontal"
      class="center h-100"
      id="riolab-3d"
    ></div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import GeneralVolumeVue from "./GeneralVolume.vue";
import RiolabThree from "@/animations/RiolabThree.js";

onMounted(() => {
  RiolabThree();
});
</script>
