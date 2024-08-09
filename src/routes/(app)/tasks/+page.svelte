<script>
  import { db } from "$lib/firebase";
  import { onMount } from "svelte";
  import Sortable from "sortablejs";
  import {
    collection,
    getDocs,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    arrayUnion,
  } from "firebase/firestore";
  import { writable } from "svelte/store";

  let taskStatuses = writable([]);
  let tasks = writable({});

  async function fetchTaskStatuses() {
    const workspaceRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace")
    );
    const workspaceSnap = await getDoc(workspaceRef);
    const workspaceData = workspaceSnap.data();

    // Assumes statuses are stored in a field named "taskStatuses" which is an array
    const statuses = workspaceData.taskStatuses || [];
    taskStatuses.set(statuses);
    return statuses;
  }

  async function fetchTasks() {
    const statuses = await fetchTaskStatuses();
    const tasksRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "tasks"
    );
    const taskSnapshots = await getDocs(tasksRef);

    const categorizedTasks = {};
    statuses.forEach((status) => {
      categorizedTasks[status.id] = [];
    });

    taskSnapshots.docs.forEach((doc) => {
      const taskData = { id: doc.id, ...doc.data() };
      const taskStatus = taskData.status;

      const status = statuses.find((status) => status.name === taskStatus);
      if (status) {
        categorizedTasks[status.id].push(taskData);
      } else {
        console.warn(`Unknown task status: ${taskStatus}`);
      }
    });

    tasks.set(categorizedTasks);
  }

  async function updateTaskStatus(taskId, newStatus) {
    const taskRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "tasks",
      taskId
    );
    await setDoc(taskRef, { status: newStatus }, { merge: true });
  }

  function setupSortable() {
    taskStatuses.subscribe((statuses) => {
      document
        .querySelectorAll(".kanban-column-content")
        .forEach((taskColumn) => {
          Sortable.create(taskColumn, {
            group: "taskColumnTasks",
            sort: false,
            animation: 250,
            onEnd: async function (evt) {
              const itemEl = evt.item;
              const oldStatusId = evt.from.closest(".kanban-column").dataset.id;
              const newStatusId = evt.to.closest(".kanban-column").dataset.id;
              const taskId = itemEl.dataset.id;

              if (oldStatusId !== newStatusId) {
                await updateTaskStatus(
                  taskId,
                  statuses.find((status) => status.id === newStatusId).name
                );
              }
            },
          });
        });

      Sortable.create(document.querySelector(".kanban-board"), {
        group: "taskColumn",
        animation: 250,
        onEnd: async function (evt) {
          // Handle column reordering here if needed
        },
      });
    });
  }

  onMount(async () => {
    await fetchTasks();
    setupSortable();
  });
</script>

<div class="kanban-board">
  {#if $taskStatuses.length > 0}
    {#each $taskStatuses as status (status.id)}
      <div class="kanban-column" data-id={status.id}>
        <div class="kanban-column-header">
          <h3>{status.name}</h3>
        </div>
        <ul
          id={status.id}
          class="kanban-column-content"
          data-status={status.id}
        >
          {#if $tasks[status.id]}
            {#each $tasks[status.id] as task (task.id)}
              <li class="kanban-task" data-id={task.id}>
                <h4>{task.title}</h4>
                <p>{task.description}</p>
              </li>
            {/each}
          {/if}
        </ul>
        <button class="kanban-task-add basic" data-status={status.id}>
          + Add Task
        </button>
      </div>
    {/each}
  {/if}
</div>

<style lang="scss">
  .kanban-board {
    display: flex;
    justify-content: space-between;

    flex-grow: 1;
    flex-basis: 0;
    display: flex;
    align-items: start;
    overflow-x: auto;
    overflow-y: hidden;
    margin-inline: auto;
    padding-inline: max(50px, (100% - var(--container) + 100px) / 2);
    padding-inline: max(50px, (100% - var(--container)) / 2);
    padding-bottom: 40px;
    max-width: 100%;
    display: grid;
    grid-auto-columns: 400px;
    grid-auto-flow: column;
    grid-column-gap: 2rem;
    grid-template-rows: minmax(0, 1fr);
    cursor: grab;
  }

  .kanban-column {
    background-color: var(--background);
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;

    .kanban-column-header {
      h3 {
        font-size: 1.8rem;
      }
    }
  }

  .kanban-column-content {
    /* min-height: 100px; */
    list-style: none;
    padding: 0;
    flex-grow: 1;
  }

  .kanban-task {
    background-color: #fff;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
</style>
