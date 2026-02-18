
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as any })
    : null;

export async function createInvoicePaymentLink(invoice: any, organizationName: string) {
    if (!stripe) {
        console.warn("Stripe not configured (STRIPE_SECRET_KEY missing)");
        return null;
    }

    try {
        // Create Product/Price on the fly for simplicity, or use existing
        // For dynamic invoices, creating a Price object is standard.

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: invoice.currency.toLowerCase(),
                    product_data: {
                        name: `Factura #${invoice.number}`,
                        description: `Pago de factura para ${organizationName}`,
                    },
                    unit_amount: Math.round(invoice.amount * 100), // cents
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3003' : 'https://chronuscrm.assistai.work')}/payment-success?invoiceId=${invoice.id}`,
            cancel_url: `${process.env.FRONTEND_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3003' : 'https://chronuscrm.assistai.work')}/payment-cancel`,
            metadata: {
                invoiceId: invoice.id,
                organizationId: invoice.organizationId
            }
        });

        return session.url;
    } catch (error) {
        console.error("Stripe Error:", error);
        throw error;
    }
}
