import { BadRequestException, Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";


interface RateLimitParam {
    [ip: string]: {
        countReq: number,
        timeRequest: number
    }
}
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
    private request: RateLimitParam = {}

    private readonly windowMs = 60*1000;
    private readonly maxRequest = 10;
    use(req: Request, res: Response, next: NextFunction){
        // if environment test, skip rate limit
        if (process.env.NODE_ENV === 'test') {
            return next();
        }
        
        const ip = String(req.ip);
        const currentTime = Date.now();

        if(!this.request[ip]) {
            this.request[ip] = {
                countReq: 1,
                timeRequest: currentTime
            }
        }
        else {
            const checkTimeReset = currentTime - this.request[ip].timeRequest;
            if(checkTimeReset < this.windowMs) {
                this.request[ip].countReq ++;
                if(this.request[ip].countReq > this.maxRequest) throw new BadRequestException('to many request, wait a moment')
            }
            else{
                this.request[ip] = {
                    countReq: 1,
                    timeRequest: currentTime
                }
            }
        }
        next()
    }
}