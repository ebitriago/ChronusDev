
import jwt from 'jsonwebtoken';

const SAW_SECRET = process.env.JWT_SECRET || 'chronus-crm-super-secret-key-change-in-production';

const token = jwt.sign(
    {
        userId: 'test-user-id',
        email: 'eduardo@assistai.lat',
        name: 'Eduardo Debug',
        role: 'SUPER_ADMIN'
    },
    SAW_SECRET,
    { expiresIn: '1h' }
);

console.log(token);
