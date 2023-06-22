<script setup>
const startText = "hi, i'm matías";

let startTextArray = startText.split("");
</script>

<template>
  <div id="start">
    <div style="height: 100vh" class="center">
      <div class="heroest">
        <p
          v-for="(letter, index) in startTextArray"
          :key="index"
          class="start-letter-span"
        >
          {{ letter === " " ? "&nbsp;" : letter }}
        </p>
        <br />
        <br />
        <div>

        </div>
      </div>
    </div>
  </div>
</template>
