import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class QueryTokenMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        if (req.query?.token) {
            req.headers['authorization'] = `Bearer ${req.query.token}`;
        }
        next();
    }
}