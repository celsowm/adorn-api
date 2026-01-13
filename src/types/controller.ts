import { Request, Response, NextFunction } from 'express';

export interface ControllerClass {
  new (...args: any[]): any;
}

export interface RouteHandler {
  (...args: any[]): any;
}

export interface MiddlewareFunction {
  (req: Request, res: Response, next: NextFunction): void | Promise<void>;
}

export interface GuardFunction {
  (req: Request, res: Response, next: NextFunction): boolean | Promise<boolean>;
}
