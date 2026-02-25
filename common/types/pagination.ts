export interface Pagination<T> {
  data: T[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    maxPerPage: number;
  }
}