export class McStatusError extends Error {
  override readonly name = "McStatusError";

  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly body: string;

  constructor(init: {
    message: string;
    status: number;
    method: string;
    path: string;
    body: string;
  }) {
    super(init.message);
    this.status = init.status;
    this.method = init.method;
    this.path = init.path;
    this.body = init.body;
  }
}
