import { DodoPayments } from "@dodopayments/convex";
export declare const dodo: DodoPayments;
export declare const checkout: (ctx: {
    runAction: import("convex/server", { with: { "resolution-mode": "import" } }).GenericActionCtx<import("convex/server", { with: { "resolution-mode": "import" } }).GenericDataModel>["runAction"];
}, args: {
    payload: import("@dodopayments/convex", { with: { "resolution-mode": "import" } }).CheckoutSessionPayload;
}) => Promise<{
    checkout_url: string;
}>, customerPortal: (ctx: any, args?: {
    send_email?: boolean;
}) => Promise<{
    portal_url: string;
}>;
//# sourceMappingURL=dodo.d.ts.map