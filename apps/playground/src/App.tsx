import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import {
	type AgentTimelineItem,
	DEFAULT_HISTORY_JSON,
	DEFAULT_PROMPT,
	DEFAULT_SYSTEM_PROMPT,
	type FinalResponse,
	type PlaygroundApprovalDecision,
	type PlaygroundApprovalRequest,
	getPlaygroundConfig,
	getPlaygroundRequestPreview,
	maskToken,
	runPlaygroundRequest,
	stringifyJson,
} from "./lib/playground-client";
import "./styles.css";

type RunMode = "stream" | "batch" | null;

/**
 * This formats file sizes for the compact attachment list.
 */
function formatFileSize(size: number): string {
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * This turns thrown values into readable error text for the UI.
 */
function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		const parts = [error.name, error.message, error.stack];
		if (error.cause instanceof Error) {
			parts.push(`Cause: ${error.cause.name}: ${error.cause.message}`);
			if (error.cause.stack) parts.push(error.cause.stack);
		}
		return parts
			.filter(
				(part): part is string =>
					typeof part === "string" && part.trim().length > 0,
			)
			.join("\n\n");
	}
	if (typeof error === "string") return error;
	if (error && typeof error === "object") return JSON.stringify(error, null, 2);
	return "Request failed.";
}

/**
 * This picks a short icon label for each timeline step (agent-style trace).
 */
function activityGlyph(kind: AgentTimelineItem["kind"]): string {
	switch (kind) {
		case "run":
			return "◆";
		case "model":
			return "◇";
		case "tool-call":
			return "▸";
		case "approval":
			return "!";
		case "tool-result":
			return "✓";
		case "final":
			return "●";
		default:
			return "·";
	}
}

/**
 * This returns structured payload text for expandable timeline rows.
 */
function getTimelinePayload(event: AgentTimelineItem): string | null {
	switch (event.kind) {
		case "tool-call":
			return stringifyJson(event.input);
		case "approval":
			return stringifyJson(event.input);
		case "tool-result":
			return stringifyJson(event.output);
		default:
			return null;
	}
}

/** Subtle loading dots for in-flight runs. */
function LoadingDots() {
	return (
		<span className="loading-dots" aria-hidden>
			<span className="loading-dot" />
			<span className="loading-dot" />
			<span className="loading-dot" />
		</span>
	);
}

function App() {
	const { baseUrl, accessToken, clientId, envError } = getPlaygroundConfig();

	const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
	const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
	const [historyJson, setHistoryJson] = useState(DEFAULT_HISTORY_JSON);
	const [appendPromptAsUserMessage, setAppendPromptAsUserMessage] =
		useState(true);
	const [files, setFiles] = useState<File[]>([]);
	const [runMode, setRunMode] = useState<RunMode>(null);
	const [output, setOutput] = useState("");
	const [error, setError] = useState("");
	const [timeline, setTimeline] = useState<AgentTimelineItem[]>([]);
	const [pendingApproval, setPendingApproval] =
		useState<PlaygroundApprovalRequest | null>(null);
	const [finalResponse, setFinalResponse] = useState<FinalResponse | null>(
		null,
	);

	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const approvalResolverRef = useRef<
		((decision: PlaygroundApprovalDecision) => void) | null
	>(null);

	const requestPreview = getPlaygroundRequestPreview({
		systemPrompt,
		prompt,
		files,
		historyJson,
		appendPromptAsUserMessage,
	});

	const finalJson = finalResponse ? stringifyJson(finalResponse) : "";
	const isLoading = runMode !== null;
	const canSubmit = !isLoading && !envError;

	const handleTimelineEvent = (event: AgentTimelineItem) => {
		setTimeline((current) => [...current, event]);
	};

	const handleApprovalRequest = async (
		request: PlaygroundApprovalRequest,
	): Promise<PlaygroundApprovalDecision> =>
		new Promise((resolve) => {
			setPendingApproval(request);
			approvalResolverRef.current = (decision) => {
				setPendingApproval(null);
				approvalResolverRef.current = null;
				resolve(decision);
			};
		});

	const resolvePendingApproval = (decision: PlaygroundApprovalDecision) => {
		approvalResolverRef.current?.(decision);
	};

	const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
		const nextFiles = Array.from(event.target.files ?? []);
		setFiles((current) => {
			const seen = new Set(
				current.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
			);
			const uniqueFiles = nextFiles.filter((file) => {
				const key = `${file.name}:${file.size}:${file.lastModified}`;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
			return [...current, ...uniqueFiles];
		});
		event.target.value = "";
	};

	const removeFile = (indexToRemove: number) => {
		setFiles((current) =>
			current.filter((_, currentIndex) => currentIndex !== indexToRemove),
		);
	};

	const runRequest = async (stream: boolean) => {
		setRunMode(stream ? "stream" : "batch");
		setOutput("");
		setError("");
		setTimeline([]);
		setPendingApproval(null);
		setFinalResponse(null);

		try {
			const result = await runPlaygroundRequest({
				systemPrompt,
				prompt,
				stream,
				files,
				historyJson,
				appendPromptAsUserMessage,
				onTextDelta: (delta: string) => {
					setOutput((current) => current + delta);
				},
				onTimelineEvent: handleTimelineEvent,
				requestApproval: handleApprovalRequest,
			});

			setFinalResponse(result.finalResponse);
			setOutput(result.output);
		} catch (caughtError) {
			setError(getErrorMessage(caughtError));
		} finally {
			setRunMode(null);
		}
	};

	const statusLabel =
		runMode === "stream"
			? "Streaming"
			: runMode === "batch"
				? "Running"
				: "Ready";

	return (
		<div className="agent-app">
			<header className="agent-top">
				<div className="agent-brand">
					<span className="agent-title">Playground</span>
					<span
						className={`agent-status${isLoading ? " agent-status-busy" : ""}`}
						aria-live="polite"
					>
						<span className="agent-status-dot" />
						{statusLabel}
					</span>
				</div>
				<details className="agent-connection">
					<summary>Connection</summary>
					<dl className="agent-connection-grid">
						<dt>Base</dt>
						<dd>{baseUrl || "—"}</dd>
						<dt>Token</dt>
						<dd>{accessToken ? maskToken(accessToken) : "—"}</dd>
						<dt>Client</dt>
						<dd>{clientId ? maskToken(clientId) : "—"}</dd>
					</dl>
				</details>
			</header>

			{envError ? (
				<div className="agent-banner agent-banner-warn">{envError}</div>
			) : null}
			{error ? (
				<div className="agent-banner agent-banner-err">{error}</div>
			) : null}

			<main className="agent-main">
				<section
					className="agent-transcript"
					aria-label="Agent response"
					aria-busy={isLoading}
				>
					<div
						className={`agent-output${!output && !isLoading ? " agent-output-empty" : ""}`}
						role="log"
						aria-live="polite"
						aria-relevant="additions"
					>
						{output ||
							(isLoading ? "…" : "Run the agent to see the reply here.")}
					</div>

					{timeline.length > 0 ? (
						<div className="agent-activity" aria-label="Run activity">
							{timeline.map((event) => {
								const payload = getTimelinePayload(event);
								return (
									<div
										key={event.id}
										className={`agent-step agent-step-${event.kind}`}
									>
										<span className="agent-step-glyph" aria-hidden>
											{activityGlyph(event.kind)}
										</span>
										<div className="agent-step-body">
											<div className="agent-step-title">{event.title}</div>
											{event.detail ? (
												<div className="agent-step-detail">{event.detail}</div>
											) : null}
											{payload ? (
												<details className="agent-step-data">
													<summary>Data</summary>
													<pre>{payload}</pre>
												</details>
											) : null}
										</div>
									</div>
								);
							})}
						</div>
					) : null}
				</section>

				<section className="agent-composer" aria-label="Your message">
					<label className="agent-label" htmlFor="user-prompt">
						Message
					</label>
					<textarea
						id="user-prompt"
						className="agent-input agent-input-primary"
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						rows={3}
						placeholder="What should the agent do?"
					/>

					<div className="agent-run-row">
						<button
							type="button"
							className="agent-btn agent-btn-primary"
							onClick={() => void runRequest(true)}
							disabled={!canSubmit}
						>
							{runMode === "stream" ? (
								<>
									Running
									<LoadingDots />
								</>
							) : (
								"Run"
							)}
						</button>
						<button
							type="button"
							className="agent-btn agent-btn-quiet"
							onClick={() => void runRequest(false)}
							disabled={!canSubmit}
						>
							{runMode === "batch" ? (
								<>
									Running
									<LoadingDots />
								</>
							) : (
								"Run (no stream)"
							)}
						</button>
					</div>

					<details className="agent-advanced">
						<summary>Advanced</summary>
						<div className="agent-advanced-inner">
							<label className="agent-label" htmlFor="system-prompt">
								System
							</label>
							<textarea
								id="system-prompt"
								className="agent-input"
								value={systemPrompt}
								onChange={(e) => setSystemPrompt(e.target.value)}
								rows={4}
							/>

							<label className="agent-check">
								<input
									type="checkbox"
									checked={appendPromptAsUserMessage}
									onChange={(e) =>
										setAppendPromptAsUserMessage(e.target.checked)
									}
								/>
								Append message as last user turn
							</label>

							<div className="agent-files">
								<div className="agent-files-row">
									<span className="agent-label">Attachments</span>
									<button
										type="button"
										className="agent-btn-text"
										onClick={() => fileInputRef.current?.click()}
										disabled={isLoading}
									>
										Add files
									</button>
									{files.length > 0 ? (
										<button
											type="button"
											className="agent-btn-text"
											onClick={() => setFiles([])}
											disabled={isLoading}
										>
											Clear
										</button>
									) : null}
								</div>
								<input
									ref={fileInputRef}
									type="file"
									multiple
									onChange={handleFileSelection}
									className="agent-file-input"
								/>
								{files.length === 0 ? (
									<p className="agent-hint">None</p>
								) : (
									<ul className="agent-file-list">
										{files.map((file, index) => (
											<li
												key={`${file.name}:${file.size}:${file.lastModified}`}
											>
												<span>{file.name}</span>
												<span className="agent-hint">
													{formatFileSize(file.size)}
												</span>
												<button
													type="button"
													className="agent-btn-text"
													onClick={() => removeFile(index)}
													disabled={isLoading}
												>
													Remove
												</button>
											</li>
										))}
									</ul>
								)}
							</div>

							<label className="agent-label" htmlFor="history-json">
								History JSON
							</label>
							<div className="agent-history-actions">
								<button
									type="button"
									className="agent-btn-text"
									onClick={() => setHistoryJson("[]")}
									disabled={isLoading}
								>
									Empty
								</button>
								<button
									type="button"
									className="agent-btn-text"
									onClick={() => setHistoryJson(DEFAULT_HISTORY_JSON)}
									disabled={isLoading}
								>
									Reset
								</button>
							</div>
							<textarea
								id="history-json"
								className="agent-input agent-input-mono"
								value={historyJson}
								onChange={(e) => setHistoryJson(e.target.value)}
								spellCheck={false}
								rows={6}
							/>

							<details className="agent-debug">
								<summary>Request preview</summary>
								<pre className="agent-pre">{requestPreview}</pre>
							</details>
							<details className="agent-debug">
								<summary>Last response JSON</summary>
								<pre className="agent-pre">{finalJson || "—"}</pre>
							</details>
						</div>
					</details>
				</section>
			</main>

			{pendingApproval ? (
				<dialog className="agent-approval" open>
					<div className="agent-approval-card">
						<p className="agent-approval-lead">
							Allow <strong>{pendingApproval.toolName}</strong>?
						</p>
						<details className="agent-step-data">
							<summary>Arguments</summary>
							<pre>{stringifyJson(pendingApproval.input)}</pre>
						</details>
						<div className="agent-approval-actions">
							<button
								type="button"
								className="agent-btn agent-btn-primary"
								onClick={() =>
									resolvePendingApproval({
										approved: true,
										reason: "Approved in playground.",
									})
								}
							>
								Allow
							</button>
							<button
								type="button"
								className="agent-btn agent-btn-danger"
								onClick={() =>
									resolvePendingApproval({
										approved: false,
										reason: "Rejected in playground.",
									})
								}
							>
								Deny
							</button>
						</div>
					</div>
				</dialog>
			) : null}
		</div>
	);
}

export default App;
