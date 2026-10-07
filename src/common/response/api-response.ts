export class ApiResponse<T = null> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  timestamp: string;
  path?: string;

  constructor(partial: Partial<ApiResponse<T>>) {
    Object.assign(this, partial);
    this.timestamp = new Date().toISOString();
  }

  static ok<T>(data: T, message = 'Success', statusCode = 200): ApiResponse<T> {
    return new ApiResponse<T>({ success: true, statusCode, message, data });
  }

  static created<T>(data: T, message = 'Created successfully'): ApiResponse<T> {
    return new ApiResponse<T>({ success: true, statusCode: 201, message, data });
  }

  static noContent(message = 'No content'): ApiResponse<null> {
    return new ApiResponse<null>({ success: true, statusCode: 204, message, data: null });
  }

  static error(message: string, statusCode = 500, path?: string): ApiResponse<null> {
    return new ApiResponse<null>({ success: false, statusCode, message, data: null, path });
  }
}
