// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";

export function authenticationMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization;
  if (!token) {
    res.status(401).json({ message: "No token provided" });
    return;
  }
  
  if (token === "Bearer secret") {
    next();
  } else {
    res.status(403).json({ message: "Invalid token" });
  }
}
