export interface PaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export class PaginatedResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T[];
  meta: PaginationMeta;
  timestamp: string;

  constructor(
    data: T[],
    totalItems: number,
    page: number,
    limit: number,
    message = 'Success',
  ) {
    this.success = true;
    this.statusCode = 200;
    this.message = message;
    this.data = data;
    this.meta = {
      totalItems,
      itemCount: data.length,
      itemsPerPage: limit,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
    this.timestamp = new Date().toISOString();
  }
}
