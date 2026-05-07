import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";


@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    // create instance logger from nestJs with name context LoggerMiddlewar
    private readonly logger = new Logger(LoggerMiddleware.name);
    use(req: Request, res: Response, next: NextFunction){
        // for take start time request with format [second, nanoseconds]
        const startTime = process.hrtime();
        // add listener to finish event (like event listener from javascript) in object response
        res.on('finish', () => {
            // counting deviation difference time from startTime to finish response
            const [seconds, nanoseconds] = process.hrtime(startTime);
            // convert time to milisecond and round the value to 3 decimal
            const latency = (seconds * 1000 + nanoseconds / 1_000_000).toFixed(3);

            const logEntry = {
                requestId: req.headers['X-Request-Id'],
                timestamp: new Date().toISOString(),
                ip: req.ip,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                userAgent: req.headers['user-agent'] || '',
                referer: req.headers['referer'] || '',
                contentLength: res.getHeader('Content-Length') || 0,
                latencyMs: latency,
            };
            this.logger.log(JSON.stringify(logEntry));
        });

        next()
    }
}