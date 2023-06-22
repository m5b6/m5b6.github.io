<template>
  <div class="col-9 volume-company inverted position-absolute">
    <div
      data-scroll
      data-scroll-speed="-0.75"
      data-scroll-delay="0.18"
      data-scroll-direction="horizontal"
      class="center"
    >
      <BlobOne></BlobOne>
    </div>
  </div>
  <GeneralVolumeVue
    Role="frontera la película"
    Description=""
    From=""
    To=""
    Id="third-volume"
    Inverted="true"
    Link="https://fronteralapelicula.cl/"
    Small="true"
  ></GeneralVolumeVue>
</template>

<script setup>
import GeneralVolumeVue from "./GeneralVolume.vue";
import BlobOne from "@/assets/svgs/BlobOne.vue";
</script>
