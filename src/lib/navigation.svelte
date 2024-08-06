<script>
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { SignOut } from 'phosphor-svelte';

	let isAuthenticated = writable(false);

	onMount(async () => {
		const authResponse = await fetch('http://localhost:3000/auth/status');
		const authData = await authResponse.json();
		isAuthenticated.set(authData.loggedIn);
	});

	function handleLogin() {
		window.location.href = 'http://localhost:3000/auth/google';
	}

	function handleLogout() {
		window.location.href = 'http://localhost:3000/logout';
	}
</script>

<header>
	<h1>WMS</h1>
	{#if $isAuthenticated}
		<button class="logout" on:click={handleLogout}><SignOut size={24}  /></button>
	{:else}
		<button class="login" on:click={handleLogin}>Login</button>
	{/if}
</header>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 20px;
		background-color: #fff;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
		margin-bottom: 20px;
	}

	h1 {
		font-size: 1.8rem;
		font-weight: 600;
		color: var(--primary);
		margin: 0;
	}

	.logout,
	.login {
		font-size: 1.6rem;
		color: var(--text);
		cursor: pointer;
		background: none;
		border: none;
		transition: color 0.3s ease;
	}

	button.logout {
		padding-inline: 0;
	}

	.logout:hover,
	.login:hover {
		color: var(--primary);
	}
</style>
