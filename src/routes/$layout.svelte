<script>
  import Header from "$lib/Header.svelte";
  import Footer from "$lib/Footer.svelte";
  import "../app.scss";
  import {setContext} from 'svelte';
  import {writable} from 'svelte/store';

  let innerWidth;

  let size = writable("mobile");

  $: if(innerWidth >= 1000){
    $size = "desktop"
  } else if (innerWidth >= 768){
    $size = "tablet"
  } else {
    $size = "mobile"
  }

  setContext('size', size)

</script>

<svelte:window bind:innerWidth={innerWidth} />

<Header />
<main>
  <slot />
</main>
<Footer />

<style lang="scss">
  main {
    text-align: center;
    padding: 1em;
    margin: 0 auto;
    height: 100%;
    position: relative;
    display: grid;
    grid-template-columns: 24px 1fr 24px;
    grid-template-rows: 60px 1fr;
    grid-auto-columns: min-content;
    justify-content: space-between;
    align-items: start;
    row-gap: 1rem;
    @media screen and (min-width: 768px){
      grid-template-columns: 40px 1fr 40px;
    }
    @media screen and (min-width: 600px){
      grid-template-columns: 40px 1fr 40px;
    }
    @media screen and (min-width: 650px){
      grid-template-columns: 1fr minmax(650px, 700px) 1fr;
      grid-template-rows: 60px 1fr;
    }
  }

</style>
