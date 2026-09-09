import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';

const prisma = new PrismaClient();
const port = Number(process.env.PORT ?? 3000);
createApp(prisma).listen(port, () => console.log(`api listening on :${port}`));
