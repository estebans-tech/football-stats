// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Role, Profile, UserSummary } from '$lib/types/auth';
import { SUPPORTED_LOCALES } from '$lib/i18n/types';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface Locals {
			user?: UserSummary;         // { id, email } | null
			role?: Role;                // 'anon' | 'editor' | 'admin' | 'viewer'
			canEdit?: boolean;
			profile?: Profile;          // full profile | null
			locale?: SUPPORTED_LOCALES;          // full profile | null
		}
		interface PageData {
			user?: UserSummary;
			role?: Role;
			canEdit?: boolean;
			profile?: Profile;          // full profile | null
			// lägg till profile här bara om du faktiskt skickar ut det till klienten
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
