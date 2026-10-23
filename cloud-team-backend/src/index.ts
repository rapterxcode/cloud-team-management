import './config.js';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { envConfig } from './config.js';

const prisma = new PrismaClient();
const port = envConfig.port;
createApp(prisma).listen(port, () => console.log(`api listening on :${port}`));
