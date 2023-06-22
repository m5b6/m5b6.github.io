<template>
  <GeneralVolumeVue
    Role="araucanía infinita"
    Description=""
    From=""
    To=""
    Id="second-volume"
    Link="http://dev.araucaniainfinita.cl/entrepreneurs/"
    Small="true"
  ></GeneralVolumeVue>
  <div class="col-9 small-volume-company position-absolute">
    <div
      data-scroll
      data-scroll-speed="0.75"
      data-scroll-delay="0.18"
      data-scroll-direction="horizontal"
      class="center h-100"
    >
      <BlobTwo />
    </div>
  </div>
</template>

<script setup>
import GeneralVolumeVue from "./GeneralVolume.vue";
import BlobTwo from "@/assets/svgs/BlobTwo.vue";
</script>
