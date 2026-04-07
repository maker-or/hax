"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerPortal = exports.checkout = exports.dodo = void 0;
// convex/dodo.ts
const convex_1 = require("@dodopayments/convex");
const api_1 = require("./_generated/api");
exports.dodo = new convex_1.DodoPayments(api_1.components.dodopayments, {
    // This function maps your Convex user to a Dodo Payments customer
    // Customize it based on your authentication provider and database
    identify: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null; // User is not logged in
        }
        // Use ctx.runQuery() to lookup customer from your database
        const customer = await ctx.runQuery(api_1.internal.org.getOrganisationByUserId, {
            userId: identity.subject,
        });
        if (!customer) {
            return null; // Customer not found in database
        }
        return {
            dodoCustomerId: customer.organisation.dodocustomerId, // Replace customer.dodoCustomerId with your field storing Dodo Payments customer ID
        };
    },
    apiKey: process.env.DODO_PAYMENTS_API_KEY,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT,
});
// Export the API methods for use in your app
_a = exports.dodo.api(), exports.checkout = _a.checkout, exports.customerPortal = _a.customerPortal;
//# sourceMappingURL=dodo.js.map