import { AdvancedController } from './controllers/advanced.controller.js';
import { UserController } from './controllers/user.controller.js';
export function RegisterRoutes(app) {
    app.get('/advanced/:tenantId/users', async (req, res) => {
        const controller = new AdvancedController();
        try {
            const input = {};
            // Map Query
            Object.assign(input, req.query);
            // Map Params
            Object.assign(input, req.params);
            // Map Body
            Object.assign(input, req.body);
            // In a real app, you would run 'zod' or 'class-validator' here on 'input'
            const response = await controller.listUsers(input);
            res.status(200).json(response);
        }
        catch (err) {
            console.error(err);
            res.status(500).send(err.message);
        }
    });
    app.post('/advanced/', async (req, res) => {
        const controller = new AdvancedController();
        try {
            const input = {};
            // Map Query
            Object.assign(input, req.query);
            // Map Params
            Object.assign(input, req.params);
            // Map Body
            Object.assign(input, req.body);
            // In a real app, you would run 'zod' or 'class-validator' here on 'input'
            const response = await controller.create(input);
            res.status(200).json(response);
        }
        catch (err) {
            console.error(err);
            res.status(500).send(err.message);
        }
    });
    app.get('/users/:userId', async (req, res) => {
        const controller = new UserController();
        try {
            const input = {};
            // Map Query
            Object.assign(input, req.query);
            // Map Params
            Object.assign(input, req.params);
            // Map Body
            Object.assign(input, req.body);
            // In a real app, you would run 'zod' or 'class-validator' here on 'input'
            const response = await controller.getUser(input);
            res.status(200).json(response);
        }
        catch (err) {
            console.error(err);
            res.status(500).send(err.message);
        }
    });
    app.post('/users/', async (req, res) => {
        const controller = new UserController();
        try {
            const input = {};
            // Map Query
            Object.assign(input, req.query);
            // Map Params
            Object.assign(input, req.params);
            // Map Body
            Object.assign(input, req.body);
            // In a real app, you would run 'zod' or 'class-validator' here on 'input'
            const response = await controller.createUser(input);
            res.status(200).json(response);
        }
        catch (err) {
            console.error(err);
            res.status(500).send(err.message);
        }
    });
}
