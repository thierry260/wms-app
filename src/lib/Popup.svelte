<script>
  export let message;
  export let onConfirm;
  export let onCancel;

  function handleConfirm() {
    if (onConfirm) onConfirm();
  }

  function handleCancel() {
    if (onCancel) onCancel();
  }
</script>

<div class="popup-overlay">
  <div class="popup">
    <p>{message}</p>
    <button on:click={handleConfirm}>Yes</button>
    <button on:click={handleCancel}>No</button>
  </div>
</div>

<style lang="scss">
  .popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .popup {
    background: white;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    text-align: center;
  }
</style>
