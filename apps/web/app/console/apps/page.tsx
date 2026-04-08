"use client";

import { Authenticated, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { cx } from "../_classes";
import { GsapPressLink } from "../gsap-press-link";

export default function AppsPage() {
	return (
		<Authenticated>
			<AppsList />
		</Authenticated>
	);
}

function AppsList() {
	const apps = useQuery(api.console.listApps, {});

	return (
		<div className={cx.page}>
			<div className="flex min-h-0 flex-1 flex-col">
				<main className="flex-1 px-8 pt-10 pb-10">
					<div className="w-full">
						<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="min-w-0">
								<h1 className={cx.title}>OAuth applications</h1>
								<p className="mt-1 text-sm text-muted-foreground">
									Create and manage apps that connect to your gateway.
								</p>
							</div>
							<GsapPressLink
								href="/console/apps/new"
								className={`${cx.headerCta} shrink-0 cursor-pointer`}
								scale={0.97}
							>
								<Plus className="size-4" />
								New app
							</GsapPressLink>
						</div>

						{apps === undefined && (
							<div className="space-y-3">
								{[0, 1, 2].map((i) => (
									<div
										key={i}
										className="h-16 animate-pulse rounded-none bg-muted/40"
									/>
								))}
							</div>
						)}

						{apps !== undefined && apps.length === 0 && (
							<div className="rounded-none border border-dashed border-border/70 bg-card/40 px-8 py-14 text-center shadow-sm">
								<p className="mb-4 text-sm text-muted-foreground">
									No apps yet. Create one to get started.
								</p>
								<GsapPressLink
									href="/console/apps/new"
									className={`${cx.primaryBtnCompact} cursor-pointer`}
									scale={0.97}
								>
									<Plus className="size-4" />
									Create your first app
								</GsapPressLink>
							</div>
						)}

						{apps !== undefined && apps.length > 0 && (
							<div className="flex flex-col gap-3">
								{apps.map((app) => (
									<GsapPressLink
										key={app._id}
										href={`/console/apps/${app._id}`}
										className={`${cx.listRowLink} cursor-pointer`}
										scale={0.99}
									>
										<div className="min-w-0">
											<div className="mb-0.5 flex items-center gap-2">
												<span className="truncate text-sm font-semibold text-foreground">
													{app.name}
												</span>
											</div>
											{app.domains.length > 0 && (
												<p className="truncate text-xs text-muted-foreground">
													{app.domains.join(" · ")}
												</p>
											)}
											<p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/80">
												{app.workosClientId}
											</p>
										</div>
									</GsapPressLink>
								))}
							</div>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
