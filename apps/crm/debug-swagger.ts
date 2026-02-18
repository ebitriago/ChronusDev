
import swaggerJsdoc from 'swagger-jsdoc';

const swaggerOptions = {
    definition: {
        openapi: '3.1.0',
        info: {
            title: 'ChronusCRM API',
            version: '1.0.0',
        },
    },
    apis: ['./src/index.ts', './src/routes/*.ts'], // Check these paths
};

import express from 'express';
import { apiReference } from '@scalar/express-api-reference';

try {
    console.log("Generating spec...");
    const spec = swaggerJsdoc(swaggerOptions);
    console.log("Success! Spec generated.");

    const app = express();
    app.use('/docs', apiReference({
        spec: { content: spec },
        theme: 'purple'
    }));

    app.listen(3005, () => {
        console.log("Debug server running on http://localhost:3005/docs");
    });
} catch (e) {
    console.error("Error:", e);
}
