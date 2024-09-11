<script>
  import { createEventDispatcher } from "svelte";
  export let checked = false;

  const dispatch = createEventDispatcher();

  function handleChange(event) {
    dispatch("change", { checked: event.target.checked });
  }
</script>

<div class="switch">
  <input type="checkbox" bind:checked on:change={handleChange} />
  <span class="slider round"></span>
</div>

<style>
  .switch {
    --width: 36px;
    position: relative;
    display: inline-block;
    width: var(--width);
    height: 20px;
  }

  .switch input {
    opacity: 0;
    position: absolute;
    inset: 0;
    z-index: 1;
    cursor: pointer;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    -webkit-transition: 0.4s;
    transition: 0.4s;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: calc(100% - 6px);
    width: auto;
    aspect-ratio: 1;
    left: 3px;
    bottom: 3px;
    background-color: white;
    -webkit-transition: 0.4s;
    transition: 0.4s;
  }

  input:checked + .slider {
    background-color: var(--primary);
  }

  input:focus + .slider {
    box-shadow: 0 0 1px var(--primary);
  }

  input:checked + .slider:before {
    -webkit-transform: translateX(calc(var(--width) - 100% - 6px));
    -ms-transform: translateX(calc(var(--width) - 100% - 6px));
    transform: translateX(calc(var(--width) - 100% - 6px));
  }

  /* Rounded sliders */
  .slider.round {
    border-radius: 34px;
  }

  .slider.round:before {
    border-radius: 50%;
  }
</style>
