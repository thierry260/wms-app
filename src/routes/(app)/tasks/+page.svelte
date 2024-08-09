<script>
  import { db } from "$lib/firebase";
  import { onMount } from "svelte";
  import Sortable from "sortablejs";
  import { collection, getDocs, doc, setDoc } from "firebase/firestore";
  import { writable } from "svelte/store";

  let tasks = writable({
    "To do": [],
    "In progress": [],
    Done: [],
  });

  async function fetchTasks() {
    const tasksRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "tasks"
    );
    const taskSnapshots = await getDocs(tasksRef);
    const categorizedTasks = {
      "To do": [],
      "In progress": [],
      Done: [],
    };

    taskSnapshots.docs.forEach((doc) => {
      const taskData = { id: doc.id, ...doc.data() };

      // Normalize status to match your defined keys
      //   let taskStatus = taskData.status.toLowerCase().replace(" ", "");
      let taskStatus = taskData.status;

      if (categorizedTasks[taskStatus]) {
        categorizedTasks[taskStatus].push(taskData);
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
    // ["todo", "inProgress", "done"].forEach((status) => {
    //   new Sortable(document.getElementById(status), {
    //     group: "tasks",
    //     animation: 150,
    //     onEnd: async (evt) => {
    //       const movedTaskId = evt.item.getAttribute("data-id");
    //       const newStatus = evt.to.getAttribute("data-status");
    //       await updateTaskStatus(movedTaskId, newStatus);
    //     },
    //   });
    // });

    document
      .querySelectorAll(".kanban-column-content")
      ?.forEach((taskColumn) => {
        Sortable.create(taskColumn, {
          group: "taskColumn",
          sort: false,
          animation: 250,
          // handle: ".eg_sales_item_drag",
          // filter: ".eg_sales_item_actions",
          // Element dragging ended
          onEnd: async function (/**Event*/ evt) {
            var itemEl = evt.item; // dragged HTMLElement
            evt.to; // target list
            evt.from; // previous list
            evt.oldIndex; // element's old index within old parent
            evt.newIndex; // element's new index within new parent
            evt.oldDraggableIndex; // element's old index within old parent, only counting draggable elements
            evt.newDraggableIndex; // element's new index within new parent, only counting draggable elements
            evt.clone; // the clone element
            evt.pullMode; // when item is in another sortable: `"clone"` if cloning, `true` if moving

            if (evt.from != evt.to) {
              const oldtaskColumnId = evt.from.closest(".eg_sales_taskColumn")
                .dataset.id;
              const taskColumnId = evt.to.closest(".eg_sales_taskColumn")
                .dataset.id;
              const taskId = itemEl.dataset.sales_id;
              const taskDocRef = doc(
                db,
                "workspaces",
                getLocalUserData().workspace_id,
                "sales",
                "pipelines",
                "standard_pipeline",
                "tasks",
                "active",
                taskId
              );
              const oldDataSnap = await getDoc(taskDocRef);
              const oldData = oldDataSnap.data();

              let newData = {
                taskColumn: taskColumnId,
              };

              let changesMade = {};
              let updateData = {};

              for (let property in oldData) {
                if (
                  newData[property] !== undefined &&
                  oldData[property] !== newData[property]
                ) {
                  changesMade[property] = {
                    old: oldData[property],
                    new: newData[property],
                  };
                  updateData[property] = newData[property]; // Only store the changed fields
                }
              }

              let newEdit = {
                edited_by: document.querySelector(".user_card_name").innerText,
                edited_at: new Date(),
                changes_made: changesMade,
              };

              // Update the fields that were changed
              await updateDoc(taskDocRef, {
                ...updateData,
                edit_history: arrayUnion(newEdit),
              }).catch((err) => {
                console.error(err);
              });
            }
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
  {#each Object.keys($tasks) as status}
    <div class="kanban-column">
      <div class="kanban-column-header">
        <h3>{status}</h3>
      </div>
      <ul id={status} class="kanban-column-content" data-status={status}>
        {#each $tasks[status] as task}
          <li class="kanban-task" data-id={task.id}>
            <h4>{task.title}</h4>
            <p>{task.description}</p>
          </li>
        {/each}
      </ul>
      <button class="kanban-task-add basic" data-status={status}
        >+ Voeg een taak toe</button
      >
    </div>
  {/each}
</div>

<style lang="scss">
  .kanban-board {
    display: flex;
    justify-content: space-between;
  }

  .kanban-column {
    width: 30%;
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
