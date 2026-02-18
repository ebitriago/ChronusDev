import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'ChronusDev & CRM API',
            version: '1.0.0',
            description: 'Documentación oficial de la API de ChronusDev. Esta API gestiona clientes, tickets, finanzas, tareas y más.',
            contact: {
                name: 'ChronusDev Support',
                url: 'https://chronusdev.com',
            },
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Servidor de Desarrollo',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    // Rutas donde buscar comentarios JSDoc
    apis: ['./src/index.ts', './src/routes/*.ts', './src/auth.ts'],
};

export const specs = swaggerJsdoc(options);
