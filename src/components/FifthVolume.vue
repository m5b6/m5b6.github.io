<template>
  <GeneralVolumeVue
    Id="first-volume"
    Role="> PUC"
    Description="
    I'm currently studying software engineering at PUC. Awarded ”Matrícula de Honor” Honor Roll Scholarship, & First Dean’s Academic Scholarship (Monseñor Joaquín Larraín Gandarillas Scholarship).
    "
    From="March 2020"
    To="Present"
    Link="https://www.uc.cl/"
  ></GeneralVolumeVue>

  <div class="col-9 volume-company position-absolute">
    <div
      data-scroll
      data-scroll-speed="0.75"
      data-scroll-delay="0.18"
      data-scroll-direction="horizontal"
      class="center h-100"
      id="puc-3d"
    ></div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import GeneralVolumeVue from "./GeneralVolume.vue";
import PucThree from "@/animations/PucThree";

onMounted(() => {
  PucThree();
});
</script>
