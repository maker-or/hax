"use client";

import { useAction } from "convex/react";
import {
	AlertTriangle,
	Check,
	Copy,
	Eye,
	EyeOff,
	Key,
	Plus,
	Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { cx, press } from "../../_classes";

export interface SecretMeta {
	id: string;
	name: string;
	lastFour: string;
	createdAt: string;
}

/**
 * This is the full secret payload we get back from WorkOS right after creation.
 * The secret value is returned once, so the UI keeps it only in local state.
 */
interface NewSecretInfo {
	secretId: string;
	secret: string;
	lastFour: string;
	name: string;
	createdAt: string;
}

/** This function writes verbose browser logs for the client secret UI flow. */
function logClientSecretUi(
	step: string,
	payload: Record<string, unknown>,
): void {
	console.log(`[console-ui][client-secrets] ${step}`, payload);
}

export function ClientSecretsSection({
	appId,
	isAdmin,
}: {
	appId: Id<"consoleApp">;
	isAdmin: boolean;
}) {
	const listClientSecrets = useAction(api.console.listClientSecrets);
	const createClientSecret = useAction(api.console.createClientSecret);
	const revokeClientSecret = useAction(api.console.revokeClientSecret);
	const [secrets, setSecrets] = useState<SecretMeta[] | null>(null);
	const [newSecret, setNewSecret] = useState<NewSecretInfo | null>(null);
	const [showNewSecret, setShowNewSecret] = useState(false);
	const [newSecretName, setNewSecretName] = useState("");
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [copied, setCopied] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoadingSecrets, setIsLoadingSecrets] = useState(true);
	const [isCreating, setIsCreating] = useState(false);
	const [revokingSecretId, setRevokingSecretId] = useState<string | null>(null);
	const isMountedRef = useRef(true);
	const copyResetTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		isMountedRef.current = true;
		logClientSecretUi("component_context", {
			appId,
			isAdmin,
		});
	}, [appId, isAdmin]);

	useEffect(() => {
		logClientSecretUi("component_mounted", {
			component: "ClientSecretsSection",
		});
		return () => {
			logClientSecretUi("component_unmounted", {
				component: "ClientSecretsSection",
			});
			isMountedRef.current = false;
			if (copyResetTimeoutRef.current !== null) {
				window.clearTimeout(copyResetTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		let cancelled = false;

		/**
		 * This function loads the current client secret metadata from WorkOS.
		 */
		const loadSecrets = async () => {
			logClientSecretUi("list_start", {
				appId,
			});
			setIsLoadingSecrets(true);
			try {
				const nextSecrets = await listClientSecrets({ appId });
				logClientSecretUi("list_success", {
					appId,
					count: nextSecrets.length,
					secretIds: nextSecrets.map((secret) => secret.id),
				});
				if (cancelled || !isMountedRef.current) return;
				setSecrets(nextSecrets);
			} catch (loadError) {
				logClientSecretUi("list_error", {
					appId,
					error:
						loadError instanceof Error
							? {
									name: loadError.name,
									message: loadError.message,
									stack: loadError.stack,
								}
							: loadError,
				});
				if (cancelled || !isMountedRef.current) return;
				setError(
					loadError instanceof Error
						? loadError.message
						: "Failed to load client secrets.",
				);
				setSecrets([]);
			} finally {
				logClientSecretUi("list_finally", {
					appId,
					cancelled,
					isMounted: isMountedRef.current,
				});
				if (!cancelled && isMountedRef.current) {
					setIsLoadingSecrets(false);
				}
			}
		};

		void loadSecrets();

		return () => {
			cancelled = true;
		};
	}, [appId, listClientSecrets]);

	const copyToClipboard = (text: string, key: string) => {
		navigator.clipboard.writeText(text);
		setCopied(key);
		if (copyResetTimeoutRef.current !== null) {
			window.clearTimeout(copyResetTimeoutRef.current);
		}
		copyResetTimeoutRef.current = window.setTimeout(() => {
			if (isMountedRef.current) setCopied(null);
		}, 2000);
	};

	/**
	 * This function creates a client secret in WorkOS and shows the one-time secret value.
	 */
	const handleCreateSecret = async () => {
		const trimmed = newSecretName.trim();
		logClientSecretUi("create_click", {
			appId,
			requestedName: trimmed,
			isCreatingBefore: isCreating,
		});
		if (!trimmed) {
			logClientSecretUi("create_blocked_empty_name", {
				appId,
			});
			setError("Secret name is required.");
			return;
		}
		setError(null);
		setIsCreating(true);
		logClientSecretUi("create_request_start", {
			appId,
			requestedName: trimmed,
		});
		try {
			const created = await createClientSecret({
				appId,
				name: trimmed,
			});
			logClientSecretUi("create_request_success", {
				appId,
				secretId: created.secretId,
				name: created.name,
				lastFour: created.lastFour,
				createdAt: created.createdAt,
				secretLength: created.secret.length,
			});
			if (!isMountedRef.current) return;
			setSecrets((prev) => {
				const current = prev ?? [];
				const nextRow: SecretMeta = {
					id: created.secretId,
					name: created.name,
					lastFour: created.lastFour,
					createdAt: created.createdAt,
				};
				return [
					nextRow,
					...current.filter((secret) => secret.id !== nextRow.id),
				];
			});
			setNewSecret({
				secretId: created.secretId,
				secret: created.secret,
				lastFour: created.lastFour,
				name: created.name,
				createdAt: created.createdAt,
			});
			setShowNewSecret(true);
			setNewSecretName("");
			setShowCreateForm(false);
			logClientSecretUi("create_state_updated", {
				appId,
				secretId: created.secretId,
				showNewSecret: true,
			});
		} catch (createError) {
			logClientSecretUi("create_request_error", {
				appId,
				error:
					createError instanceof Error
						? {
								name: createError.name,
								message: createError.message,
								stack: createError.stack,
							}
						: createError,
			});
			if (!isMountedRef.current) return;
			setError(
				createError instanceof Error
					? createError.message
					: "Failed to create client secret.",
			);
		} finally {
			logClientSecretUi("create_request_finally", {
				appId,
				isMounted: isMountedRef.current,
			});
			if (isMountedRef.current) setIsCreating(false);
		}
	};

	/**
	 * This function revokes a client secret in WorkOS by using the WorkOS secret id.
	 */
	const handleRevoke = async (secretId: string) => {
		logClientSecretUi("revoke_click", {
			appId,
			secretId,
		});
		setError(null);
		setRevokingSecretId(secretId);
		try {
			await revokeClientSecret({ appId, secretId });
			logClientSecretUi("revoke_success", {
				appId,
				secretId,
			});
			if (isMountedRef.current) {
				setSecrets((prev) =>
					(prev ?? []).filter((secret) => secret.id !== secretId),
				);
			}
			if (isMountedRef.current && newSecret?.secretId === secretId) {
				setNewSecret(null);
			}
		} catch (revokeError) {
			logClientSecretUi("revoke_error", {
				appId,
				secretId,
				error:
					revokeError instanceof Error
						? {
								name: revokeError.name,
								message: revokeError.message,
								stack: revokeError.stack,
							}
						: revokeError,
			});
			if (!isMountedRef.current) return;
			setError(
				revokeError instanceof Error
					? revokeError.message
					: "Failed to revoke client secret.",
			);
		} finally {
			logClientSecretUi("revoke_finally", {
				appId,
				secretId,
				isMounted: isMountedRef.current,
			});
			if (isMountedRef.current) setRevokingSecretId(null);
		}
	};

	return (
		<section id="client-secrets" className="scroll-mt-8">
			<p className="mb-4 text-xs leading-relaxed text-muted-foreground">
				Client secrets are private — never expose them in client-side code. Each
				secret is shown once when created; store it in a secrets manager.
			</p>

			{newSecret && (
				<div className="animate-client-secret-reveal mb-8 rounded-none border border-border/60 bg-card/40 p-5 shadow-sm">
					<div className="mb-4 flex items-start gap-2">
						<Key className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
						<div>
							<p className="mb-0.5 text-sm font-semibold text-foreground">
								Copy this secret now — it won&apos;t be shown again
							</p>
							<p className="text-xs text-muted-foreground">
								Store it somewhere safe like a password manager or secrets
								vault.
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<div className="flex flex-1 items-center overflow-hidden rounded-none border border-border/60 bg-muted/40">
							<code className="flex-1 break-all px-3 py-2.5 font-mono text-xs text-foreground select-all">
								{showNewSecret
									? newSecret.secret
									: "•".repeat(Math.min(64, newSecret.secret.length))}
							</code>
							<button
								type="button"
								onClick={() => setShowNewSecret((v) => !v)}
								className={`px-2 text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground ${press}`}
							>
								{showNewSecret ? (
									<EyeOff className="size-4" />
								) : (
									<Eye className="size-4" />
								)}
							</button>
						</div>
						<button
							type="button"
							onClick={() => copyToClipboard(newSecret.secret, "new-secret")}
							className={cx.iconCopyBtn}
						>
							{copied === "new-secret" ? (
								<Check className="size-4 text-emerald-500" />
							) : (
								<Copy className="size-4 text-muted-foreground" />
							)}
						</button>
					</div>
					<button
						type="button"
						onClick={() => setNewSecret(null)}
						className={`mt-3 font-medium ${cx.textAction}`}
					>
						I&apos;ve saved my secret, dismiss this
					</button>
				</div>
			)}

			<div className="mb-3 flex items-center justify-between gap-2">
				<h2 className="text-sm font-semibold text-foreground">
					Client secrets
				</h2>
				{isAdmin && !showCreateForm && (
					<button
						type="button"
						onClick={() => {
							setShowCreateForm(true);
							setError(null);
						}}
						className={cx.ghostBtnPrimary}
					>
						<Plus className="size-4" />
						New secret
					</button>
				)}
			</div>

			{isAdmin && showCreateForm && (
				<div className="mb-4 space-y-3 rounded-none border border-border/60 bg-card/50 p-4 shadow-sm">
					<p className="text-xs leading-relaxed text-muted-foreground">
						Give this secret a name to identify it later (e.g.{" "}
						<code className="rounded-none bg-muted px-1.5 py-0.5 font-mono text-foreground">
							production
						</code>
						,{" "}
						<code className="rounded-none bg-muted px-1.5 py-0.5 font-mono text-foreground">
							staging
						</code>
						).
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<input
							type="text"
							value={newSecretName}
							onChange={(e) => {
								setNewSecretName(e.target.value);
								if (error) setError(null);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCreateSecret();
								if (e.key === "Escape") setShowCreateForm(false);
							}}
							placeholder="e.g. production"
							className={`${cx.input} min-w-[12rem] flex-1`}
						/>
						<button
							type="button"
							onClick={handleCreateSecret}
							disabled={!newSecretName.trim() || isCreating}
							className={`${cx.primaryBtn} disabled:active:scale-100`}
						>
							<Plus className="size-4" />
							{isCreating ? "Creating..." : "Create"}
						</button>
						<button
							type="button"
							onClick={() => setShowCreateForm(false)}
							disabled={isCreating}
							className={`${cx.ghostBtn} px-3 py-2`}
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{error && (
				<div className={`${cx.alertError} mb-3`}>
					<AlertTriangle className="mt-0.5 size-4 shrink-0" />
					<p>{error}</p>
				</div>
			)}

			{isLoadingSecrets ? (
				<div className="flex flex-col gap-2">
					{[0, 1].map((item) => (
						<div
							key={item}
							className="h-16 animate-pulse rounded-none border border-border/60 bg-muted/30"
						/>
					))}
				</div>
			) : (secrets ?? []).length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-none border border-dashed border-border/70 bg-muted/20 py-12 text-center">
					<p className="text-sm text-muted-foreground">
						No client secrets yet.
					</p>
					<p className="mt-1 text-xs text-muted-foreground/80">
						{isAdmin
							? "Create one to authenticate your OAuth app."
							: "Ask an org admin to create a client secret."}
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{(secrets ?? []).map((secret) => (
						<div
							key={secret.id}
							className="flex items-center justify-between rounded-none border border-border/60 bg-card/40 px-4 py-3.5 shadow-sm transition-colors duration-150 ease-out hover:bg-muted/15"
						>
							<div className="min-w-0">
								<p className="mb-0.5 text-sm font-semibold text-foreground">
									{secret.name}
								</p>
								<p className="font-mono text-[11px] text-muted-foreground">
									…{secret.lastFour} · Created{" "}
									{new Date(secret.createdAt).toLocaleDateString("en-US", {
										year: "numeric",
										month: "short",
										day: "numeric",
									})}
								</p>
							</div>
							{isAdmin && (
								<button
									type="button"
									onClick={() => handleRevoke(secret.id)}
									disabled={revokingSecretId === secret.id}
									className={cx.revokeBtn}
								>
									<Trash2 className="size-3.5" />
									{revokingSecretId === secret.id ? "Revoking..." : "Revoke"}
								</button>
							)}
						</div>
					))}
				</div>
			)}
		</section>
	);
}
