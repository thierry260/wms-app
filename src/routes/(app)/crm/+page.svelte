<script>
    import { db } from "$lib/firebase"; // Import your Firebase instance
    import { collection, addDoc, Timestamp } from "firebase/firestore"; // Import Firestore functions
    import { writable } from "svelte/store";

    let name = "";
    let address = "";
    let date_of_birth = "";
    let email = "";
    let phone_number = "";

    let submitting = writable(false);
    let errorMessage = writable("");
    let successMessage = writable("");

    async function handleSubmit() {
        // Ensure all required fields are filled out
        if (!name || !address || !date_of_birth || !email || !phone_number) {
            errorMessage.set("Please fill out all fields.");
            return;
        }

        submitting.set(true);
        errorMessage.set("");
        successMessage.set("");

        try {
            // Convert date_of_birth to a Firestore Timestamp
            const dobTimestamp = Timestamp.fromDate(new Date(date_of_birth));

            // Reference to the clients collection
            const clientsRef = collection(
                db,
                "workspaces",
                localStorage.getItem("workspace"),
                "clients",
            );

            // Add a new document with the client data
            await addDoc(clientsRef, {
                name,
                address,
                date_of_birth: dobTimestamp,
                email,
                phone_number,
            });

            successMessage.set("Client successfully added!");
            resetForm();
        } catch (error) {
            console.error("Error adding client: ", error);
            errorMessage.set("There was an error adding the client.");
        } finally {
            submitting.set(false);
        }
    }

    function resetForm() {
        name = "";
        address = "";
        date_of_birth = "";
        email = "";
        phone_number = "";
    }
</script>

<main>
    <h1>Add Client</h1>

    {#if $errorMessage}
        <p style="color: red;">{$errorMessage}</p>
    {/if}

    {#if $successMessage}
        <p style="color: green;">{$successMessage}</p>
    {/if}

    <form on:submit|preventDefault={handleSubmit}>
        <label>
            Name:
            <input type="text" bind:value={name} placeholder="Client Name" />
        </label>

        <label>
            Address:
            <input
                type="text"
                bind:value={address}
                placeholder="Client Address"
            />
        </label>

        <label>
            Date of Birth:
            <input type="date" bind:value={date_of_birth} />
        </label>

        <label>
            Email:
            <input type="email" bind:value={email} placeholder="Client Email" />
        </label>

        <label>
            Phone Number:
            <input
                type="tel"
                bind:value={phone_number}
                placeholder="Client Phone Number"
            />
        </label>

        <button type="submit" disabled={$submitting}>Add Client</button>
    </form>
</main>

<style>
    main {
        padding: 1rem;
    }
    form {
        display: flex;
        flex-direction: column;
    }
    label {
        margin-bottom: 1rem;
    }
    input {
        margin-top: 0.5rem;
        padding: 0.5rem;
        font-size: 1rem;
    }
    button {
        padding: 0.5rem;
        font-size: 1rem;
    }
</style>
