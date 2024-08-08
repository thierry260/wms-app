export function initGapi() {
	return new Promise((resolve, reject) => {
		if (window.google && window.google.accounts) {
			resolve();
		} else {
			const script = document.createElement('script');
			script.src = 'https://accounts.google.com/gsi/client';
			script.onload = () => {
				if (window.google && window.google.accounts) {
					resolve();
				} else {
					reject(new Error('Google Identity Services library failed to load'));
				}
			};
			script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
			document.head.appendChild(script);
		}
	});
}

export function signIn() {
	return new Promise((resolve, reject) => {
		const client = window.google.accounts.id;
		client.initialize({
			client_id: import.meta.env.VITE_CLIENT_ID,
			callback: (response) => {
				if (response.credential) {
					resolve(response.credential);
				} else {
					reject(new Error('Sign-in failed or user cancelled'));
				}
			}
		});
		client.prompt();
	});
}

export function signOut() {
	return new Promise((resolve) => {
		const client = window.google.accounts.id;
		client.revoke(
			window.google.accounts.id.getAuthInstance().currentUser.get().getAuthResponse().access_token,
			() => {
				resolve();
			}
		);
	});
}
