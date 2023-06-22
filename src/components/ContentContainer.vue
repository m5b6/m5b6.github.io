<script setup>
import ExperienceSection from "./ExperienceSection.vue";
import StartSection from "./StartSection.vue";
import AboutMe from "./AboutMe.vue";
import ContactInfo from "./ContactInfo.vue";
</script>
<template>
  <div
    class="container px-5"
    id="loco"
    data-scroll-container
    style="height: fit-content !important"
  >
    <StartSection />
    <ExperienceSection />
    <AboutMe />
    <ContactInfo />
  </div>
</template>
