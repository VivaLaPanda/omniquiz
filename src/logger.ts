// logger.ts
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

let logger: pino.Logger;

if (isDevelopment) {
    logger = pino({
        transport: {
          target: 'pino-pretty'
        },
        level: 'debug',
      })
} else {
    logger = pino({
        level: 'info',
      })
}

export default logger;