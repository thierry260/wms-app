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
  } from "firebase/firestore";
  import { writable } from "svelte/store";
  import { Clock } from "phosphor-svelte";

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
    const fileRefs = new Map();

    statuses.forEach((status) => {
      categorizedTasks[status.id] = [];
    });

    // Process tasks and collect file references
    taskSnapshots.docs.forEach((doc) => {
      const taskData = { id: doc.id, ...doc.data() };
      const taskStatusId = taskData.status_id;
      const fileId = taskData.file_id;

      if (categorizedTasks[taskStatusId]) {
        categorizedTasks[taskStatusId].push(taskData);
      } else {
        console.warn(`Unknown task status ID: ${taskStatusId}`);
      }

      // Collect file references
      if (fileId) {
        fileRefs.set(fileId, doc.id); // Use task ID as a placeholder for file reference
      }
    });

    // Fetch file data
    const fileDocs = await Promise.all(
      Array.from(fileRefs.keys()).map((fileId) =>
        getDoc(
          doc(
            db,
            "workspaces",
            localStorage.getItem("workspace"),
            "files",
            fileId
          )
        )
      )
    );

    // Map file data to file IDs
    const fileDataMap = new Map();
    fileDocs.forEach((fileDoc) => {
      if (fileDoc.exists()) {
        fileDataMap.set(fileDoc.id, fileDoc.data());
      }
    });

    // Combine task and file data
    Object.keys(categorizedTasks).forEach((statusId) => {
      categorizedTasks[statusId] = categorizedTasks[statusId].map((task) => ({
        ...task,
        fileData: fileDataMap.get(task.file_id) || null,
      }));
    });

    tasks.set(categorizedTasks);

    console.log(categorizedTasks);
  }

  async function updateTaskStatus(taskId, newStatusId) {
    const taskRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "tasks",
      taskId
    );
    await setDoc(taskRef, { status_id: newStatusId }, { merge: true });
  }

  function setupSortable() {
    // Set up task sorting within columns
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
                await updateTaskStatus(taskId, newStatusId);
              }
            },
          });
        });

      // Set up column sorting
      Sortable.create(document.querySelector(".kanban-board"), {
        group: "taskColumn",
        animation: 250,
        onEnd: async function (evt) {
          const newOrder = Array.from(evt.from.children).map(
            (child) => child.dataset.id
          );
          const workspaceRef = doc(
            db,
            "workspaces",
            localStorage.getItem("workspace")
          );
          const workspaceSnap = await getDoc(workspaceRef);
          const workspaceData = workspaceSnap.data();

          // Update column order in the workspace document
          await updateDoc(workspaceRef, {
            taskStatuses: newOrder.map((id) =>
              workspaceData.taskStatuses.find((status) => status.id === id)
            ),
          });
        },
      });
    });
  }

  onMount(async () => {
    await fetchTasks();
    setupSortable();
  });
  // Utility functions
  function formatDate(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  function getDeadlineStatus(deadline) {
    if (!deadline) return "";
    const now = new Date();
    const deadlineDate = deadline.toDate();
    deadlineDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    if (now > deadlineDate) return "overdue";
    if (now.getTime() === deadlineDate.getTime()) return "today";
    return "";
  }
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
              <li
                class="kanban-task {getDeadlineStatus(task.deadline)}"
                data-id={task.id}
              >
                <div class="top"></div>
                <span class="subtitle"
                  >{task.fileData ? task.fileData.name : ""}</span
                >
                <h4>{task.title}</h4>
                <p>{task.description}</p>
                {#if task.deadline}
                  <div class="task-deadline">
                    <Clock size="18" />{formatDate(task.deadline)}
                  </div>
                {/if}
              </li>
            {/each}
          {/if}
        </ul>
        <button class="kanban-task-add basic" data-status={status.id}>
          + Taak toevoegen
        </button>
      </div>
    {/each}
  {/if}
</div>

<style lang="scss">
  .kanban-board {
    --container: 1520px;
    display: flex;
    justify-content: space-between;
    outline: none;

    flex-grow: 1;
    flex-basis: 0;
    display: flex;
    align-items: start;
    overflow-x: auto;
    overflow-y: hidden;
    margin-inline: -60px;
    margin-bottom: -60px;
    width: calc(100% + 120px);
    padding-inline: max(50px, (100% - var(--container) + 100px) / 2);
    padding-inline: max(50px, (100% - var(--container)) / 2);
    padding-bottom: 40px;
    // max-width: 100%;
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
    min-height: 100px;
    list-style: none;
    padding: 0;
    flex-grow: 1;
  }

  .kanban-task {
    background-color: #fff;
    border-radius: 4px;
    padding: 15px;
    margin-bottom: 8px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

    .task-deadline {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 5px;
      color: #fff;
      border-radius: 5px;
      font-size: 13px;
    }

    &.today .task-deadline {
      background-color: $warning;
      color: #fff;
    }
    &.overdue .task-deadline {
      background-color: $error;
      color: #fff;
    }

    .subtitle {
      text-transform: uppercase;
      opacity: 0.6;
      font-size: 1.4rem;
      margin-bottom: 0.5em;
      display: block;
      &:empty {
        display: none;
      }
    }
    h4 {
      font-size: 1.8rem;
    }
  }
</style>
