import type { NextFunction, Request, RequestHandler, Response } from "express";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

export const toCents = (value: string | number) => Math.round(Number(value) * 100);
export const fromCents = (value: number) => Number((value / 100).toFixed(2));
export const decimalFromCents = (value: number) => (value / 100).toFixed(2);
