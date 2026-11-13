// 공통 오류 (서버 함수와 브라우저 미리보기에서 함께 씀)
export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}
export const fail = (status: number, message: string, extra: Record<string, unknown> = {}): never => { throw new HttpError(status, message, extra); };
