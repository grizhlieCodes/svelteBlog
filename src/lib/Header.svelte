<script>
  import { createEventDispatcher } from "svelte";
  import {getContext} from 'svelte';
  const dispatch = createEventDispatcher();
  
  let size = getContext('size')

  // import {fade} from 'svelte/transition';
  let buttonClicked = false;

  function toggleClickState() {
    buttonClicked = !buttonClicked;
  }
</script>

<header class={$size}>
  <a class="logo" href="/">
    <span class="big-letter">H</span>appy<span class="big-letter">M</span
    >ystic<span class="light-font"><span class="big-letter">B</span>log</span>
  </a>
  <div class="button {$size}" class:clicked={buttonClicked} on:click={toggleClickState}>
    <div class="span-container">
      <span />
      <span />
    </div>
  </div>
  <!-- {#if buttonClicked} -->
  <nav class="{$size}">
    <a
      href="/"
      on:click={toggleClickState}
      on:click={() => dispatch("loader", "recent")}>Blog</a
    >
    <a
      href="/about"
      on:click={toggleClickState}
      on:click={() => dispatch("loader", "recent")}>About</a
    >
    <a
      href="/contact"
      on:click={toggleClickState}
      on:click={() => dispatch("loader", "recent")}>Contact</a
    >
    <a
      href="/mainSite"
      on:click={toggleClickState}
      on:click={() => dispatch("loader", "recent")}>Coaching</a
    >
  </nav>
  <!-- {/if} -->
</header>

<style lang="scss">
  header {
    width: 100%;
    max-width: 1110px;
    margin: auto;
    height: 100px;
    padding: 20px;
    display: flex;
    flex-flow: row nowrap;
    justify-content: space-between;
    align-items: center;
  }

  .logo {
    font-family: var(--cinzel);
    font-size: 17.5px;
    font-weight: 700;
    color: var(--primary-200);
    transition: color 250ms ease;
  }
  .logo span.big-letter {
    font-size: 22.5px;
  }

  .logo span.light-font {
    color: var(--primary-100);
  }

  .logo {

    &:hover{
      color: var(--primary-100);
  
       span.light-font {
        color: var(--primary-200);
      }

    }

  }

  .button {
    z-index: 100;
    width: 25px;
    height: 25px;
    background: var(--primary-100);
    cursor: pointer;
    transition: all 750ms ease;
    position:relative;
    /* display: grid;
        place-items:center; */
  }

  .button.tablet,.button.desktop {
    display: none;
  }

  .button.clicked {
    transform: rotate(225deg);
    border-radius: 50%;
    background: var(--primary-300);

    .span-container span {
      opacity: 1;
    }
  }

  .button .span-container {
    width: 80%;
    height: 80%;
    display: grid;
    place-items: center;
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    transform: translate(10%, 12%);
  }

  .button .span-container span {
    position: absolute;
    width: 80%;
    height: 2px;
    background: white;
    opacity: 0;
    transition: opacity 300ms ease;

    &:nth-child(1) {
      transform: rotate(90deg);
    }
  }

  nav {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    background: var(--primary-200);
    height: 100vh;
    width: 250px;
    display: flex;
    flex-flow: column nowrap;
    align-items: center;
    justify-content: center;
    transform: translateX(150%);
    transition: transform 250ms ease;
    z-index: 50;
  }

  nav.tablet,
  nav.desktop {
    transform: translateX(0);
    background: transparent;
    position: static;
    width: auto;
    height: 100%;
    flex-flow: row nowrap;
    align-items:center;
    justify-content: flex-end;
  }

  .button.mobile.clicked ~ nav {
    transform: translateX(0%);
  }

  nav a {
    text-decoration: none;
    font-family: var(--garamond);
    font-size: 22px;
    color: white;
    transition: color 250ms ease;


    &:hover {
      color: var(--primary-300);
    }
  }

  nav.mobile a:not(:nth-last-child(1)) {
    margin-bottom: 0.7rem;
  }

  nav.tablet a:not(:nth-last-child(1)),
  nav.desktop a:not(:nth-last-child(1)){
    margin-bottom: 0;
    margin-right: 1.4rem;
  }

  nav.tablet a, nav.desktop a {
    color: var(--primary-200);

    &:hover {
      color: var(--primary-300);
      text-decoration: underline;
    }
  }


</style>
