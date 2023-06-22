<script setup>
import { onMounted } from "vue";
import { defineProps } from "vue";
import gsap from "gsap";

const props = defineProps({
  Role: {
    type: String,
    required: true,
  },
  Description: {
    type: String,
    required: true,
  },
  From: {
    type: String,
    required: true,
  },
  To: {
    type: String,
    required: true,
  },
  HeaderMethod: {
    type: Function,
    required: false,
    default: () => {},
  },
  Inverted: {
    type: Boolean,
    required: false,
    default: false,
  },
  Id: {
    type: String,
    required: false,
  },
  Link: {
    type: String,
    required: false,
  },
  Small: {
    type: Boolean,
    required: false,
    default: false,
  },
});


gsap;
props;

onMounted(async () => {
  /*   setTimeout(() => {
    let container = document.querySelector("#" + props.Id);
    let title = container.querySelector(".exp-text.bold");
    let content = container.querySelectorAll(".exp-text:not(.bold)")[0];
    let content2 = container.querySelectorAll(".exp-text:not(.bold)")[1];

    console.log(props.Id);

    if (props.Id === "first-volume") {
      console.log("first volume returned");
      return;
    } else {
      let tl = gsap.timeline({
        scrollTrigger: {
          trigger: "#" + props.Id,
          start: "top 50%",
          scroller: ".main-section",
        },
        defaults: { ease: "power1.inOut" },
        onStart: () => {},
      });

      tl.from("." + props.Id, {
        duration: 1,
        y: 50,
        stagger: 0.2,
      });
      tl.fromTo(
        title,
        {
          filter: "blur(3px)",
          opacity: 0,
          y: "180%",
          scaleY: 2,
        },
        {
          filter: "blur(0px)",
          duration: 0.3,
          scaleY: 1,
          opacity: 1,
          y: 0,
        },
        "<"
      );
      tl.fromTo(
        content,
        {
          filter: "blur(3px)",

          opacity: 0,
          lineHeight: "2em",
          scaleY: 2,
          y: "150%",
        },
        {
          filter: "blur(0px)",

          scaleY: 1,
          duration: 0.3,
          opacity: 1,
          lineHeight: "1.5em",
          y: 0,
        },
        "<+0.1"
      );
      tl.fromTo(
        content2,
        {
          filter: "blur(3px)",

          opacity: 0,
          lineHeight: "4em",
          y: "50%",
        },
        {
          filter: "blur(0px)",

          duration: 0.3,
          opacity: 1,
          lineHeight: "1.5em",
          y: 0,
        },
        "<+0.1"
      );
    }
  }, 10); */
});

const goToLink = () => {
  if (props.Link === undefined) {
    return;
  } else {
    window.open(props.Link, "_blank");
  }
};
</script>

<template>
  <div
    class="content-row d-flex"
    :class="{ 'justify-content-end': Inverted, 'small-content-row': Small }"
    :id="Id"
    data-scroll
  >
    <!--     <div class="second-volume" ref="threeContainer"></div>
     -->
    <div
      class="col-7 d-flex flex-wrap align-content-end"
      :class="{ 'justify-content-end': Inverted }"
    >
      <p
        class="exp-text bold hover-underline-animation"
        data-scroll
        :data-scroll-call="Id"
        :class="{
          'text-end inverted-animation': Inverted,
          'text-start': !Inverted,
        }"
        @click="goToLink"
      >
        {{ Role }}
      </p>
      <p
        class="exp-text"
        :class="{
          'text-end': Inverted,
          'text-start': !Inverted,
        }"
      >
        {{ Description }}
      </p>
      <p
        class="exp-text"
        :class="{
          'text-end': Inverted,
          'text-start': !Inverted,
        }"
        v-if="From !== '' && To !== ''"
      >
        <b>{{ From }} </b> <i class="bi bi-arrow-right"></i> <b> {{ To }}</b>
      </p>
    </div>
  </div>
</template>
