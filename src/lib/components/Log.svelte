<script>
  import { createEventDispatcher } from "svelte";
  import { user } from "$lib/stores/user";
  import { PencilSimple, TrashSimple } from "phosphor-svelte";

  export let logItems = []; // Accept logItems as a prop

  $: currentUser = $user;

  //   $: console.log(logItems);

  function getUserImage(assignee) {
    if (!assignee || assignee == "") {
      assignee = "placeholder";
    }
    // Convert assignee to lowercase and append .jpg
    const filename = `${assignee.toLowerCase()}.jpg`;
    return `/img/people/${filename}`; // Update with the correct path to your images
  }

  function addLogItem() {
    const newLogItem = {
      id: Math.random().toString(36).substr(2, 9),
      content: "",
      date: new Date().toISOString().slice(0, 16),
      assignee: currentUser.displayName || currentUser.email || "Unknown User",
    };
    logItems.unshift(newLogItem);
    logItems = logItems;
    setTimeout(() => {
      editLogItem(newLogItem);
    }, 10);
  }

  function editLogItem(logItem) {
    const el = document.querySelector(`li[data-id='${logItem.id}'] .title`);
    el.contentEditable = "true";
    el.focus();
  }

  function deleteLogItem(id) {
    if (confirm("Weet je zeker dat je dit logboek item wilt verwijderen?")) {
      logItems = logItems.filter((item) => item.id !== id);
    }
  }
</script>

<div class="log full_width">
  <div class="log_head">
    <span class="legend">Logboek</span>
    <button class="add_log" type="button" on:click={addLogItem}>
      + Log item toevoegen</button
    >
  </div>
  <ul id="log_timeline">
    {#if logItems && logItems.length > 0}
      {#each logItems
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date)) as logItem}
        <li data-id={logItem.id}>
          <div
            class="top"
            style="--user_img: url({getUserImage(logItem.assignee)})"
          >
            <span class="assignee">{logItem.assignee}</span>
            <input
              class="date"
              type="datetime-local"
              bind:value={logItem.date}
            />

            <span class="actions">
              <span class="edit_log" on:click={() => editLogItem(logItem)}>
                <PencilSimple size={16} />
              </span>
              <span
                class="delete_log"
                on:click={() => deleteLogItem(logItem.id)}
              >
                <TrashSimple size={16} />
              </span>
            </span>
          </div>
          <div class="content" on:dblclick={() => editLogItem(logItem)}>
            <span
              class="title"
              contenteditable="false"
              bind:innerHTML={logItem.content}
              on:blur={(e) => (e.target.contentEditable = "false")}
            >
            </span>
          </div>
        </li>
      {/each}
    {/if}
  </ul>
</div>

<style lang="scss">
  .log {
    flex-direction: column;

    .log_head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      margin-bottom: 15px;

      .add_log {
        border: 1px solid var(--border);
        background: #fff;
        padding: 5px 10px;
        border-radius: 5px;
        transition:
          color 0.2s ease-out,
          border-color 0.2s ease-out;
        font-family: var(--body);
        font-size: 1.3rem;
        font-weight: 400;
        cursor: pointer;
        color: var(--gray-500);

        &.active {
          // border-color: var(--primary);
          // color: #fff;
        }
      }
    }

    #log_timeline {
      padding-bottom: 50px;
      padding-right: 15px;
      padding-left: 30px;
      display: flex;
      flex-direction: column;
      gap: 15px;
      min-height: 213px;
      max-height: 350px;
      overflow-y: auto;
      position: relative;

      &:not(:has(li)) {
        padding-bottom: 0;
        padding-left: 0;
        padding-right: 0;

        &::before {
          content: "Nog geen log toegevoegd";
          --notice-hs: 214.29deg, 20%;
          --response-color: var(
            --notice-hs
          ); // Standaard response kleur voor notice
          background-color: hsl(var(--response-color), 98%);
          color: hsl(var(--response-color), 50%);
          border: 1px dashed hsl(var(--response-color), 75%);
          padding: 20px;
          border-radius: 5px;
          padding: 20px;
          text-align: center;
          display: none;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px 5px;
          font-size: 1.4rem;
          line-height: 1.5;
          min-height: 213px;
          box-sizing: border-box;
        }
      }

      &:has(li) {
        --mask: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 1) 0,
            rgba(0, 0, 0, 1) 80%,
            rgba(0, 0, 0, 0) 96%,
            rgba(0, 0, 0, 0) 0
          )
          100% 50% / 100% 100% repeat-x;
        -webkit-mask: var(--mask);
        mask: var(--mask);
      }

      @media (max-width: $md) {
        &#log_timeline {
          mask: unset;
          padding-bottom: unset;
          padding-right: unset;
        }
      }

      /* ===== Scrollbar CSS ===== */
      scrollbar-width: auto;
      scrollbar-color: #e0e0e0 #ffffff;

      /* Chrome, Edge, and Safari */
      &::-webkit-scrollbar {
        width: 12px;
        height: 12px;
      }

      &::-webkit-scrollbar-track {
        background: #ffffff;
      }

      &::-webkit-scrollbar-thumb {
        background-color: #e0e0e0;
        border-radius: 10px;
        border: 3px solid #ffffff;
      }

      @media (max-width: $md) {
        max-height: unset;
      }

      li {
        display: flex;
        flex-direction: column;
        gap: 5px;
        position: relative;
        padding-top: 1px;

        &::before {
          content: "";
          position: absolute;
          left: -19px;
          transform: translateX(-50%);
          top: 5px;
          width: 10px;
          height: 10px;
          background-color: #fff;
          border-radius: 50%;
          border: 2px solid currentColor;
          color: var(--primary);
        }

        &::after {
          content: "";
          width: 2px;
          height: calc(100% + 15px);
          position: absolute;
          top: 5px;
          left: -20px;
          background-color: currentColor;
          color: var(--primary);
          z-index: -1;
        }

        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 5px;

          .assignee {
            font-size: 1.3rem;
            color: var(--gray-400);

            &::after {
              content: "-";
              margin-left: 5px;
            }

            @media (max-width: $md) {
              display: none;
            }
          }

          .date {
            font-size: 1.3rem;
            color: var(--gray-400);
            border-radius: 0;
            border: none;
            padding: 0;
            width: fit-content;
            outline: none;
            display: flex;
            flex-direction: row-reverse;
            justify-content: flex-end;
            align-items: flex-end;
            flex-grow: 1;
          }

          input[type="datetime-local"]::-webkit-calendar-picker-indicator {
            // background: none;
            opacity: 0.5;
          }

          .actions {
            display: flex;
            align-items: center;
            gap: 5px;

            > span {
              padding: 5px 0 0 5px;
            }

            .delete_log {
              font-size: 1.6rem;
              cursor: not-allowed;
              color: var(--gray-400);
              transition: color 0.2s ease-out;

              &:hover {
                color: var(--text);
              }
            }

            .edit_log {
              font-size: 1.6rem;
              cursor: pointer;
              color: var(--gray-400);
              transition: color 0.2s ease-out;

              &:hover {
                color: var(--text);
              }
            }
          }
        }

        .content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          background: var(--background);
          padding: 12px 15px;
          border-radius: 5px;
          border: 1px solid var(--border);
          font-size: 1.4rem;
          order: var(--index, 0);
          transition:
            transform 0.2s ease-out,
            border-color 0.2s ease-out;

          &:has(.title[contenteditable="true"]) {
            border-color: var(--gray-400) er;
          }

          input {
            width: 16px;
            height: 16px;
            flex-shrink: 0;

            &:checked + .title {
              text-decoration: line-through;
            }
          }

          .title {
            flex-grow: 1;
            outline: 0;
            line-height: 1.3;
            min-height: 1.3em;
            display: inline-block;
          }
        }

        &[data-user] {
          padding-top: 5px;

          &::before {
            background-image: var(--user_img);
            background-repeat: no-repeat;
            background-size: cover;
            background-position: center;
            width: 18px;
            height: 18px;
            // border-width: 1px;
          }
        }
      }
    }

    #task_steps {
      border: none;
      outline: none;
      border-bottom: 1px solid #dee0e5;
      border-radius: 0;
      padding-inline: 0;
      width: 100%;
    }
  }
</style>
